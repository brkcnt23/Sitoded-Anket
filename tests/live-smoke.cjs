// Read-only deployment check. No login, form submission or database access.
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const origin = 'https://sitoded.jamcontest.com';
const output = path.join(__dirname, '../test-results');
(async () => {
  mkdirSync(output, { recursive: true });
  // Docker starts before Express is ready; wait through a brief proxy 502 window.
  let ready = false;
  for (let attempt=0; attempt<20; attempt++) {
    try { if ((await fetch(origin+'/login', {signal:AbortSignal.timeout(3000)})).ok) {ready=true;break;} } catch {}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  assert.ok(ready, 'Deployment did not become ready');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const results = [], errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    for (const route of ['/', '/hakkimizda', '/cop31', '/projeler', '/projeler/yerel', '/projeler/uluslararasi', '/projeler/gelecek', '/haberler', '/calisma-alanlari', '/iletisim']) {
      await page.setViewport({ width: 1440, height: 960 });
      const response = await page.goto(origin + route, { waitUntil: 'networkidle2', timeout: 25000 });
      assert.equal(response.status(), 200);
      assert.ok(await page.$('body.public-site'));
      assert.ok(await page.$('img[src="/img/site/brand-emblem.webp"]'), 'Current association logo must be live');
      assert.equal(await page.$('img[src="/img/site/logo-dark.webp"]'), null);
      if(route==='/'){assert.ok(await page.$('img[src*="editorial/hero"]'));assert.ok(await page.$('img[src*="editorial/sofia"]'));}
      await page.evaluate(async () => { await document.fonts.ready; for (const image of document.images) image.loading = 'eager'; await Promise.all([...document.images].map(image => image.decode())); });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (route === '/') await page.screenshot({ path: path.join(output, 'live-home-desktop.png'), fullPage: true });
      await page.setViewport({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.click('#navToggle');
      assert.equal(await page.$eval('#navToggle', el => el.getAttribute('aria-expanded')), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.$eval('#mobileNav', el => el.hidden), true);
      if (route === '/cop31') await page.screenshot({ path: path.join(output, 'live-cop31-mobile.png'), fullPage: true });
      await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('#langToggle')]);
      assert.equal(await page.$eval('html', el => el.lang), 'en');
      results.push({ route, status: 200, desktop: 'pass', mobile: 'pass', language: 'pass' });
    }
    for (const route of ['/login', '/a/gonulluluk']) {
      const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      assert.ok(await page.$('form'));
      results.push({ route, status: 200 });
    }
    assert.deepEqual(errors, []);
    const report = { checkedAt: new Date().toISOString(), origin, results, errors };
    writeFileSync(path.join(output, 'live-smoke.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
