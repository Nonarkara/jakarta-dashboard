import assert from 'node:assert/strict';
import {cleanReceptors,handleHazeReceptors,handleAsmcGraphic} from '../src/haze.js';
import {hazeSummary,receptorPoints} from '../public/haze-evidence.js';
const now=Date.UTC(2026,9,19,13),at=new Date(now-3600000).toISOString();
const raw={code:0,data:{items:[{timestamp:at,readings:{pm25_one_hourly:{north:0,south:10,east:null,west:'20',central:30}}}]}};
const good=cleanReceptors(raw,now);assert.equal(good.available,true);assert.equal(good.points.length,3);assert.equal(good.points[0].pm25,0);assert.equal(good.averagingPeriod,'1 hour');
assert.equal(cleanReceptors(raw,now+7200000).available,false,'exact three-hour observation expiry');
for(const timestamp of ['bad',new Date(now+600000).toISOString()])assert.equal(cleanReceptors({...raw,data:{items:[{...raw.data.items[0],timestamp}]}},now).available,false);
assert.equal(cleanReceptors({...raw,code:1},now).available,false);
assert.equal(receptorPoints(good,now).length,3);assert.equal(receptorPoints(good,now+7200000).length,0);
const fire=(age,confidence='high',lng=104,frp=10)=>({type:'Feature',geometry:{type:'Point',coordinates:[lng,-3]},properties:{observedAt:new Date(now-age*3600000).toISOString(),confidence,frp}});
const payload={type:'FeatureCollection',windowHours:24,fetchedAt:new Date(now).toISOString(),features:[fire(1),fire(7,'nominal',104.2,null),fire(13),fire(19),fire(25),fire(-1),fire(1,'high',null)]};
const ahead={...payload,features:[fire(-2/60)]};assert.equal(hazeSummary(ahead,{now}).bins[0],1,'tolerated clock skew stays in newest bin');
let s=hazeSummary(payload,{now});assert.equal(s.count,4);assert.deepEqual(s.bins,[1,1,1,1]);assert.equal(s.groups.length,1);assert.equal(s.frp,30);assert.equal(s.knownFrp,3);
assert.equal(hazeSummary(payload,{now,hours:6}).count,1);assert.equal(hazeSummary(payload,{now,highOnly:true}).count,3);
assert.equal(hazeSummary({...payload,features:[]},{now}).count,0,'healthy empty differs from outage');assert.equal(hazeSummary(null,{now}),null);assert.equal(hazeSummary(payload,{now:now+46*60000}),null);
const realFetch=globalThis.fetch,realCaches=globalThis.caches,realNow=Date.now;Date.now=()=>now;
let cached=null;globalThis.caches={default:{match:async()=>cached?.clone(),put:async(_,r)=>{cached=r.clone();}}};
try{
 globalThis.fetch=async url=>{assert.equal(url,'https://api-open.data.gov.sg/v2/real-time/api/pm25');return Response.json(raw);};
 assert.equal((await handleHazeReceptors()).status,200);
 const savedCache=globalThis.caches;globalThis.caches={default:{match:async()=>{throw Error('cache read');},put:async()=>{throw Error('cache write');}}};assert.equal((await handleHazeReceptors()).status,200,'cache infrastructure faults preserve healthy provider');globalThis.caches=savedCache;
 Date.now=()=>now+7200000;assert.equal((await handleHazeReceptors()).status,503,'cache revalidation refuses old readings');Date.now=()=>now;cached=null;
 for(const response of [new Response('html',{headers:{'content-type':'text/html'}}),new Response('x'.repeat(131073),{headers:{'content-type':'application/json'}}),Response.json({}, {status:429})]){globalThis.fetch=async()=>response;const r=await handleHazeReceptors();assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');}
 assert.equal((await handleAsmcGraphic(new Request('https://x/api?product=https://evil'))).status,400);
 globalThis.fetch=async url=>{assert.match(url,/^https:\/\/api.wis2.asmc.asean.org\/collections\/regional_haze\/items\/REGIONAL_HAZE_MAP\?f=json$/);return new Response(new Uint8Array([137,80,78,71,13,10,26,10]),{headers:{'content-type':'binary/octet-stream'}});};
 assert.equal((await handleAsmcGraphic(new Request('https://x/api?product=situation'))).status,200);
 cached=null;globalThis.fetch=async()=>new Response('<html>',{headers:{'content-type':'image/png'}});assert.equal((await handleAsmcGraphic(new Request('https://x/api?product=situation'))).status,503);
}finally{globalThis.fetch=realFetch;globalThis.caches=realCaches;Date.now=realNow;}
console.log('PASS haze evidence: time/confidence bins, zero vs outage, bounds, numeric receptors, exact expiry, fixed raster allowlist and signature/byte limits');
