import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {hydrologyModuleUrl} from './hydrology-test-module.mjs';
import {volumeM3,approachSector,createController} from '../public/water-traffic.js';
const {cleanGauge,parseDischargePredictions,handleHydrology}=await import(hydrologyModuleUrl);
const load=name=>JSON.parse(readFileSync(new URL('../public/data/jakarta-v1/'+name,import.meta.url),'utf8'));
const water=load('waterways.geojson'),cameras=load('traffic-cameras.geojson');
assert.equal(volumeM3(31.51,1),113436,'one-section constant-flow estimate, not a gauge-level conversion');
for(const args of [[null,1],[-1,1],[10,0],[10,Infinity],[NaN,1]])assert.equal(volumeM3(...args),null);
assert.deepEqual(approachSector(106.9,-6.6),['South','Selatan']);
const now=Date.parse('2026-10-12T16:00:00Z');
const base={id:'g',name:'Gauge',longitude:106.83,latitude:-6.2,water_level:0,unit_display:'m',reading_at:'2026-10-12T22:45:00'};
assert.equal(cleanGauge(base,now).levelM,0,'published zero level remains a real level');
const future=cleanGauge({...base,reading_at:'2027-11-11T09:00:00'},now);assert.equal(future.levelM,null);assert.equal(future.observedAt,null);assert.equal(future.dischargeM3s,null);
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
const playlist=await handleHydrology(new Request('https://atlas.test/api/atlas/traffic-stream?camera='+camera),env);assert.equal(playlist.status,200);assert.equal(playlist.headers.get('cache-control'),'no-store');assert.match(await playlist.text(),/asset=segment%2F123%2Ffile.ts/);assert.equal(fetched,1);
assert.equal((await handleHydrology(new Request('https://atlas.test/api/atlas/traffic-stream?camera='+camera+'&asset=../private'),env)).status,400);
assert.equal((await handleHydrology(new Request('https://atlas.test/api/atlas/traffic-stream?camera=00000000-0000-0000-0000-000000000000'),env)).status,404);assert.equal(fetched,1);
globalThis.fetch=originalFetch;
console.log('PASS water/traffic: source coverage, coordinates, future gauge rejection, predicted-flow tiers, volume arithmetic, cleanup order, camera access boundaries and fixed JAXA proxy');
