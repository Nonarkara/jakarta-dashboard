import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {indexPlaces,searchPlaces,exportView} from '../public/city-tools.js';
const doc={type:'FeatureCollection',crs:'EPSG:4326',source:'https://jakartasatu.jakarta.go.id',observedAt:null,retrievedAt:'2026-10-11T00:00:00Z',features:[
 {type:'Feature',properties:{name:'RSU Gambir',kelurahan:'Gambir'},geometry:{type:'Point',coordinates:[106.83,-6.2]}},
 {type:'Feature',properties:{name:'RSU Gambir',kelurahan:'Gambir'},geometry:{type:'Point',coordinates:[106.83,-6.2]}},
 {type:'Feature',properties:{name:'outside'},geometry:{type:'Point',coordinates:[120,0]}},null]};
const areas={version:'2026-10-10',areas:[{id:'monas',name:'National Monument',indonesian:'Monas',center:[106.827,-6.175],category:'landmark'}]};
const rows=indexPlaces([{kind:'place',data:areas},{kind:'health',data:doc}]);
assert.equal(rows.length,2);assert.equal(searchPlaces(rows,'monas')[0].name,'National Monument');
assert.equal(searchPlaces(rows,'GAMBIR')[0].kind,'health');assert.equal(searchPlaces(rows,'g').length,0);assert.equal(searchPlaces(rows,'x'.repeat(101)).length,0);
assert.equal(indexPlaces([{kind:'health',data:{...doc,crs:'EPSG:3857'}}]).length,0);
const point=(x,y,props)=>({type:'Feature',geometry:{type:'Point',coordinates:[x,y]},properties:props});
const snap={build:'test',lens:'haze',areas,air:[{lng:106.83,lat:-6.2,aqi:0,pm25:0,observedAt:'2026-10-01T00:00:00Z',source:'CAMS',provenance:{tier:'model-estimate'}}],fires:{features:[point(106.84,-6.21,{observedAt:'2026-10-15T00:00:00Z',frpMw:null}),point(110,0,{})]},selection:{features:[{type:'Feature',geometry:{type:'LineString',coordinates:[[106.8,-6.3],[106.9,-6.1]]},properties:{name:'line'}},null]}};
const data=exportView(snap,[106.81,-6.25,106.86,-6.15],'2026-10-15T07:00:00Z');
assert.deepEqual(data.metadata.viewportBounds,[106.81,-6.25,106.86,-6.15]);
assert.deepEqual(data.bbox,[106.8,-6.3,106.9,-6.1],'GeoJSON bbox covers whole exported geometry, not just viewport');
assert.equal(data.features.length,4,'camera, air, thermal and crossing selection bounding box');
const air=data.features.find(f=>f.properties.exportCollection==='air-model-samples');assert.equal(air.properties.aqi,0);assert.equal(air.properties.pm25,0);assert.equal(air.properties.stale,true);
assert.equal(data.features.find(f=>f.properties.exportCollection==='thermal-detections').properties.frpMw,null);
assert.ok(data.metadata.exclusions.includes('Building PMTiles archive'));assert.equal(data.metadata.truncated,false);
const future=exportView({...snap,air:[{lng:106.83,lat:-6.2,observedAt:'2026-10-16T07:00:00Z'}]},[106.81,-6.25,106.86,-6.15],'2026-10-15T07:00:00Z');
assert.equal(future.features.find(f=>f.properties.exportCollection==='air-model-samples').properties.stale,true,'future timestamp is never current');
assert.equal(snap.selection.features[0].properties.exportCollection,undefined,'export never mutates source evidence');
assert.throws(()=>exportView(snap,[2,0,1,1]));
console.log('PASS city tools: bilingual local search, exact dedup, CRS/coordinate gates, viewport export, source states, zero/null and immutable source geometry.');

const malformed=exportView({selection:{features:[{type:'Feature',geometry:{type:'LineString',coordinates:[[106.82,-6.2],[NaN,-6.2]]},properties:{}}]}},[106.81,-6.3,106.85,-6.1]);
assert.equal(malformed.features.length,0,'one invalid coordinate rejects the entire export geometry');assert.equal(malformed.bbox,undefined,'empty evidence has no invented feature bounds');

const actual=JSON.parse(readFileSync(new URL('../public/jakarta-areas.json',import.meta.url)));
assert.ok(searchPlaces(indexPlaces([{kind:'place',data:actual}]),'Monas').some(row=>row.name==='Medan Merdeka'),'real Monas alias resolves its curated civic square');
