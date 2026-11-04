import {censusDeadline} from './census-deadline.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {chromeDifference,plantedBandDetected} from './chrome-verdict.mjs';
const source=readFileSync(new URL('./chrome-census.mjs',import.meta.url),'utf8');
const implementation=source.slice(source.indexOf('async function falsify() {'),source.indexOf('\nasync function prepareBuild'));
async function run(mode){
 let reads=0,killed=0,closed=0;
 const baseline={routes:{'/':Object.fromEntries([360,1024,1440].map(w=>[w,{chrome:{top:w===360?23:38,topSel:'header'}}]))}};
 const context={CENSUS_BROWSER_ARGS:[],console:{log(){}},FALSIFY_BUILD:'/fixture',BASELINE:'/baseline',ROOT:'/repo',CHROME:'/chrome',process,path,setTimeout,clearTimeout,
  prepareBuild:async()=>'/fixture',plantBand:()=>true,rmSync(){},readFileSync:()=>JSON.stringify(baseline),heightFor:()=>900,chromeDifference,plantedBandDetected,
  spawn:()=>({stdout:{on(_name,callback){queueMicrotask(()=>callback('http://127.0.0.1:12345'));}},once(){},kill(){killed++;}}),
  chromium:{launch:async options=>{assert.equal(options.args,context.CENSUS_BROWSER_ARGS,"falsifier uses the shared browser backend");return {newContext:async()=>({newPage:async()=>({}),close:async()=>{}}),close:async()=>{closed++;}};}},
  measureCensus:async(_page,_url,w)=>{reads++;if(mode==='timeout')throw Error('navigation timeout');const base=w===360?23:38;
   if(mode==='unrelated')return {chrome:base,blocks:2};
   return {chrome:base+(reads>3&&mode==='positive'?24:0),blocks:reads>3&&mode==='positive'?2:1};},
 };
 const result=vm.runInNewContext(implementation+'\nfalsify()',context);
 try{await result;}finally{assert.equal(killed,1,'route server always stopped');assert.equal(closed,1,'browser always closed');}
 return reads;
}
assert.equal(await run('positive'),6,'three healthy controls plus three planted readings');
for(const mode of ['timeout','unrelated','survived'])await assert.rejects(()=>run(mode),/timeout|differs|not proved/,'the actual falsifier cannot pass '+mode);
console.log('PASS actual chrome falsifier: positive control, navigation failure, unrelated mismatch, surviving band and cleanup');

// Exercise the shipped reader, not a parallel approximation of its timeout.
const reader=source.slice(source.indexOf('async function measureCensus(page,'),source.indexOf('\nfunction heightFor('));
async function read(mode){
 let calls=0;
 const page={setViewportSize:async()=>{},goto:async()=>{},waitForFunction:async()=>{},waitForTimeout:ms=>new Promise(r=>setTimeout(r,ms)),evaluate:async()=>{
  calls++;
  if(mode==='font-stall'&&calls===1 || mode==='geometry-stall'&&calls>1)return new Promise(()=>{});
  if(mode==='font-reject'&&calls===1)throw Error('font load rejected');
  return {chrome:27,blocks:1,details:['header']};
 }};
 const context={censusDeadline,CENSUS_MEASUREMENT_TIMEOUT_MS:mode==='healthy'?1000:30,CENSUS:()=>{},Date};
 const fn=vm.runInNewContext(reader+'\nmeasureCensus',context);
 let watchdog;
 try{return await Promise.race([fn(page,'http://fixture/atlas',390,844),new Promise((_,reject)=>{watchdog=setTimeout(()=>reject(Error('test watchdog: reader did not reject its stalled measurement')),1500);})]);}
 finally{clearTimeout(watchdog);}
}
assert.equal((await read('healthy')).chrome,27);
for(const [mode,stage] of [['font-stall','font readiness'],['geometry-stall','geometry settling']])await assert.rejects(()=>read(mode),e=>e.code==='CENSUS_TIMEOUT'&&e.message.includes(stage)&&e.message.includes('@390px'));
await assert.rejects(()=>read('font-reject'),/font load rejected/,'font errors cannot be silently accepted');
console.log('PASS actual census reader: healthy geometry, bounded pending font/geometry, rejected font and route/width/stage diagnostics');

const sweep=source.slice(source.indexOf('async function census(build) {'),source.lastIndexOf('\nif (FALSIFY) {'));
let sweepReads=0,sweepClosed=0,sweepStopped=0;
const diagnostics=[];
const sweepContext={CENSUS_BROWSER_ARGS:[],console:{log(){},error:s=>diagnostics.push(s)},ONLY:null,ROUTES:['/'],BASELINE:'/baseline',ROOT:'/repo',CHROME:'/chrome',process:{execPath:process.execPath,stdout:{write(){}},exit(){throw Error('unexpected process exit');}},path,setTimeout,clearTimeout,
 readFileSync:()=>JSON.stringify({widths:[390,1440],routes:{}}),heightFor:()=>900,
 spawn:()=>({stdout:{on(_event,cb){queueMicrotask(()=>cb('http://127.0.0.1:12345'));}},once(){},kill(){sweepStopped++;}}),
 chromium:{launch:async options=>{assert.equal(options.args,sweepContext.CENSUS_BROWSER_ARGS,"full sweep uses the same shared browser backend");return {newContext:async()=>({newPage:async()=>({})}),close:async()=>{sweepClosed++;}};}},
 measureCensus:async()=>{sweepReads++;throw Object.assign(Error('census timeout at font readiness'),{code:'CENSUS_TIMEOUT'});},chromeDifference};
await assert.rejects(()=>vm.runInNewContext(sweep+'\ncensus("/fixture")',sweepContext),e=>e.code==='CENSUS_TIMEOUT');
assert.equal(sweepReads,1,'unreadable measurement aborts, never reuses the timed-out page');
assert.equal(sweepClosed,1);assert.equal(sweepStopped,1,'browser and route server close after timeout');
assert.ok(diagnostics.some(s=>s.includes('0/2 measurements')),'failure names the unverified denominator');
console.log('PASS actual census sweep: unreadable state fails with denominator and closes browser/server');
