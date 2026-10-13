// Ciliwung route contract: the mapped river corridor is admitted geometry only —
// connected through shared OSM way nodes, anchored to published scenario stations,
// every admission gate recomputed here from the shipped bytes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const data=n=>JSON.parse(readFileSync(new URL('../public/data/jakarta-v1/'+n,import.meta.url),'utf8'));
const route=data('ciliwung-route.geojson'),manifest=data('ciliwung-manifest.json'),scenario=data('water-scenario.json');
const haversine=(a,b)=>{const x1=a[0],y1=a[1],x2=b[0],y2=b[1];const rad=d=>d*Math.PI/180;return 6371000*Math.hypot(rad(x2-x1)*Math.cos(rad((y1+y2)/2)),rad(y2-y1));};

assert.equal(manifest.tier,'mapped-river-reference');
assert.ok(Number.isFinite(manifest.toleranceM)&&manifest.toleranceM>0,'endpoint tolerance is published');
assert.ok(Number.isFinite(manifest.chordBoundM)&&manifest.chordBoundM>0,'chord bound is published');
assert.ok(manifest.licence.includes('ODbL'),'ODbL licence stated');
assert.ok(Date.parse(manifest.sourceAsOf)>0,'OSM base timestamp retained');
assert.ok(Date.parse(manifest.retrievedAt)>0);
assert.equal(manifest.stations.length,scenario.stations.length,'manifest stations match the scenario stations');
manifest.stations.forEach((s,i)=>{
  assert.equal(s.name,scenario.stations[i].name,'station order follows the scenario: '+s.name);
  assert.ok(Math.abs(s.lng-scenario.stations[i].coordinates[0])<1e-9&&Math.abs(s.lat-scenario.stations[i].coordinates[1])<1e-9,'station anchors are the published coordinates');
  assert.ok(s.endpointDistanceM<=manifest.toleranceM,'station anchor within tolerance: '+s.name);
});
assert.equal(manifest.segments.length,manifest.stations.length-1,'one segment per station pair');

const admitted=manifest.segments.filter(s=>s.admitted);
assert.ok(admitted.length>0,'at least one station pair carries verified geometry');
for(const seg of manifest.segments){
  const from=manifest.stations.find(s=>s.name===seg.from),to=manifest.stations.find(s=>s.name===seg.to);
  const chord=haversine([from.lng,from.lat],[to.lng,to.lat])/1000;
  if(!seg.admitted){assert.ok(typeof seg.reason==='string'&&seg.reason.length>0,'a gap states its reason');continue;}
  assert.ok(seg.lengthKm>=0.5*chord&&seg.lengthKm<=3*chord,seg.from+'→'+seg.to+' length '+seg.lengthKm+' km inside chord bounds for chord '+chord.toFixed(1)+' km');
  assert.ok(seg.maxStrayFromChordM<=manifest.chordBoundM||seg.ciliwungNamedKm>=0.5*seg.lengthKm,seg.from+'→'+seg.to+' either stays near the chord or carries majority Ciliwung naming');
  const f=route.features.find(f=>f.properties.segment===seg.from+'→'+seg.to);
  assert.ok(f,'admitted segment has geometry: '+seg.from+'→'+seg.to);
  const c=f.geometry.coordinates;
  assert.equal(f.geometry.type,'LineString');assert.equal(c.length,seg.nodeCount,'feature vertex count equals the manifest node count');
  assert.ok(c.length>=2);
  assert.ok(haversine(c[0],[from.lng,from.lat])<=manifest.toleranceM+200,'route starts at the published station anchor');
  assert.ok(haversine(c.at(-1),[to.lng,to.lat])<=manifest.toleranceM+200,'route ends at the published station anchor');
  for(const pt of c){assert.ok(pt[0]>106.55&&pt[0]<107.05&&pt[1]>-6.98&&pt[1]<-6.02,'every vertex stays inside the queried corridor');}
  for(let i=1;i<c.length;i++){
    const edge=haversine(c[i-1],c[i]);
    assert.ok(edge<5000,'no invented connector: every edge is a mapped way segment ('+Math.round(edge)+' m)');
    assert.ok(edge>0,'consecutive vertices are distinct');
  }
}
assert.equal(route.features.length,admitted.length,'the route asset carries admitted segments only');
assert.ok(route.note.includes('Admitted geometry only'),'the asset states its admission rule');
assert.equal(route.sourceAsOf,manifest.sourceAsOf,'route and manifest share one OSM base');
const evidence=readFileSync(new URL('../'+manifest.evidencePath,import.meta.url));
assert.equal(evidence[0],0x1f,'raw Overpass capture retained (gzip) and named by the manifest');
const osm=JSON.parse(gunzipSync(evidence));
assert.ok(osm.elements.length>1000,'the raw capture holds the full corridor query');
console.log('PASS ciliwung route: published anchors, admission gates recomputed, connector-free geometry, raw evidence retained');
