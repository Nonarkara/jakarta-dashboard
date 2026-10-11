import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeForecast,normalizeCap,normalizeQuake,handleJakarta} from '../src/jakarta.js';
const code='31.71.03.1001',now=new Date().toISOString(),future=new Date(Date.now()+3600000).toISOString();
const fixture={lokasi:{adm4:code,desa:'Kemayoran',lat:-6.16,lon:106.84,timezone:'Asia/Jakarta'},data:[{cuaca:[[{utc_datetime:future,analysis_date:now,t:32,hu:60,ws:10,tcc:40,weather_desc:'Cerah',weather_desc_en:'Sunny'}]]}]};
assert.equal(normalizeForecast(fixture,code).forecast[0].temperatureC,32);
assert.equal(normalizeForecast(fixture,'wrong'),null);
fixture.data[0].cuaca[0][0].analysis_date='2020-01-01T00:00:00';assert.equal(normalizeForecast(fixture,code),null);
fixture.data[0].cuaca[0][0].analysis_date=now;fixture.data[0].cuaca[0][0].t=null;assert.equal(normalizeForecast(fixture,code).forecast[0].temperatureC,null);
const cap={alert:{identifier:'test',status:'Actual',msgType:'Alert',sent:now,info:{effective:now,expires:future,headline:'Jakarta',area:{polygon:'-6.2,106.8 -6.3,106.9 -6.1,106.9'}}}};
assert.equal(normalizeCap(cap,'https://www.bmkg.go.id/alerts/nowcast/id/test_alert.xml')[0].geometry.features[0].geometry.coordinates[0][0][0],106.8,'CAP lat/lng converted');
cap.alert.msgType='Cancel';assert.equal(normalizeCap(cap,'x').length,0,'cancelled warnings not active');cap.alert.msgType='Alert';cap.alert.info.expires='2020-01-01T00:00:00Z';assert.equal(normalizeCap(cap,'x').length,0,'expired warnings removed');
assert.equal(normalizeQuake({Infogempa:{gempa:{Coordinates:'-6.2,106.8',DateTime:now,Magnitude:'5.2',Kedalaman:'10 km'}}}).lng,106.8);
assert.equal(normalizeQuake({Infogempa:{gempa:{Coordinates:'bad',DateTime:now}}}),null);
const originalFetch=globalThis.fetch,originalCaches=globalThis.caches;
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
try {
 globalThis.fetch=async()=>new Response('<rss><channel><lastBuildDate>'+new Date().toUTCString()+'</lastBuildDate></channel></rss>');
 let r=await handleJakarta(new Request('https://test/api/jakarta/alerts'));assert.equal(r.status,200);assert.equal((await r.json()).alerts.length,0,'valid empty bulletin distinct from failure');
 globalThis.fetch=async()=>new Response('forbidden',{status:403});r=await handleJakarta(new Request('https://test/api/jakarta/alerts'));assert.equal(r.status,503);assert.equal((await r.json()).available,false);
 globalThis.fetch=async()=>Response.json({result:{type:'FeatureCollection',features:[]}});r=await handleJakarta(new Request('https://test/api/jakarta/flood-reports'));let d=await r.json();assert.equal(d.state,'no-reports-returned');assert.equal(d.reportCount,0);
 globalThis.fetch=async()=>Response.json({error:'upstream failure'});r=await handleJakarta(new Request('https://test/api/jakarta/flood-reports'));d=await r.json();assert.equal(d.reportCount,null);assert.equal(r.status,503);
} finally{globalThis.fetch=originalFetch;globalThis.caches=originalCaches;}
const transit=JSON.parse(readFileSync(new URL('../public/data/jakarta-v1/transit.json',import.meta.url)));
assert.equal(transit.routeCount,transit.routes.length);assert.equal(transit.license,'CC BY 4.0');
for(const r of transit.routes){const d=JSON.parse(readFileSync(new URL('../public'+r.detail,import.meta.url)));assert.equal(d.id,r.id);for(const dir of d.directions)for(const stop of dir.stops){assert.ok(stop.lng>105&&stop.lng<108&&stop.lat> -8&&stop.lat< -5);}}
for(const name of ['health','schools']){const d=JSON.parse(readFileSync(new URL('../public/data/jakarta-v1/'+name+'.geojson',import.meta.url)));assert.equal(d.count,d.features.length);assert.ok(d.features.every(f=>Object.keys(f.properties).every(k=>['name','kind','kelurahan','kecamatan','kota'].includes(k))));}
console.log('PASS Jakarta: forecast identity/age/null, CAP cancellation/expiry/coordinates, quake coordinates, upstream failures, empty reports, transit geometry and selected civic fields');
