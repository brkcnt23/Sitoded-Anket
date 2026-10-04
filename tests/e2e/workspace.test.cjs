const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const h=require('./support.cjs');
before(h.start,{timeout:60000});after(h.stop,{timeout:15000});
const browserTest=(name,fn)=>test(name,{timeout:120000},t=>h.withPage(t,fn));
async function checkScreen(page,name){
 assert.ok(await page.$('body.workspace'),name+' uses common workspace');
 assert.equal(await page.$eval('body',e=>e.dataset.theme),'light');
 await page.evaluate(async()=>{await document.fonts.ready;for(const img of document.images){if(img.getAttribute('src')){img.loading='eager';await img.decode();}}});
 for(const width of [1440,390,360]){
  await page.setViewport({width,height:960});
  await page.evaluate(()=>scrollTo(0,0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${name} overflows at ${width}`);
  const dark=await page.$eval('body',e=>getComputedStyle(e).backgroundColor);
  assert.notEqual(dark,'rgb(26, 26, 26)',name+' dark background');
  if(width!==360)await page.screenshot({path:path.join(h.artifacts,`${name}-${width}.png`),fullPage:true});
 }
}

browserTest('all nine administration panels work on desktop and mobile',async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setCacheEnabled(false);const member=await h.member();await h.event(member);await h.login(page);await page.goto(h.origin+'/admin');await page.evaluate(()=>document.fonts.ready);
 for(const width of [1440,390]){
  await page.setViewport({width,height:960});
  for(const panel of ['overview','users','teams','events','points','attendance','surveys','reports','feedback']){
   if(width===390){await page.click('#menuToggle');assert.equal(await page.$eval('#menuToggle',e=>e.getAttribute('aria-expanded')),'true');}
   const endpoints={overview:['/api/admin/pending-evaluations','/api/admin/stats/monthly-active'],events:['/api/admin/events'],attendance:['/api/admin/attendance-events'],surveys:['/api/admin/surveys'],feedback:['/api/admin/feedback']}[panel]||[];
   const responses=endpoints.map(endpoint=>page.waitForResponse(r=>r.url()===h.origin+endpoint));
   await page.click(`#adminNav button[onclick="showPanel('${panel}')"]`);
   for(const response of await Promise.all(responses)){assert.equal(response.status(),200);assert.equal((await response.json()).success,true);}
   await page.waitForSelector('#panel-'+panel+'.active',{visible:true});
   const rendered={overview:'#monthly-active-list',events:'#events-table',attendance:'#attendance-events',surveys:'#surveys-list',feedback:'#feedback-list'}[panel];
   if(rendered)await page.waitForFunction(selector=>{const el=document.querySelector(selector);return el&&el.textContent.trim().length>0&&!el.textContent.includes('Yükleniyor');},{},rendered);
   assert.equal(new URL(page.url()).searchParams.get('panel'),panel);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${panel} at ${width}`);
   assert.equal(await page.$eval(`#adminNav button[onclick="showPanel('${panel}')"]`,e=>e.getAttribute('aria-current')),'page');
   await page.screenshot({path:path.join(h.artifacts,`admin-${panel}-${width}.png`),fullPage:true});
  }
 }
 await page.reload();assert.ok(await page.$('#panel-feedback.active'));
 await page.click('#menuToggle');await page.keyboard.press('Escape');assert.equal(await page.$eval('#menuToggle',e=>e.getAttribute('aria-expanded')),'false');
 assert.deepEqual(errors,[]);
});

browserTest('all operational form and state screens are responsive and share branding',async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setCacheEnabled(false);
 const user=await h.member();const id=await h.event(user);await h.login(page);
 for(const [route,name,status]of[
 ['/admin/user/new','user-new',200],[`/admin/user/${user.id}/edit`,'user-edit',200],
 ['/events/create','event-create',200],[`/event/${id}/registrations`,'registrations',200],
 [`/attendance/${id}`,'attendance',200],['/profile','profile',200],['/dashboard','dashboard',200],
 ['/a/gonulluluk','public-survey',200],['/y/invalid-test-token','qr-invalid',200],
 ['/404','not-found',404],['/500','server-error',500],['/login','login',200],
 ['/api/admin/reports/teams?format=html','team-report',200],
 ['/api/admin/reports/events-monthly?month=2026-01&format=html','event-report',200]
 ]){assert.equal((await page.goto(h.origin+route,{waitUntil:'networkidle2'})).status(),status,route);await checkScreen(page,name);if(name==='event-report'){assert.equal(await page.$eval('.dl-btn',e=>new URL(e.href).searchParams.get('month')),'2026-01');}}
 await page.goto(h.origin+'/logout');await h.login(page,user);
 assert.equal((await page.goto(h.origin+'/admin')).status(),403);await checkScreen(page,'forbidden');
 assert.deepEqual(errors,[]);
});

browserTest('survey builder saves a question public form submits and admin reads the answer',async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await h.login(page);
 const created=await h.api(page,'/api/admin/surveys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Arayüz E2E Anketi',description:'Kalıcı test formu'})});
 assert.equal(created.data.success,true);const survey=created.data.data;
 await page.setViewport({width:1440,height:960});
 await page.goto(h.origin+`/admin/surveys/${survey.id}`,{waitUntil:'networkidle2'});
 await page.evaluate(()=>document.fonts.ready);
 await page.click('.chip[data-type="TEXT_SHORT"]');
 await page.type('#questions-container textarea','En çok hangi çalışmaya katkı sunmak istersiniz?');
 await page.click('#questions-container input[type=checkbox]');
 const [saved]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/save')),page.click('button[onclick="saveSurvey()"]')]);
 assert.equal((await saved.json()).success,true);
 await page.waitForNetworkIdle({idleTime:150});
 await checkScreen(page,'survey-builder');
 const toggled=await h.api(page,`/api/admin/surveys/${survey.id}/toggle`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_open:true})});assert.equal(toggled.data.success,true);
 const question=(await h.pool.query('SELECT id FROM survey_questions WHERE survey_id=$1',[survey.id])).rows[0];
 await page.goto(h.origin+`/a/${survey.slug}`);await page.type(`[name=q_${question.id}]`,'İklim eğitimi <b>birlikte</b>');await page.click('#kvkk-cb');
 await Promise.all([page.waitForNavigation({waitUntil:'networkidle2'}),page.click('#submit-btn')]);
 assert.match(await page.$eval('.state-title',e=>e.textContent),/Yanıtınız alındı/);await checkScreen(page,'survey-success');
 await page.goto(h.origin+`/admin/surveys/${survey.id}/responses`);await page.waitForSelector('.rcard-head');await page.click('.rcard-head');
 await page.waitForFunction(()=>document.querySelector('.rcard-body')?.textContent.includes('İklim eğitimi'));
 assert.match(await page.$eval('.rcard-body',e=>e.textContent),/<b>birlikte<\/b>/);assert.equal(await page.$('.rcard-body b'),null);
 await checkScreen(page,'survey-responses');
 await page.goto(h.origin+`/admin/surveys/${survey.id}`);assert.equal(await page.$eval('.chip',e=>e.disabled),true,'Existing response locks questions');
 await h.api(page,`/api/admin/surveys/${survey.id}/toggle`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_open:false})});
 await page.goto(h.origin+`/a/${survey.slug}`);assert.match(await page.$eval('.state-title',e=>e.textContent),/kapalı/);await checkScreen(page,'survey-closed');assert.deepEqual(errors,[]);
});
