import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {censusDeadline} from './census-deadline.mjs';

export async function auditCensusReadiness(browser){
 const source=readFileSync(new URL('./chrome-census.mjs',import.meta.url),'utf8');
 const start=source.indexOf('const CENSUS ='),readerStart=source.indexOf('async function measureCensus(page,'),end=source.indexOf('\nfunction heightFor(');
 assert.ok(start>=0&&readerStart>start&&end>readerStart,'actual census extraction anchors must exist');
 const expression=source.slice(start,readerStart),reader=source.slice(readerStart,end);
 const oldReader=reader.replace(', polling: 100','');
 assert.notEqual(oldReader,reader,'timer polling falsifier anchor must not go stale');
 const compile=(code,timeout)=>vm.runInNewContext(expression+code+'\nmeasureCensus',{censusDeadline,CENSUS_MEASUREMENT_TIMEOUT_MS:timeout,Date});
 const ctx=await browser.newContext(),page=await ctx.newPage();
 try{
  await ctx.addInitScript(()=>{
   window.requestAnimationFrame=()=>0;
   let parsed=false,armed=false;
   Object.defineProperty(document,'readyState',{get(){
    if(!armed){armed=true;setTimeout(()=>{parsed=true;},100);}
    return parsed?'complete':'loading';
   }});
  });
  await page.route('https://census-fixture.invalid/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}header{height:24px}main{height:100px}</style><header>Data</header><main>Map workspace</main>'}));
  const actual=await compile(reader,5000)(page,'https://census-fixture.invalid/',390,844);
  assert.equal(actual.chrome,24,'parsed DOM and geometry remain measurable without animation frames');
  await assert.rejects(()=>compile(oldReader,1000)(page,'https://census-fixture.invalid/',390,844),e=>e.code==='CENSUS_TIMEOUT'&&e.message.includes('parsed document'),'restoring default RAF polling must fail the exact readiness guard');
 }finally{await ctx.close();}
 console.log('PASS real-browser census readiness: delayed-DOM fixture passes without animation frames; original RAF dependency fails');
}
