import assert from 'node:assert/strict';
// Real page state under a controlled clock; synthetic fixtures never enter production data.
export async function auditStatusClock(browser,base){
 const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await ctx.newPage();
 const now=Date.UTC(2026,9,29,8,30),stamp=ms=>new Date(ms).toISOString();let mode='healthy',apiCalls=0;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:now});
 await page.route('**/atlas?*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Map isolated for source-state test</title>'}));
 await page.route('**/api/**',route=>{
  apiCalls++;const endpoint=new URL(route.request().url()).pathname;
  const unavailable=mode==='empty';
  const forecast=[1,4,7].map((m,i)=>({validAt:stamp(now+m*60000),issuedAt:stamp(now-3600000),temperatureC:21+i,humidityPct:60,windKph:5,conditionId:'Cerah',conditionEn:'Clear'}));
  const payload=endpoint.endsWith('/weather')?{points:unavailable?[]:[{available:true,code:'fixture',name:'Fixture',kota:'Jakarta',forecast}]}:
   endpoint.endsWith('/air-quality')?unavailable?[]:[{aqi:55,pm25:12,observedAt:stamp(now-3*3600000+30000),label:'Age boundary',label_id:'Batas usia'},{aqi:10,pm25:3,observedAt:stamp(now-3600000),label:'Fresh',label_id:'Segar'}]:
   endpoint.endsWith('/alerts')?{available:!unavailable,publishedAt:stamp(now),alerts:unavailable?[]:[{id:'expiry',sent:stamp(now),expires:stamp(now+45000),headline:'Expires shortly',description:'Synthetic time-bound warning',sourceUrl:'https://www.bmkg.go.id'}]}:
   endpoint.endsWith('/earthquake')?{available:false,event:null}:{available:!unavailable,reportCount:0,fetchedAt:stamp(now)};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
 });
 try{
  await page.goto(base+'/?lang=en',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#source-status-line')?.textContent.includes('Data 4/5')&&!document.querySelector('#source-status-line')?.textContent.includes('refreshing'));
  await page.locator('#source-status > summary').click();
  assert.match(await page.locator('[data-source="weather"]').innerText(),/upcoming forecast/);
  const checked=await page.locator('#source-status-line').innerText();
  await page.evaluate(()=>{window.clockMutations={live:0,rows:0};for(const [id,key] of [['source-status-live','live'],['source-status-rows','rows']])new MutationObserver(list=>window.clockMutations[key]+=list.length).observe(document.getElementById(id),{childList:true,subtree:true,characterData:true});});
  const requests=apiCalls;await page.clock.runFor(5000);
  assert.deepEqual(await page.evaluate(()=>window.clockMutations),{live:0,rows:0},'clock ticks do not rewrite status or rows');
  assert.equal(apiCalls,requests,'clock does not fetch');
  await page.clock.runFor(60000);
  assert.match(await page.locator('[data-source="air"]').innerText(),/partly stale/);
  assert.match(await page.locator('#air-summary').textContent(),/stale/,'panel ages with the source verdict');
  assert.doesNotMatch(await page.locator('#alerts').textContent(),/Expires shortly/,'expired warning retires without another fetch');
  assert.equal(await page.locator('#source-status-line').innerText().then(s=>s.split('checked')[1]),checked.split('checked')[1],'assessment is not a new fetch timestamp');
  assert.equal(apiCalls,requests,'minute ageing reuses actual evidence');
  mode='empty';await page.locator('#refresh').evaluate(b=>b.click());
  await page.waitForFunction(()=>document.querySelector('#source-status-line')?.textContent.includes('Data 0/5')&&!document.querySelector('#source-status-line')?.textContent.includes('refreshing'));
  assert.doesNotMatch(await page.locator('#source-status-rows').innerText(),/NaN|undefined/);
  // All zones remain reachable on a phone; the header still shows only Jakarta.
  await page.locator('.city-controls > summary').click();await page.locator('.regional-times > summary').click();
  assert.equal(await page.locator('.regional-times-list .tz').count(),6);
  assert.match(await page.locator('.masthead-clock').getAttribute('aria-label'),/Device clock/);
  await page.clock.setFixedTime(new Date(Date.UTC(2026,5,1)));
  await page.evaluate(()=>clockZones());
  assert.match(await page.locator('.masthead-clock [data-tz="Australia/Sydney"] .tz-zone').innerText(),/AEST|GMT\+10/);
  assert.match(await page.locator('.masthead-clock [data-tz="Pacific/Auckland"] .tz-zone').innerText(),/NZST|GMT\+12/);
  assert.deepEqual(errors,[]);
  console.log('PASS source/clock browser: passive stability, minute ageing, warning expiry, real check stamp, unavailable envelopes and six reachable zones');
 }finally{await ctx.close();}
}
