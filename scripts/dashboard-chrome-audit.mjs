import assert from 'node:assert/strict';
// The first-screen task needs an actual rendered map and reachable edge controls.
export async function auditDashboardChrome(browser,base,{shots='',archiveBase=''}={}){
 const records=[];
 for(const [width,height] of [[390,844],[1024,900],[1440,900]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width===390}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(archiveBase)await page.route('**/*.pmtiles*',r=>r.fetch({url:archiveBase+new URL(r.request().url()).pathname+new URL(r.request().url()).search}).then(response=>r.fulfill({response})));
  try{
   await page.goto(base+'/?lang=en',{waitUntil:'domcontentloaded',timeout:90000});
   for(const id of ['language','source-status','source-status-line','source-status-overview','source-status-rows','map-status','map-heading','basemap','clear-overlay'])assert.equal(await page.locator('#'+id).count(),1,'controller node retained: '+id);
   assert.equal(await page.locator('#city-navigation').evaluate(e=>e.tagName),'DETAILS','Menu retains native disclosure behavior');
   assert.equal(await page.locator('#city-navigation').evaluate(e=>!!e.closest('header.masthead')),true,'navigation shares the compact band');

   await page.waitForFunction(()=>document.getElementById('map-status')?.textContent.includes('ready'),null,{timeout:90000});
   const frame=page.frames().find(f=>f.url().includes('/atlas?'));
   assert.ok(frame,'the dashboard mounts its map');
   await frame.waitForFunction(()=>typeof mapInstance!=='undefined'&&mapInstance?.isStyleLoaded()&&mapInstance.getLayer('jkt-buildings')&&mapInstance.queryRenderedFeatures({layers:['jkt-buildings']}).length>0,null,{timeout:90000});
   await frame.waitForFunction(()=>{const e=document.getElementById('atlas-map-loading');return !e||!e.checkVisibility();},null,{timeout:15000});
   const inspect=()=>page.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
    const selectors=['.city-brand','.city-navigation > summary','#source-status > summary','.masthead-clock','#language-toggle','.city-controls > summary'];
    const controls=selectors.map(sel=>({sel,el:document.querySelector(sel)})).filter(({el})=>el?.checkVisibility()).map(({sel,el})=>({sel,...rect(el)}));
    const overlap=[];for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i],b=controls[j];if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)overlap.push(a.sel+' / '+b.sel);}
    const summary=document.querySelector('#source-status > summary'),r=summary.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    const popup=document.querySelector('.source-status-popover'),publisher=document.querySelector('.source-status-row strong');
    return{popover:popup?.checkVisibility()?rect(popup):null,publisher:publisher?.checkVisibility()?rect(publisher):null,width:innerWidth,pageWidth:document.documentElement.scrollWidth,header:rect(document.querySelector('.masthead')),map:rect(document.getElementById('city-map')),overlap,sourceVisible:summary.checkVisibility()&&r.x>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,sourceHittable:!!hit&&summary.contains(hit),mastheads:document.querySelectorAll('header.masthead').length};
   });
   const normal=await inspect();
   assert.equal(normal.pageWidth,width,'page fits viewport');assert.equal(normal.mastheads,1,'one real masthead');assert.deepEqual(normal.overlap,[],'primary controls never overlap');
   assert.ok(normal.sourceVisible&&normal.sourceHittable,'source trigger is visible and hittable');
   assert.ok(normal.header.height<=(width===390?28:40),'content-sized masthead');
   assert.ok(normal.map.height>=height*.6,'map remains the first-screen task');
   assert.ok(normal.map.y-normal.header.bottom<=2,'no repeated identity strip between masthead and map');
   await page.evaluate(()=>{const panel=document.querySelector('.map-panel'),frame=document.getElementById('city-map');window.savedMapEntry={panel:panel.style.cssText,frame:frame.style.cssText};document.querySelector('.map-heading').classList.remove('visually-hidden');panel.style.setProperty('grid-template-rows','18px minmax(0,1fr)','important');frame.style.setProperty('grid-row','2','important');});
   const extraStrip=await inspect();assert.ok(extraStrip.map.y-extraStrip.header.bottom>2,'restoring the old18px strip must fail the map-entry budget');
   await page.evaluate(()=>{document.querySelector('.map-heading').classList.add('visually-hidden');document.querySelector('.map-panel').style.cssText=window.savedMapEntry.panel;document.getElementById('city-map').style.cssText=window.savedMapEntry.frame;});
   if(width===390){
    await page.locator('#city-navigation > summary').click();
    await page.locator('#city-navigation [data-open="weather-detail-dialog"]').click();
    assert.equal(await page.locator('#weather-detail-dialog').isVisible(),true,'Menu opens weather');
    await page.keyboard.press('Escape');
    if(await page.locator('#city-navigation').getAttribute('open')!==null)await page.locator('#city-navigation > summary').click();
   }
   await page.locator('.city-controls > summary').click();
   for(const id of ['language','atlas-theme','basemap','clear-overlay'])assert.equal(await page.locator('#'+id).isVisible(),true,'retained control is reachable: '+id);
   const originalPitch=await frame.evaluate(()=>mapInstance.getPitch());
   await page.locator('.map-actions [data-view="2d"]').click();await frame.waitForFunction(()=>currentView==='2d'&&!mapInstance.isMoving()&&mapInstance.getPitch()===0,null,{polling:100});
   await page.locator('.map-actions [data-view="3d"]').click();await frame.waitForFunction(()=>currentView==='3d'&&!mapInstance.isMoving()&&mapInstance.getPitch()>=30,null,{polling:100});
   assert.ok(Math.abs(await frame.evaluate(()=>mapInstance.getPitch())-originalPitch)<.1,'3D control restores the actual camera pitch');
   await page.locator('.city-controls > summary').click();

   if(shots)await page.screenshot({path:shots+'/after-'+width+'.png'});
   await page.locator('#source-status > summary').focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('#source-status-rows').isVisible(),true,'complete ledger is reachable');
   assert.equal(await page.locator('#refresh').isVisible(),true,'evidence and refresh action remain together');
   const opened=await inspect();assert.ok(opened.popover&&opened.popover.x>=8&&opened.popover.right<=width-8&&opened.popover.bottom<=height-8,'ledger fits all viewport edges');assert.ok(opened.publisher&&opened.publisher.x>=opened.popover.x&&opened.publisher.right<=opened.popover.right,'publisher text is not clipped');assert.equal(opened.map.height,normal.map.height,'opening evidence cannot shrink the map');
   if(shots)await page.screenshot({path:shots+'/after-source-open-'+width+'.png'});
   await page.locator('.source-status-popover').evaluate(e=>e.style.left='-100px');
   assert.ok((await inspect()).popover.x<0,'negative-edge clipping detector bites');
   await page.locator('.source-status-popover').evaluate(e=>e.style.removeProperty('left'));
   await page.keyboard.press('Escape');assert.equal(await page.locator('#source-status').getAttribute('open'),null);
   // The old nesting hid the summary inside a closed Controls drawer. The
   // same painted-state test must reject it, without touching the server.
   await page.evaluate(()=>{window.statusOriginalParent=document.getElementById('source-status').parentElement;document.querySelector('.city-controls').open=false;document.querySelector('.utilities').append(document.getElementById('source-status'));});
   const hidden=await inspect();assert.equal(hidden.sourceVisible,false,'original invisible-trigger regression is detected');
   await page.evaluate(()=>window.statusOriginalParent.prepend(document.getElementById('source-status')));
   // The prior duplicate version text collided with Menu without overflow.
   await page.evaluate(()=>{const a=document.querySelector('.city-brand'),m=document.querySelector('.city-navigation > summary');if(m.checkVisibility()){const r=m.getBoundingClientRect();a.style.transform='translateX('+(r.x-a.getBoundingClientRect().x)+'px)';}});
   if(width===390)assert.ok((await inspect()).overlap.length>0,'overlap detector bites even if page width fits');
   await page.evaluate(()=>document.querySelector('.city-brand').removeAttribute('style'));
   await page.locator('#source-status > summary').click();
   // Increase the type that actually rendered, including fixed px house tokens.
   await page.evaluate(()=>{const rows=[...document.body.querySelectorAll('*')].filter(e=>e.checkVisibility()).map(e=>({e,size:parseFloat(getComputedStyle(e).fontSize),line:parseFloat(getComputedStyle(e).lineHeight)}));for(const {e,size,line} of rows){if(Number.isFinite(size))e.style.setProperty('font-size',size*2+'px','important');if(Number.isFinite(line))e.style.setProperty('line-height',line*2+'px','important');}});
   await page.waitForTimeout(200);
   const enlarged=await inspect();
   assert.ok(enlarged.popover&&enlarged.popover.x>=8&&enlarged.popover.right<=width-8&&enlarged.popover.bottom<=height-8,'enlarged ledger fits all edges');assert.ok(enlarged.publisher&&enlarged.publisher.x>=enlarged.popover.x&&enlarged.publisher.right<=enlarged.popover.right,'enlarged publisher is not clipped');
   assert.equal(enlarged.pageWidth,width,'doubled text fits page');assert.deepEqual(enlarged.overlap,[],'enlarged controls remain distinct');assert.ok(enlarged.sourceVisible&&enlarged.sourceHittable,'enlarged trigger remains usable');
   assert.ok(enlarged.map.height>=height*.6,'source reading cannot steal map height at enlarged text');
   assert.equal(await page.locator('#refresh').isVisible(),true,'refresh remains reachable with enlarged text');
   if(shots)await page.screenshot({path:shots+'/after-enlarged-'+width+'.png'});
   records.push({width,height,normal,opened,enlarged,map:await frame.evaluate(()=>({styleLoaded:mapInstance.isStyleLoaded(),pitch:mapInstance.getPitch(),renderedBuildings:mapInstance.queryRenderedFeatures({layers:['jkt-buildings']}).length})),errors});
   assert.deepEqual(errors,[]);
  }finally{if(archiveBase)await page.unrouteAll({behavior:"wait"});await context.close();}
 }
 console.log('PASS dashboard chrome: three viewports, real buildings, overlap/hit checks, Menu/map controls, source action, enlarged text and original-fault/map-entry falsifiers');
 return records;
}
