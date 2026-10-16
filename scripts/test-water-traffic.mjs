import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {hydrologyModuleUrl} from './hydrology-test-module.mjs';
import {volumeM3,approachSector,createController,readObservationResponse} from '../public/water-traffic.js';
const {cleanGauge,parseDischargePredictions,handleHydrology}=await import(hydrologyModuleUrl);
const load=name=>JSON.parse(readFileSync(new URL('../public/data/jakarta-v1/'+name,import.meta.url),'utf8'));
const water=load('waterways.geojson'),cameras=load('traffic-cameras.geojson');
assert.equal(volumeM3(31.51,1),113436,'one-section constant-flow estimate, not a gauge-level conversion');
for(const args of [[null,1],[-1,1],[10,0],[10,Infinity],[NaN,1]])assert.equal(volumeM3(...args),null);
assert.deepEqual(approachSector(106.9,-6.6),['South','Selatan']);
const now=Date.parse('2026-10-12T16:00:00Z');
const base={id:'g',name:'Gauge',longitude:106.83,latitude:-6.2,water_level:0,unit_display:'m',reading_at:'2026-10-12T22:45:00'};
const freshRow=cleanGauge(base,now);assert.equal(freshRow.levelM,0,'published zero level remains a real level');
assert.equal(freshRow.levelState,'fresh','a 15-minute-old reading is current');assert.equal(freshRow.fresh,true);
const stale=cleanGauge({...base,reading_at:'2020-01-01T09:00:00'},now);
assert.equal(stale.levelM,0,'dated evidence is preserved, not discarded');assert.equal(stale.levelState,'stale');assert.equal(stale.fresh,false);
assert.equal(cleanGauge({...base,reading_at:'2026-10-12T09:00:00'},now).levelState,'stale','older than three hours is dated evidence');
const noLevel=cleanGauge({...base,unit_display:'cm'},now);assert.equal(noLevel.levelM,null);assert.equal(noLevel.levelState,'unknown');
const future=cleanGauge({...base,reading_at:'2027-11-11T09:00:00'},now);assert.equal(future.levelM,null);assert.equal(future.observedAt,null);assert.equal(future.dischargeM3s,null);assert.equal(future.levelState,'unknown');
assert.equal(cleanGauge({...base,latitude:106.83},now),null,'transposed coordinates rejected');
assert.equal(cleanGauge(null,now),null);
const prediction='<li class="completed"><h4>PDA PANUS DEPOK</h4><span>13 Oktober 2026 05.00</span><h4>49.78<sup>m<sup>3</sup>/s</sup></h4></li>';
assert.deepEqual(parseDischargePredictions(prediction).map(p=>[p.dischargeM3s,p.validAt,p.tier]),[[49.78,'2026-10-13T05:00:00+07:00','publisher-prediction']]);
assert.equal(parseDischargePredictions(prediction.replace('49.78','NaN')).length,0);
const raw=JSON.parse(gunzipSync(readFileSync(new URL('../data/source-evidence/networks-2026-10-12/osm-waterways.json.gz',import.meta.url))));
assert.equal(water.count,water.features.length);assert.equal(water.count,raw.elements.length,'every mapped way retained');assert.equal(water.sourceAsOf,raw.osm3s.timestamp_osm_base);
assert.ok(water.features.some(f=>f.properties.kind==='drain'));assert.ok(water.features.some(f=>f.properties.kind==='stream'));assert.ok(water.features.some(f=>f.geometry.type==='Polygon'));
for(const f of water.features){assert.equal(f.properties.flowDirection,'not-measured');assert.ok(f.properties.lengthM===null||f.properties.lengthM>0);}
assert.equal(cameras.count,cameras.sourceRecordCount-cameras.excluded);assert.equal(new Set(cameras.features.map(f=>f.properties.id)).size,cameras.count);
for(const f of cameras.features){assert.equal(f.properties.availability,'not-verified');assert.ok(f.geometry.coordinates[0]>106&&f.geometry.coordinates[0]<108);assert.equal(new URL(f.properties.playerUrl).hostname,'cctv.balitower.co.id');assert.ok(!/token=|password=|username=/.test(f.properties.playerUrl));}
// Source cleanup must remove every dependent layer before its shared source.
const layers=new Map(),sources=new Map();
const map={getLayer:id=>layers.get(id),getSource:id=>sources.get(id),removeLayer:id=>layers.delete(id),removeSource:id=>{assert.ok(![...layers.values()].some(l=>l.source===id));sources.delete(id);},off(){}};
const controller=createController(map,{text:e=>e,active:()=>null,buildTag:'test'});
sources.set('network-water-lines',{});for(const id of ['network-water-fill','network-water-lines','network-water-labels'])layers.set(id,{source:'network-water-lines'});controller.clear();assert.equal(layers.size,0);assert.equal(sources.size,0);
// Fixed provider-only tile proxy: invalid dates/coordinates never fetch arbitrary URLs.
const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('invalid request must not fetch');};
for(const query of ['product=private&date=2026101212&z=8&x=203&y=132','product=OUTFLW&date=bad&z=8&x=203&y=132','product=OUTFLW&date=2026101212&z=30&x=0&y=0'])assert.equal((await handleHydrology(new Request('https://atlas.test/api/atlas/jaxa-tile?'+query),{})).status,400);
const camera='ebd0c75a-bba8-41f0-a5da-72bec7af707f';
const env={ASSETS:{fetch:async()=>Response.json({streams:[{url:`https://jmlive.jasamarga.com/hls/2/${camera}/index.m3u8`}]})}};
let fetched=0;globalThis.fetch=async url=>{fetched++;assert.equal(new URL(url).hostname,'jmlive.jasamarga.com');return new Response('#EXTM3U\n#EXTINF:2,\nsegment/123/file.ts\n');};
const playlist=await handleHydrology(new Request('https://atlas.test/api/atlas/traffic-stream?camera='+camera),env);assert.equal(playlist.status,200);assert.equal(playlist.headers.get('cache-control'),'no-store');assert.match(await playlist.text(),/segment\/123\/file\.ts/);assert.equal(fetched,1);
assert.equal((await handleHydrology(new Request('https://atlas.test/api/atlas/traffic-stream?camera='+camera+'&asset=../private'),env)).status,400);
assert.equal((await handleHydrology(new Request('https://atlas.test/api/atlas/traffic-stream?camera=00000000-0000-0000-0000-000000000000'),env)).status,404);assert.equal(fetched,1);
globalThis.fetch=originalFetch;
// ── hydrology envelope reliability: outage, partial, malformed, cache faults ──
const gaugeEnvelope=rows=>({response:rows.map((r,i)=>({id:'s'+i,name:r.name||'Gauge '+(i+1),longitude:106.83,latitude:-6.2,water_level:r.level,unit_display:'m',reading_at:r.at}))});
const wibNow=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,16);
// Prediction cards are WIB; build one an hour ahead so it is current, and keep a dated one to prove age is gated.
const ID_MONTHS=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const wibCard=(ms,flow)=>{const d=new Date(ms+7*3600000);return '<li class="completed"><h4>PDA PANUS DEPOK</h4><span>'+d.getUTCDate()+' '+ID_MONTHS[d.getUTCMonth()]+' '+d.getUTCFullYear()+' '+String(d.getUTCHours()).padStart(2,'0')+'.'+String(d.getUTCMinutes()).padStart(2,'0')+'</span><h4>'+flow+'<sup>m<sup>3</sup>/s</sup></h4></li>';};
const predictionHtml=wibCard(Date.now()+3600000,'49.78');
const stalePredictionHtml=wibCard(Date.now()-3*86400000,'49.78');
let store=new Map(),cacheReadFault=false,cacheWriteFault=false;
globalThis.caches={default:{
  match:async key=>{if(cacheReadFault)throw Error('cache read fault');const hit=store.get(String(key));return hit?hit.clone():undefined;},
  put:async(key,value)=>{if(cacheWriteFault)throw Error('cache write fault');store.set(String(key),value);}
}};
const realFetch=globalThis.fetch;
let fetchCalls=0;
const mockHydrology=(gauges,html)=>{globalThis.fetch=async url=>{fetchCalls++;if(String(url).includes('GetAwlrLastReading')){if(gauges instanceof Error)throw gauges;return new Response(gauges,{headers:{'content-type':'application/json'}});}if(html instanceof Error)throw html;return new Response(html,{headers:{'content-type':'text/html'}});};};
// outage: neither branch answers → 503, no-store, nothing cached
mockHydrology(new Error('publisher down'),new Error('publisher down'));
let outage=await handleHydrology(new Request('https://atlas.test/api/atlas/hydrology'),{});
assert.equal(outage.status,503,'total outage is not an empty 200');
assert.equal(outage.headers.get('cache-control'),'no-store','an outage is never cached');
assert.equal(store.size,0);
const outageBody=await outage.json();assert.equal(outageBody.available,false);
// fresh gauges + predictions → 200 with freshLevels, availability flags and the policy
mockHydrology(JSON.stringify(gaugeEnvelope([{name:'Katulampa',level:1.2,at:wibNow()},{name:'Depok',level:2.4,at:'2020-01-01T09:00:00'}])),predictionHtml);
let full=await handleHydrology(new Request('https://atlas.test/api/atlas/hydrology'),{});
assert.equal(full.status,200);const fullBody=await full.json();
assert.equal(fullBody.available,true);assert.equal(fullBody.levelsAvailable,true);assert.equal(fullBody.predictionsAvailable,true);
assert.equal(fullBody.freshLevels,1,'only the fresh reading counts as current');
assert.equal(fullBody.stations[1].levelState,'stale');
assert.match(fullBody.freshnessPolicy,/three hours/i);
assert.equal(full.headers.get('cache-control'),'public,max-age=300');
// a days-old cached prediction page with no fresh gauge must not read as available
const savedStore=store; store=new Map();
mockHydrology(JSON.stringify(gaugeEnvelope([{name:'Depok',level:2.4,at:'2020-01-01T09:00:00'}])),stalePredictionHtml);
const stalePredictionOnly=await (await handleHydrology(new Request('https://atlas.test/api/atlas/hydrology'),{})).json();
assert.equal(stalePredictionOnly.available,false,"stale predictions alone are not current"); assert.equal(stalePredictionOnly.predictions[0].current,false);
store=savedStore;
assert.equal(store.size,1,'a valid response is cached');
// publisher down again → the cached copy still serves
const callsBefore=fetchCalls;mockHydrology(new Error('publisher down'),new Error('publisher down'));
const cachedHit=await handleHydrology(new Request('https://atlas.test/api/atlas/hydrology'),{});
assert.equal(cachedHit.status,200,'a cache hit survives a publisher outage');assert.equal(fetchCalls,callsBefore,'the cache answered without the publisher');
// cache read fault → treated as a miss, data still fetched and served
store=new Map();cacheReadFault=true;
mockHydrology(JSON.stringify(gaugeEnvelope([{name:'Katulampa',level:1.2,at:wibNow()}])),'<ul></ul>');
const readFault=await handleHydrology(new Request('https://atlas.test/api/atlas/hydrology'),{});
assert.equal(readFault.status,200,'a cache read fault is not a publisher fault');assert.ok(fetchCalls>callsBefore);
cacheReadFault=false;
// cache write fault → fetched data still served, not turned into 503
cacheWriteFault=true;store=new Map();
mockHydrology(JSON.stringify(gaugeEnvelope([{name:'Katulampa',level:1.2,at:wibNow()}])),'<ul></ul>');
const writeFault=await handleHydrology(new Request('https://atlas.test/api/atlas/hydrology'),{});
assert.equal(writeFault.status,200,'a cache write fault must not discard fetched data');
assert.equal(store.size,0);const writeFaultBody=await writeFault.json();assert.equal(writeFaultBody.freshLevels,1);
cacheWriteFault=false;
// malformed-but-200 gauge payload parses to zero stations → levelsAvailable false;
// with no predictions either, it is an outage, never an all-clear 200
mockHydrology('{"response":"garbage"}','<ul></ul>');
const malformed=await handleHydrology(new Request('https://atlas.test/api/atlas/hydrology'),{});
assert.equal(malformed.status,503,'malformed-but-200 data with nothing valid is an outage');
// partial: gauges fail, predictions parse → 200 with the usable branch and its failure state
mockHydrology(new Error('gauge branch down'),predictionHtml);
const partial=await handleHydrology(new Request('https://atlas.test/api/atlas/hydrology'),{});
assert.equal(partial.status,200);const partialBody=await partial.json();
assert.equal(partialBody.available,true);assert.equal(partialBody.levelsAvailable,false);assert.equal(partialBody.predictionsAvailable,true);
// Stale-only publisher response retains old observations without claiming current availability.
store=new Map();
mockHydrology(JSON.stringify(gaugeEnvelope([{name:'Dated station',level:2.4,at:'2020-01-01T09:00:00'}])),'<ul></ul>');
const staleOnly=await handleHydrology(new Request('https://atlas.test/api/atlas/hydrology'),{});
assert.equal(staleOnly.status,503);assert.equal(staleOnly.headers.get('cache-control'),'no-store');
const datedBody=await readObservationResponse(staleOnly,'/api/atlas/hydrology');
assert.equal(datedBody.available,false);assert.equal(datedBody.freshLevels,0);assert.equal(datedBody.stations[0].levelM,2.4);assert.equal(datedBody.stations[0].levelState,'stale');
assert.equal(store.size,0,'stale-only envelope is not cached as current data');
for(const bad of [{error:'down'}, {...datedBody,freshLevels:1}, {...datedBody,stations:[{...datedBody.stations[0],fresh:true}]}, {...datedBody,stations:[{...datedBody.stations[0],lng:Infinity}]}])await assert.rejects(readObservationResponse(Response.json(bad,{status:503}),'/api/atlas/hydrology'));
await assert.rejects(readObservationResponse(Response.json(datedBody,{status:404}),'/api/atlas/hydrology'));
await assert.rejects(readObservationResponse(Response.json(datedBody,{status:503}),'/api/atlas/jaxa-water'));
// Drive the real water lens to prove stale values stay visible but current count is zero.
{
  const oldDocument=globalThis.document,oldOption=globalThis.Option;
  function node(tag='div'){return {tagName:tag,children:[],textContent:'',value:'',append(...nodes){this.children.push(...nodes);for(const n of nodes)if(n&&typeof n==='object')n.parentElement=this;},replaceChildren(...nodes){this.children=[];this.append(...nodes);},setAttribute(){},addEventListener(){},scrollIntoView(){}};}
  globalThis.document={createElement:node,getElementById:()=>node()};globalThis.Option=class{constructor(text,value){this.textContent=text;this.value=value;}};
  globalThis.fetch=async path=>String(path).includes('waterways.geojson')?Response.json(water):String(path)==='/api/atlas/hydrology'?Response.json(datedBody,{status:503}):Response.json({}, {status:503});
  const testMap={addSource(){},addLayer(){},getLayer(){},getSource(){},on(){},off(){},flyTo(){}};
  const body=node();const ui=createController(testMap,{text:e=>e,active:()=> 'waterways',buildTag:'test'});
  await ui.show('waterways',body);
  const text=n=>(n.textContent||'')+' '+(n.children||[]).map(text).join(' ');
  assert.match(text(body),/0 current levels/);assert.match(text(body),/1 kept as dated evidence/);assert.match(text(body),/Dated station/);assert.match(text(body),/2.4 m/);
  ui.clear();globalThis.document=oldDocument;globalThis.Option=oldOption;
}
globalThis.fetch=realFetch;delete globalThis.caches;
// observation client: every request is bounded and cancelled on exit
{
  const layers2=new Map(),sources2=new Map();
  const map2={getLayer:id=>layers2.get(id),getSource:id=>sources2.get(id),removeLayer:id=>layers2.delete(id),removeSource:id=>sources2.delete(id),off(){},on(){},flyTo(){},addSource(){},addLayer(){},getZoom:()=>10};
  const controller2=createController(map2,{text:e=>e,active:()=>null,buildTag:'test'});
  let observed=null;const realFetch2=globalThis.fetch;
  globalThis.fetch=(url,init)=>{
    observed=init||{};
    return new Promise((_,reject)=>{observed.signal?.addEventListener('abort',()=>reject(new Error('aborted')));});
  };
  const body2={replaceChildren(){},append(){},textContent:''};
  controller2.show('waterways',body2).catch(()=>{});
  await new Promise(r=>setTimeout(r,10));
  assert.ok(observed?.signal,'the observation client passes an abort signal to every fetch');
  controller2.clear();
  globalThis.fetch=realFetch2;
}
console.log('PASS water/traffic: source coverage, coordinates, future gauge rejection, predicted-flow tiers, volume arithmetic, cleanup order, camera access boundaries and fixed JAXA proxy');
