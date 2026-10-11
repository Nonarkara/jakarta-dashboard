import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const data=n=>JSON.parse(readFileSync(new URL('../public/data/jakarta-v1/'+n,import.meta.url),'utf8'));
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
const DKI=(x,y)=>x>=106.65&&x<=107.00&&y>=-6.40&&y<=-6.08;
const closed=rings=>{for(const ring of rings){assert.ok(ring.length>=4);assert.deepEqual(ring[0],ring.at(-1));}};

// Monitoring-network overlays: dated public reference, allowlisted fields, DKI bounds.
const awlr=data('awlr.geojson');
assert.equal(awlr.tier,'public-reference');assert.equal(awlr.observedAt,null);
assert.equal(awlr.count+awlr.excludedOutOfRegion,awlr.sourceRecordCount);
assert.ok(awlr.count>=20&&awlr.count<=awlr.sourceRecordCount);
for(const f of awlr.features){
 assert.deepEqual(Object.keys(f.properties).sort(),['address','city','kind','name','river','siaga']);
 const [x,y]=f.geometry.coordinates;assert.ok(DKI(x,y),'AWLR overlay stays inside the DKI map bbox');
 const s=f.properties.siaga;assert.equal(s.length,4);
 for(let i=0;i<4;i++){assert.equal(s[i].level,i+1);assert.match(s[i].unit,/cm/);
  if(s[i].original)assert.ok(s[i].minCm!=null||s[i].maxCm!=null,'every published band parses to a bound');
  else assert.ok(s[i].minCm==null&&s[i].maxCm==null,'unpublished band claims no bound');}
}
const arr=data('arr.geojson');
assert.equal(arr.count+arr.excludedOutOfRegion,arr.sourceRecordCount);
for(const f of arr.features){
 assert.deepEqual(Object.keys(f.properties).sort(),['address','basin','city','installedYear','kind','name']);
 const [x,y]=f.geometry.coordinates;assert.ok(DKI(x,y));
 assert.ok(f.properties.installedYear===null||(f.properties.installedYear>=1990&&f.properties.installedYear<=2026));
}
const pumps=data('pumps.geojson');
const kinds={};for(const f of pumps.features)kinds[f.properties.kind]=(kinds[f.properties.kind]||0)+1;
assert.deepEqual(Object.keys(kinds).sort(),['Pintu Air','Pompa','Waduk & Embung']);
assert.ok(kinds.Pompa>=200&&kinds['Pintu Air']>=450&&kinds['Waduk & Embung']>=100);
for(const f of pumps.features){assert.ok(Object.keys(f.properties).every(k=>['kind','name','kota','kecamatan','kelurahan'].includes(k)));const [x,y]=f.geometry.coordinates;assert.ok(DKI(x,y));}
const situ=data('situ.geojson');
assert.equal(situ.count,situ.sourceRecordCount);assert.ok(situ.count>=20&&situ.count<=40);
for(const f of situ.features){
 assert.deepEqual(Object.keys(f.properties).sort(),['areaHa','condition','kecamatan','kelurahan','kind','kota','name']);
 closed(f.geometry.type==='Polygon'?f.geometry.coordinates:f.geometry.coordinates.flat());
}
console.log('PASS flood network overlays: allowlists, DKI bounds, SIAGA band parsing and closed geometry');

// Flood-risk reference: official class domain only, closed rings, kelurahan codes joinable.
const risk=data('risk.geojson');
assert.deepEqual(risk.kelasDomain.sort(),['Berat','Ringan','Sedang']);
assert.equal(risk.count,risk.features.length);assert.equal(risk.count+risk.excludedInvalid,risk.sourceRecordCount);
for(const f of risk.features){
 assert.ok(risk.kelasDomain.includes(f.properties.kelas));
 assert.match(f.properties.kelurahanCode,/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/, 'raw KDEPUM code stays in publisher form');
 const rings=f.geometry.type==='Polygon'?f.geometry.coordinates:f.geometry.coordinates.flat();
 closed(rings);
 for(const ring of rings)for(const [x,y] of ring)assert.ok(DKI(x,y),'risk polygons stay inside the DKI map bbox');
}

// Population denominators: official 2023 semester-2 reference, internally consistent.
const pop=data('population.json');
assert.equal(pop.tier,'official-census-reference');assert.match(pop.observedAt,/2023/);
assert.equal(pop.kelurahan.length,267);assert.equal(pop.kecamatan.length,44);assert.equal(pop.kota.length,6);
for(const k of pop.kota){
 const sum=pop.kelurahan.filter(r=>r.kota===k.name).reduce((n,r)=>n+r.wni,0);
 assert.ok(Math.abs(sum-k.wni)<=1,`kelurahan WNI sum matches ${k.name}`);
}
for(const r of pop.kelurahan){assert.match(r.code,/^\d{10}$/);assert.ok(r.wni>0&&r.households>0);}
console.log('PASS risk reference and population: class domain, closure, joinable codes and kota-consistent WNI totals');

// Desk summary couples everything: counts reconcile with the overlays, exposure joins resolve.
const net=data('flood-network.json');
assert.equal(net.tier,'public-reference');
assert.equal(net.counts.awlrInRegion,awlr.count);assert.equal(net.counts.arrInRegion,arr.count);
assert.equal(net.counts.riskPolygons,risk.count);assert.equal(net.counts.situ,situ.count);
assert.equal(net.stations.length,net.counts.awlrTotal+net.counts.arrTotal);
assert.ok(net.stations.some(s=>!s.inRegion),'upstream catchment stations stay listed outside the map');
assert.equal(net.stations.filter(s=>!s.inRegion).length,awlr.excludedOutOfRegion+arr.excludedOutOfRegion);
const popByCode=new Map(pop.kelurahan.map(r=>[r.code,r]));
const classes={Berat:0,Sedang:0,Ringan:0};
for(const r of net.riskSummary){
 assert.ok(r.dominantClass in classes);assert.ok(r.polygons>0);
 assert.equal(r.beratPolygons,r.classes.Berat||0);
 const expected=[r.classes.Berat||0,r.classes.Sedang||0,r.classes.Ringan||0].reduce((n,v)=>n+v,0);
 assert.equal(expected,r.polygons,'polygon counts reconcile per kelurahan');
 const p=popByCode.get(r.kelurahanCode);
 if(p)assert.equal(r.wni,p.wni,'exposure joins the official population row');
}
assert.ok(net.riskSummary.length>=200);
assert.equal(net.riskSummary.filter(r=>r.beratPolygons>0).length>=200,true);
assert.equal(net.accessStates.pantauBanjir.state,'unreachable');assert.ok(net.accessStates.pantauBanjir.reasonId);
assert.equal(net.accessStates.petaBencanaGauges.state,'empty');
assert.equal(net.accessStates.tide.state,'link-only');
assert.ok(Date.parse(net.retrievedAt)>0);
console.log('PASS flood desk summary: reconciled counts, upstream listing, exposure join and explicit access states');

// Client surface: dialog, selector options, stamped script tag and coupling client present.
const html=read('dashboard.html');
assert.match(html,/id="flood-dialog"/);assert.match(html,/data-open="flood-dialog"/);
for(const kind of ['awlr','arr','pumps','situ','risk'])assert.match(html,new RegExp('option value="'+kind+'"'));
assert.match(html,/src="\/flood-data\.js\?v=[^"]+"/);
const desk=read('flood-data.js');
assert.match(desk,/flood-network\.json/);assert.match(desk,/risk\.geojson/);
assert.match(desk,/accessStates\?\.pantauBanjir/);
assert.match(desk,/SIAGA/);
assert.doesNotMatch(desk,/live.*(reading|level)/i,'desk must not claim live sensor readings');
const shell=read('dashboard.js');
assert.match(shell,/floodDesk:window\.floodDeskEvidence\|\|null/);
assert.match(read('reference-language.js'),/flood-risk reference/);
console.log('PASS flood desk client: dialog, overlay kinds, coupling script and evidence export wired');
