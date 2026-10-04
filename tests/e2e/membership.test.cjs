const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./support.cjs');

before(h.start, { timeout: 60000 });
after(h.stop, { timeout: 15000 });
const browserTest = (name, fn) => test(name, { timeout: 35000 }, t => h.withPage(t, fn));
const profileForm = 'form[action="/profile/update"]';
const passwordForm = 'form[action="/profile/change-password"]';
async function clickAndResponse(page, selector, suffix) {
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith(suffix) && r.request().method() === 'POST'),
    page.click(selector)
  ]);
  assert.equal(response.status(), 200);
  assert.equal((await response.json()).success, true);
}

browserTest('admin creates member; profile completion reaches admin badge', async page => {
  await h.login(page);
  await page.goto(h.origin + '/admin/user/new');
  for (const [name, value] of Object.entries({ username: 'journey_member', email: 'journey@example.invalid', full_name: 'Journey Member', password: 'Journey-Test-123!' })) {
    await page.type(`[name=${name}]`, value);
  }
  await h.submit(page, 'form');
  const user = (await h.pool.query('SELECT * FROM users WHERE username=$1', ['journey_member'])).rows[0];
  assert.ok(user, 'Admin form must persist the new member');
  assert.equal(user.profile_completed_at, null);
  await page.goto(h.origin + '/logout');
  await h.login(page, { ...user, password: 'Journey-Test-123!' });
  assert.equal((await h.api(page, '/api/user/profile-status')).data.completed, false);
  await page.waitForSelector('#profile-banner a', { visible: true });
  await page.goto(h.origin + '/profile');
  await page.type('[name=city]', 'Erzurum');
  await h.submit(page, profileForm);
  assert.equal((await h.api(page, '/api/user/profile-status')).data.completed, true);
  await page.goto(h.origin + '/logout'); await h.login(page);
  await page.goto(h.origin + '/admin');
  const row = await page.$$eval('#panel-users tr', rows => rows.find(r => r.textContent.includes('journey_member'))?.textContent);
  assert.match(row || '', /Tamamlandı/);
  const badge = await page.$$eval('#panel-users tr', rows => rows.find(r => r.textContent.includes('journey_member'))?.querySelector('td:nth-child(5) .badge')?.textContent);
  assert.equal(badge, 'Tamamlandı', 'Completion status is rendered as a badge, not escaped markup');
});

for (const count of [1, 2]) browserTest(`profile persists ${count} interest and talent selections`, async page => {
  const user = await h.member(); await h.login(page, user);
  await page.goto(h.origin + '/profile');
  const interests = ['Spor', 'Gençlik'].slice(0, count), talents = ['Kodlama', 'Müzik'].slice(0, count);
  for (const [field, values] of Object.entries({ interests, talents })) {
    for (const value of values) await page.click(`[name=${field}][value="${value}"]`);
  }
  await h.submit(page, profileForm);
  // Read after a fresh navigation: verify actual persistence, not just checked DOM state.
  await page.reload();
  for (const [field, expected] of Object.entries({ interests, talents })) {
    const actual = await page.$$eval(`[name=${field}]:checked`, els => els.map(e => e.value));
    assert.deepEqual(actual.sort(), expected.sort());
  }
  for (const field of ['interests', 'talents']) {
    for (const input of await page.$$(`[name=${field}]:checked`)) await input.click();
  }
  await h.submit(page, profileForm);
  const saved = (await h.pool.query('SELECT interests,talents FROM users WHERE id=$1', [user.id])).rows[0];
  assert.deepEqual(saved, { interests: [], talents: [] });
});

browserTest('password change renders success and new password logs in', async page => {
  const user = await h.member(); await h.login(page, user);
  await page.goto(h.origin + '/profile');
  for (const [name, value] of Object.entries({ currentPassword: user.password, newPassword: 'Changed-Test-123!', confirmPassword: 'Changed-Test-123!' })) await page.type(`[name=${name}]`, value);
  const response = await h.submit(page, passwordForm);
  assert.equal(response.status(), 200, 'Successful change must not render HTTP 500');
  assert.match(await page.$eval('body', el => el.innerText), /Şifreniz başarıyla güncellendi/);
  await page.goto(h.origin + '/logout');
  await h.login(page, { ...user, password: 'Changed-Test-123!' });
});

browserTest('wrong current password renders validation and keeps old password', async page => {
  const user = await h.member(); await h.login(page, user);
  await page.goto(h.origin + '/profile');
  for (const [name, value] of Object.entries({ currentPassword: 'wrong-password', newPassword: 'Changed-Test-123!', confirmPassword: 'Changed-Test-123!' })) await page.type(`[name=${name}]`, value);
  const response = await h.submit(page, passwordForm);
  assert.equal(response.status(), 200);
  assert.match(await page.$eval('body', el => el.innerText), /Mevcut şifre yanlış/);
  await page.goto(h.origin + '/logout'); await h.login(page, user);
});

browserTest('my events shows valid date and confirmed attendance', async page => {
  const user = await h.member(); await h.event(user); await h.login(page, user);
  await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/user/my-events')), page.click('#tab-mine')]);
  await page.waitForFunction(() => document.querySelector('#myevents').textContent.includes('E2E Event'));
  const text = await page.$eval('#myevents', el => el.innerText);
  assert.doesNotMatch(text, /Invalid Date/);
  assert.match(text, /15.*Oca.*2026/); assert.match(text, /Katıldın/); assert.match(text, /Onaylı/);
});

browserTest('cancelled registration is not presented as waiting', async page => {
  const user = await h.member(); await h.event(user, 'CANCELLED'); await h.login(page, user);
  await page.click('#tab-mine');
  await page.waitForFunction(() => document.querySelector('#myevents').textContent.includes('E2E Event'));
  const text = await page.$eval('#myevents', el => el.innerText);
  assert.match(text, /[İi]ptal/); assert.doesNotMatch(text, /Beklemede/);
});

browserTest('member feedback goes NEW to READ to DONE and is deleted by admin', async page => {
  const user = await h.member(); await h.login(page, user);
  const message = 'Kalıcı E2E önerisi <b>düz metin</b>';
  await page.type('#fb-message', message);
  await clickAndResponse(page, 'button[onclick="sendFeedback()"]', '/api/user/feedback');
  await page.waitForFunction(() => document.querySelector('#fb-message').value === '');
  const record = (await h.pool.query('SELECT * FROM feedback WHERE user_id=$1', [user.id])).rows[0];
  assert.equal(record.status, 'NEW');
  await page.goto(h.origin + '/logout'); await h.login(page); await page.goto(h.origin + '/admin');
  if(await page.$eval('#menuToggle',e=>getComputedStyle(e).display!=='none')) await page.click('#menuToggle');
  await page.click('button[onclick="showPanel(\'feedback\')"]');
  await page.waitForFunction(text => document.querySelector('#feedback-list').textContent.includes(text), {}, message);
  assert.equal(await page.$('#feedback-list b'), null, 'User feedback must be escaped');
  for (const status of ['READ', 'DONE']) {
    const button = `button[onclick="setFeedbackStatus(${record.id}, '${status}')"]`;
    await clickAndResponse(page, button, `/api/admin/feedback/${record.id}/status`);
    // Status response precedes the list refresh; wait until the rendered controls update.
    await page.waitForFunction(selector => !document.querySelector(selector), {}, button);
    assert.equal((await h.pool.query('SELECT status FROM feedback WHERE id=$1', [record.id])).rows[0].status, status);
  }
  page.once('dialog', dialog => dialog.accept());
  await clickAndResponse(page, `button[onclick="deleteFeedback(${record.id})"]`, `/api/admin/feedback/${record.id}/delete`);
  assert.equal((await h.pool.query('SELECT id FROM feedback WHERE id=$1', [record.id])).rowCount, 0);
});

browserTest('members cannot list modify or delete admin feedback', async page => {
  const user = await h.member(); await h.login(page, user);
  const record = (await h.pool.query("INSERT INTO feedback(user_id,kind,message) VALUES($1,'ONERI','Protected E2E') RETURNING id", [user.id])).rows[0];
  for (const [url, options] of [
    ['/api/admin/feedback', {}],
    [`/api/admin/feedback/${record.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'DONE' }) }],
    [`/api/admin/feedback/${record.id}/delete`, { method: 'POST' }]
  ]) assert.equal((await h.api(page, url, options)).status, 403);
  assert.equal((await h.pool.query('SELECT status FROM feedback WHERE id=$1', [record.id])).rows[0].status, 'NEW');
});
