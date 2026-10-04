const { execFileSync, spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '../..');
const runId = randomBytes(6).toString('hex');
const container = `sitoded-e2e-${runId}`;
const artifacts = path.join(root, 'test-results', runId);
const password = `E2e-${randomBytes(12).toString('hex')}`;
let pool, browser, app, origin, admin, sequence = 0, appLog = '', created = false;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 30000 }).trim();

async function start() {
  mkdirSync(artifacts, { recursive: true });
  // No external DB/URL override: all writes target this disposable container.
  docker('run', '--detach', '--rm', '--pull=never', '--name', container,
    '--label', 'sitoded.e2e=true', '--publish', '127.0.0.1::5432',
    '--env', 'POSTGRES_DB=sitoded_e2e', '--env', 'POSTGRES_USER=sitoded_e2e',
    '--env', `POSTGRES_PASSWORD=${password}`, 'postgres:15-alpine');
  created = true;
  const mapping = docker('port', container, '5432/tcp');
  assert.match(mapping, /^127\.0\.0\.1:\d+$/);
  const dbPort = Number(mapping.split(':')[1]);
  pool = new Pool({ host: '127.0.0.1', port: dbPort, database: 'sitoded_e2e',
    user: 'sitoded_e2e', password, connectionTimeoutMillis: 1000 });
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { await pool.query('SELECT 1'); ready = true; break; } catch { await delay(250); }
  }
  assert.ok(ready, 'Test PostgreSQL did not become ready');
  for (const file of ['database.sql', 'migration-faz2-5.sql', 'migration-profil.sql', 'migration-feedback.sql']) {
    await pool.query(readFileSync(path.join(root, file), 'utf8'));
  }
  admin = await member('ADMIN');
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  app = spawn(process.execPath, ['server.js'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), SESSION_SECRET: password,
      DB_HOST: '127.0.0.1', DB_PORT: String(dbPort), DB_NAME: 'sitoded_e2e',
      DB_USER: 'sitoded_e2e', DB_PASSWORD: password } });
  app.stdout.on('data', chunk => { appLog += chunk; });
  app.stderr.on('data', chunk => { appLog += chunk; });
  ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(origin + '/login', { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; }
    } catch {}
    if (app.exitCode !== null) break;
    await delay(200);
  }
  assert.ok(ready, 'Test application failed to start; see test-results app.log');
  browser = await puppeteer.launch({ headless: true,
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  console.log(`Isolated E2E: ${container}; artifacts: ${artifacts}`);
}

async function stop() {
  const errors = [];
  try { if (browser) await browser.close(); } catch (e) { errors.push(e); }
  if (app && app.exitCode === null) {
    const exited = once(app, 'exit'); app.kill('SIGTERM');
    await Promise.race([exited, delay(3000)]);
    if (app.exitCode === null && app.signalCode === null) { app.kill('SIGKILL'); await exited; }
  }
  try { if (pool) await pool.end(); } catch (e) { errors.push(e); }
  try { if (created) docker('rm', '--force', container); } catch (e) { errors.push(e); }
  writeFileSync(path.join(artifacts, 'app.log'), appLog);
  if (errors.length) throw new AggregateError(errors, 'E2E cleanup failed');
}

async function member(role = 'VOLUNTEER') {
  const username = `e2e_${++sequence}`;
  const hash = await bcrypt.hash(password, 4);
  const result = await pool.query(`INSERT INTO users
    (username,email,full_name,password_hash,hierarchy_level,role)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [username, `${username}@example.invalid`, `E2E Member ${sequence}`, hash,
      role === 'ADMIN' ? 'PRESIDENT' : 'VOLUNTEER', role]);
  return { ...result.rows[0], password };
}

async function withPage(t, fn) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(7000); page.setDefaultNavigationTimeout(10000);
  try { await fn(page); }
  catch (error) {
    writeFileSync(path.join(artifacts, t.name.replace(/[^a-z0-9-]/gi, '_') + '.error.txt'), error.stack || String(error));
    await page.screenshot({ path: path.join(artifacts, t.name.replace(/[^a-z0-9-]/gi, '_') + '.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally { await context.close(); }
}

async function login(page, user = admin) {
  await page.goto(origin + '/login', { waitUntil: 'domcontentloaded' });
  await page.type('[name=username]', user.username);
  await page.type('[name=password]', user.password);
  await submit(page, 'form');
  assert.match(page.url(), /\/dashboard$/);
}

async function submit(page, form) {
  return (await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.click(`${form} [type=submit]`)
  ]))[0];
}

async function api(page, url, options = {}) {
  return page.evaluate(async (url, options) => {
    const response = await fetch(url, options);
    const text = await response.text();
    return { status: response.status, text,
      data: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : null };
  }, url, options);
}

async function event(user, status = 'CONFIRMED') {
  const team = (await pool.query('INSERT INTO teams(name) VALUES($1) RETURNING id', [`E2E Team ${++sequence}`])).rows[0];
  const result = await pool.query(`INSERT INTO events
    (title,location,event_date,start_time,end_time,capacity,leader_id,team_id,registration_deadline,status)
    VALUES ($1,'E2E','2026-01-15','12:00','13:00',5,$2,$3,'2026-01-14','COMPLETED') RETURNING id`,
    [`E2E Event ${sequence}`, admin.id, team.id]);
  const id = result.rows[0].id;
  await pool.query('INSERT INTO event_registrations(event_id,user_id,status) VALUES($1,$2,$3)', [id, user.id, status]);
  if (status === 'CONFIRMED') await pool.query('INSERT INTO event_attendance(event_id,user_id,marked_by,attended) VALUES($1,$2,$3,TRUE)', [id, user.id, admin.id]);
  return id;
}

module.exports = { start, stop, member, withPage, login, submit, api, event, artifacts,
  get pool() { return pool; }, get origin() { return origin; }, get admin() { return admin; } };
