const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const h = require('./support.cjs');
before(h.start, { timeout: 60000 });
after(h.stop, { timeout: 15000 });
const browserTest = (name, fn) => test(name, { timeout: 45000 }, t => h.withPage(t, fn));

for (const route of ['/', '/hakkimizda', '/cop31']) browserTest(`public ${route} desktop and mobile render with working assets`, async page => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const badAssets = []; page.on('response', response => { if (response.url().startsWith(h.origin) && response.status() >= 400) badAssets.push(response.url()); });
  const response = await page.goto(h.origin + route, { waitUntil: 'networkidle2' });
  assert.equal(response.status(), 200);
  assert.equal(await page.$$eval('h1', els => els.length), 1);
  assert.equal(await page.$eval('html', el => el.lang), 'tr');
  await page.evaluate(async () => { for (const image of document.images) image.loading = 'eager'; await Promise.all([...document.images].map(image => image.decode())); await document.fonts.ready; });
  for (const width of [1440, 768, 390, 360]) {
    await page.setViewport({ width, height: 960 });
    const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(dimensions.content <= dimensions.viewport + 1, `Overflow on ${route} at ${width}px: ${dimensions.content}`);
    if (width === 1440 || width === 390) await page.screenshot({ path: path.join(h.artifacts, `site-${route.replace(/\W/g, '') || 'home'}-${width}.png`), fullPage: true });
  }
  assert.deepEqual(errors, []); assert.deepEqual(badAssets, []);
  const brokenAnchors = await page.$$eval('a[href^="#"]', links => links.filter(a => !document.getElementById(a.hash.slice(1))).map(a => a.hash));
  assert.deepEqual(brokenAnchors, []);
});

browserTest('mobile menu opens closes with Escape and follows COP31', async page => {
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(h.origin);
  await page.click('#navToggle');
  assert.equal(await page.$eval('#navToggle', e => e.getAttribute('aria-expanded')), 'true');
  await page.waitForSelector('#mobileNav', { visible: true });
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#mobileNav', e => e.hidden), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'navToggle');
  await page.click('#navToggle');
  await Promise.all([page.waitForNavigation(), page.click('#mobileNav a[href="/cop31"]')]);
  assert.equal(new URL(page.url()).pathname, '/cop31');
});

browserTest('all public pages switch language without JavaScript', async page => {
  await page.setJavaScriptEnabled(false);
  for (const route of ['/', '/hakkimizda', '/cop31']) {
    await page.goto(h.origin + route);
    await Promise.all([page.waitForNavigation(), page.click('#langToggle')]);
    assert.equal(await page.$eval('html', e => e.lang), 'en');
    assert.match(await page.$eval('h1', e => e.textContent), /Think global|Rooted in Erzurum|Learning for the climate/);
    assert.equal(await page.$eval('.desktop-nav a', e => e.textContent), 'About us');
  }
});

browserTest('COP31 sources dates FAQ and training contact work', async page => {
  await page.goto(h.origin + '/cop31');
  assert.match(await page.$eval('.conference-box', e => e.textContent), /9–20 Kasım 2026/);
  assert.equal(await page.$eval('.conference-box a', e => e.href), 'https://unfccc.int/cop31');
  assert.ok(await page.$('a[href^="https://tr.linkedin.com/posts/profdr"]'));
  await page.click('.faq details:nth-child(3) summary');
  assert.equal(await page.$eval('.faq details:nth-child(3)', e => e.open), true);
  assert.match(await page.$eval('.faq details:nth-child(3) p', e => e.textContent), /ayrı süreçler/);
  assert.match(await page.$eval('.training-contact a', e => e.href), /^mailto:sitoded25@gmail.com\?subject=/);
});

browserTest('public volunteer and member entry links reach existing forms', async page => {
  await page.goto(h.origin);
  const volunteer = await page.$eval('.hero .button', e => e.getAttribute('href'));
  assert.equal(volunteer, '/a/gonulluluk');
  assert.equal((await page.goto(h.origin + volunteer)).status(), 200);
  assert.ok(await page.$('form'));
  assert.equal((await page.goto(h.origin + '/login')).status(), 200);
  assert.ok(await page.$('[name=username]'));
});

browserTest('navigation opens dedicated local pages and all archive records render', async page => {
  const archive = require('../../content/archive.json');
  await page.goto(h.origin);
  const navigation = await page.$$eval('.desktop-nav a', links => links.map(a => a.getAttribute('href')));
  assert.equal(navigation.length, 6);
  assert.ok(navigation.every(link => link.startsWith('/') && !link.includes('#')));
  const routes = [...navigation, '/projeler/yerel', '/projeler/uluslararasi', '/projeler/gelecek', '/calisma-alanlari/genclik'];
  for(const route of routes){
    const response=await page.goto(h.origin+route,{waitUntil:'domcontentloaded'});
    assert.equal(response.status(),200,route);
    assert.equal(await page.$$eval('h1',e=>e.length),1,route);
    await page.setViewport({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,route);
  }
  assert.equal(archive.projects.length,35);
  assert.equal(archive.news.length,4);
  // Test every imported record through HTTP, including template rendering and text escaping.
  for(const [prefix,items] of [['/projeler/',archive.projects],['/haberler/',archive.news]]){
    for(const item of items){
      const response=await fetch(h.origin+prefix+item.slug);
      assert.equal(response.status,200,item.slug);
      const html=await response.text();
      assert.ok(html.includes('article-body'),item.slug);
      assert.ok(item.paragraphs.length>0,item.slug);
    }
  }
  assert.equal((await fetch(h.origin+'/projeler/nonexistent')).status,404);
  await page.goto(h.origin+'/haberler');
  assert.match(await page.$eval('.archive-note',e=>e.textContent),/başvuruları kapanmıştır/);
  await page.goto(h.origin+'/projeler/yerel');
  assert.equal(await page.$$eval('.project-entry',e=>e.length),14);
  await page.goto(h.origin+'/projeler/uluslararasi');
  assert.equal(await page.$$eval('.project-entry',e=>e.length),21);
  await page.goto(h.origin+'/projeler');
  await page.type('#projectSearch','Sessiz Sohbetler');
  assert.equal(await page.$$eval('.project-entry:not([hidden])',e=>e.length),1);
  assert.match(await page.$eval('.project-entry:not([hidden])',e=>e.textContent),/Sessiz Sohbetler/);
  await page.$eval('#projectSearch',e=>{e.value='';e.dispatchEvent(new Event('input'));});
  assert.equal(await page.$$eval('.project-entry:not([hidden])',e=>e.length),35);
});

browserTest('illustrated pages load locally and avoid the replaced hero artwork',async page=>{
  const dependencies=[];
  page.on('request',r=>{if(r.url().includes('www.sitoded.org'))dependencies.push(r.url());});
  const assets=new Set();
  const projectArts=require('../../lib/public-site').archive.projects.map(p=>p.art);
  assert.equal(new Set(require('../../lib/public-site').archive.news.map(n=>n.art)).size,4);
  assert.ok(new Set(projectArts).size>=7);
  assert.equal(projectArts.includes('world'),false);

  for(const route of ['/','/hakkimizda','/calisma-alanlari','/iletisim']){
    await page.goto(h.origin+route);
    const sources=await page.$$eval('img',images=>images.map(i=>i.getAttribute('src')));
    sources.forEach(s=>assets.add(s));
    assert.ok(sources.includes('/img/site/brand-emblem.webp'));
    assert.ok(!sources.includes('/img/site/logo-dark.webp'));
    const heroGlobeCount=sources.filter(s=>s.endsWith('/world.webp')).length;
    assert.ok(heroGlobeCount<=(route==='/'?1:0));
    assert.ok(!sources.some(s=>s.includes('/img/site/')&&!s.endsWith('/brand-emblem.webp')),'Old dark decorative assets must not render');
    assert.ok(!sources.some(s=>s.includes('volunteers')));
    await page.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.all([...document.images].map(i=>i.decode()));});
  }
  assert.ok(assets.size>=12,`Expected an expanded image library, found ${assets.size}`);
  assert.deepEqual(dependencies,[]);
});

browserTest('member admin profile and survey screens remain light with saved dark preference',async page=>{
  await page.setCacheEnabled(false);
  await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]);
  await page.evaluateOnNewDocument(()=>localStorage.setItem('sitoded-theme','dark'));
  await h.login(page);
  assert.equal((await page.goto(h.origin)).status(),200);
  assert.ok(await page.$('body.public-site'));
  for(const route of ['/admin','/dashboard','/profile','/a/gonulluluk','/admin/user/new']){
    const response=await page.goto(h.origin+route,{waitUntil:'networkidle2'});
    assert.equal(response.status(),200,route);
    assert.equal(await page.$eval('body',e=>e.dataset.theme),'light',route);
    assert.equal(await page.$('#themeToggle'),null);
    assert.equal(await page.$eval('body',e=>getComputedStyle(e).getPropertyValue('--surface').trim()),'#fff');
    for(const width of [1440,390]){
      await page.setViewport({width,height:960});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
      assert.equal(overflow,false,route+' at '+width);
      if(['/admin','/dashboard','/profile','/a/gonulluluk'].includes(route))await page.screenshot({path:path.join(h.artifacts,`platform-${route.replace(/\W/g,'')}-${width}.png`),fullPage:true});
    }
  }
});
