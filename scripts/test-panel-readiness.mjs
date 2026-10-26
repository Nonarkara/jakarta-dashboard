import assert from 'node:assert/strict';
const {panelReadiness}=await import(process.env.PANEL_READINESS_MODULE||'./panel-readiness.mjs');
const saved=globalThis.document,realNow=Date.now,realTimeout=globalThis.setTimeout;
// A delayed poll must not accidentally turn a false-ready mutant into a timeout.
// Advance the source clock explicitly and yield between callbacks, as a browser
// does between timer tasks and their promise continuations.
let now=0,queue=[],pump=null,sequence=0;
function schedule(){if(pump!==null)return;pump=setImmediate(()=>{pump=null;queue.sort((a,b)=>a.at-b.at||a.order-b.order);const job=queue.shift();if(!job)return;now=job.at;job.fn();if(queue.length)schedule();});}
Date.now=()=>now;
globalThis.setTimeout=(fn,delay)=>{const job={fn,at:now+delay,order:sequence++};queue.push(job);schedule();return job;};
function fixture(){const state={text:'Ready',busy:false,details:[],controls:[{tagName:'SUMMARY',textContent:'Controls'}],pending:[]};const body={get childNodes(){return state.nodes||[];},get textContent(){return state.text;},getAttribute:()=>String(state.busy),querySelectorAll:q=>q==='details'?state.details:q==='[aria-busy="true"]'?state.pending:q==='p,output,[role="status"]'?[]:state.controls};globalThis.document={getElementById:()=>body};return state;}
const wait=opts=>panelReadiness({pollMs:2,quietMs:20,timeoutMs:800,...opts});
try{
 const s=fixture();s.busy=true;setTimeout(()=>s.busy=false,65);const result=await wait();assert.ok(result.ready&&result.elapsedMs>=80,'unchanged pending requests must not pass as settled');
 const outage=fixture();outage.text='Source unavailable. No zero is assumed.';outage.controls=[];assert.equal((await wait()).ready,true,'explicit outage is a terminal state, not fabricated data');
 const stalled=fixture();stalled.busy=true;const unavailable=await wait({timeoutMs:35});assert.equal(unavailable.ready,false);assert.equal(unavailable.reason,'sources still loading');
 const plain=fixture();plain.text='Loading the derived view…';plain.controls=[];assert.equal((await wait({timeoutMs:35})).ready,false,'plain root loading text is never a ready panel');
 const raw=fixture();raw.text='Radar Himawari Loading the model timeline…';raw.nodes=[{nodeType:3,textContent:'Loading the model timeline…'}];assert.equal((await wait({timeoutMs:35})).ready,false,'direct loading text after controls is never ready');
 const nested=fixture();function disclosure(run){let open=false;return {get open(){return open;},set open(v){if(v&&!open){open=true;run();}}};}
 nested.details.push(disclosure(()=>{nested.busy=true;setTimeout(()=>nested.details.push(disclosure(()=>{setTimeout(()=>{nested.controls.push({tagName:'BUTTON',textContent:'Lazy control'});nested.busy=false;},15);})),15);}));
 const expanded=await wait({expand:true});assert.equal(expanded.ready,true);assert.equal(expanded.opened,2,'newly mounted nested disclosures must also open');assert.equal(expanded.controls,2,'lazy controls exist before measurement');
 const equal=fixture();let lastChange;setTimeout(()=>{equal.text='Other';lastChange=Date.now();},10);const changed=await wait({quietMs:30});assert.equal(changed.ready,true);assert.ok(Date.now()-lastChange>=29,'same-length replacement must restart the quiet interval');
 globalThis.document={getElementById:()=>null};assert.equal((await wait({timeoutMs:15})).reason,'panel absent');
 console.log('PASS panel readiness: unchanged pending sources, terminal timeout, recursive lazy controls, equal-length changes and missing panel');
}finally{globalThis.document=saved;Date.now=realNow;globalThis.setTimeout=realTimeout;queue=[];if(pump!==null)clearImmediate(pump);}
