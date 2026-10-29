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
 const context={console:{log(){}},FALSIFY_BUILD:'/fixture',BASELINE:'/baseline',ROOT:'/repo',CHROME:'/chrome',process,path,setTimeout,clearTimeout,
  prepareBuild:async()=>'/fixture',plantBand:()=>true,rmSync(){},readFileSync:()=>JSON.stringify(baseline),heightFor:()=>900,chromeDifference,plantedBandDetected,
  spawn:()=>({stdout:{on(_name,callback){queueMicrotask(()=>callback('http://127.0.0.1:12345'));}},once(){},kill(){killed++;}}),
  chromium:{launch:async()=>({newContext:async()=>({newPage:async()=>({}),close:async()=>{}}),close:async()=>{closed++;}})},
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
