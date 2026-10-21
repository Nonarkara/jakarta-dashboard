import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {coastalModuleUrl} from './coastal-test-module.mjs';
const {cleanCoastal,handleCoastal}=await import(coastalModuleUrl);
const raw=JSON.parse(readFileSync(new URL('../data/source-evidence/water-candidates-2026-10-15/bmkg-priok.json',import.meta.url),'utf8'));
const now=Date.parse('2026-10-15T15:50:00Z');
const good=cleanCoastal(raw,now);
assert.equal(good.available,true);assert.equal(good.points.length,40,'41 publisher points include the valid_to boundary, which is excluded');
assert.equal(good.datum,null);assert.match(good.datumNote,/not added to tide/);
assert.equal(good.station.lng,106.882294878);assert.equal(good.station.lat,-6.103879776);
assert.ok(good.points.some(p=>p.tideM<0),'negative predicted tide is admitted');
const copy=()=>structuredClone(raw);
for(const bad of [null,{}, {...raw,code:'XJ002'}, {...raw,issued:'2026-10-16 00:00 UTC'}, {...raw,valid_to:raw.valid_from}, {...raw,valid_from:'2026-02-31 00:00 UTC'}, {...raw,forecast_day1:Array(97).fill(raw.forecast_day1[0])}])assert.equal(cleanCoastal(bad,now).available,false);
let b=copy();b.forecast_day1[0].tides=0;assert.equal(cleanCoastal(b,now).points[0].tideM,0);
for(const value of [null,'',NaN,Infinity,'0',21]){b=copy();b.forecast_day1[0].tides=value;assert.ok(!cleanCoastal(b,now).points.some(p=>p.validAt==='2026-10-15T00:00:00Z'));}
b=copy();b.forecast_day1[0].wave_height=null;b.forecast_day1[0].wind_speed='';assert.equal(cleanCoastal(b,now).points[0].waveHeightM,null);assert.equal(cleanCoastal(b,now).points[0].windSpeedKnots,null);
b=copy();b.forecast_day1.reverse();b.forecast_day1.push(b.forecast_day1[0]);assert.equal(cleanCoastal(b,now).points.length,40);assert.equal(cleanCoastal(b,now).points[0].validAt,'2026-10-15T00:00:00Z');
assert.equal(cleanCoastal(raw,Date.parse('2026-10-18T00:00:00Z')).stale,true);
assert.equal(cleanCoastal(raw,Date.parse('2026-10-14T23:00:00Z')).available,false,'not yet valid forecast is not current');
const oldFetch=globalThis.fetch,oldCaches=globalThis.caches,oldNow=Date.now;
Date.now=()=>now;
let calls=0,stored=null,readFault=false,writeFault=false;
globalThis.caches={default:{match:async()=>{if(readFault)throw Error('read');return stored?.clone();},put:async(_,r)=>{if(writeFault)throw Error('write');stored=r.clone();}}};
globalThis.fetch=async url=>{calls++;assert.equal(url,'https://maritim.bmkg.go.id/marine2026-data/pelabuhan/XJ001.json');return Response.json(raw);};
try{
 assert.equal((await handleCoastal()).status,200);assert.equal(calls,1);
 assert.equal((await handleCoastal()).status,200);assert.equal(calls,1,'valid cache used');
 Date.now=()=>Date.parse('2026-10-18T00:00:00Z');
 stored=Response.json({savedAt:Date.now(),raw});
 let r=await handleCoastal();assert.equal(r.status,503);assert.equal((await r.json()).stale,true);assert.equal(calls,2,'expired cached interval revalidated and retried');
 Date.now=()=>now;stored=null;readFault=true;writeFault=true;
 assert.equal((await handleCoastal()).status,200,'cache infrastructure fault does not erase provider');
 readFault=false;writeFault=false;stored=null;
 for(const response of [Response.json({}),new Response('x'.repeat(131073),{headers:{'content-type':'application/json'}}),new Response('oops',{headers:{'content-type':'text/html'}}),new Response('no',{status:429})]){
  globalThis.fetch=async()=>response;
  r=await handleCoastal();assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).available,false);
 }
 globalThis.fetch=async()=>{throw Error('offline');};r=await handleCoastal();assert.equal(r.status,503);assert.match((await r.json()).error,/no zero tide/);
}finally{globalThis.fetch=oldFetch;globalThis.caches=oldCaches;Date.now=oldNow;}
console.log('PASS BMKG coastal forecast: identity, bounded dates/rows/bytes, strict numbers, zero/negative tides, sorted deduplication, unknown datum, cache revalidation and explicit outages');
