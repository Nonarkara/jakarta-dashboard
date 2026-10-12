import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const data=n=>JSON.parse(readFileSync(new URL('../public/data/jakarta-v1/'+n,import.meta.url),'utf8'));
const p=data('projects.json');assert.equal(p.count,p.projects.length);assert.equal(p.tier,'publisher-proposal');assert.equal(new Set(p.projects.map(r=>r.id)).size,p.count);
const coords=new Set();for(const r of p.projects){assert.ok(r.sourceUrl.startsWith('https://invest.jakarta.go.id/potential-projects/'));if(r.available){assert.match(r.proposedCost,/IDR|Rp/);assert.ok(r.location&&r.expectedStart);assert.match(r.sha256,/^[a-f0-9]{64}$/);}if(r.coordinates){const [x,y]=r.coordinates;assert.ok(x>106&&x<108&&y> -7&&y< -5);assert.equal(r.coordinateSource,'publisher-location');assert.ok(!coords.has(r.coordinates.join(',')),'Duplicate source locations must be withheld');coords.add(r.coordinates.join(','));}if(r.coordinateWarning)assert.equal(r.coordinates,null);}
const f=data('flood-reference.json');assert.equal(f.tier,'annual-reference');assert.equal(f.count,f.rows.reduce((n,r)=>n+r.records,0));assert.deepEqual(f.periods,['2024']);assert.equal(f.coordinateStatus,'withheld-undeclared-scale');assert.ok(f.rows.every(r=>r.year==='2024'&&r.records>0&&!('coordinates'in r)));assert.equal(f.rows.find(r=>r.kelurahan==='Bendungan Hilir').records,6);
const g=data('green.geojson');assert.equal(g.count,g.features.length);assert.equal(g.count+g.excludedOutOfRegion+g.excludedMissingGeometry,g.sourceRecordCount);assert.equal(g.observedAt,null);assert.equal(g.crs,'EPSG:4326');
for(const r of g.features){assert.deepEqual(Object.keys(r.properties).sort(),['name','kind','kelurahan','kecamatan','kota'].sort());assert.equal(typeof r.properties.kind,'string');const rings=r.geometry.type==='Polygon'?r.geometry.coordinates:r.geometry.coordinates.flat();assert.ok(rings.length);for(const ring of rings){assert.ok(ring.length>=4);assert.deepEqual(ring[0],ring.at(-1));for(const [x,y]of ring)assert.ok(x>105&&x<108&&y> -8&&y< -5);}}
const c=data('city-context.json');assert.equal(c.documents.length,6);assert.equal(c.vision.tier,'planning-target');assert.equal(c.vision.targetYear,2045);assert.equal(c.floodAccess.state,'unavailable');assert.equal(c.facts.find(f=>f.id==='flood-network').period,'2023');assert.equal(c.facts.find(f=>f.id==='jaki-services').qualifier,'>');
const ispu=data('ispu-reference.json');assert.equal(ispu.tier,'official-monitoring-reference');assert.equal(ispu.stations.length,5);assert.ok(Date.parse(ispu.retrievedAt)>0);assert.ok(ispu.observedAt.start<=ispu.observedAt.end);
assert.ok(ispu.evidencePath.startsWith('data/source-evidence/'),'the bake names its raw evidence');
const ispuRaw=readFileSync(new URL('../'+ispu.evidencePath,import.meta.url),'utf8');
const ispuRows={};
for(const line of ispuRaw.split('\n').slice(1)){ if(!line.trim())continue;
 const cells=line.split(',');
 const code=(cells[5]||'').replace(/"/g,'').match(/^(DKI[1-5])\b/)?.[1]; if(!code)continue;
 const max=Number(cells[12]); ispuRows[code]??=[]; ispuRows[code].push({date:`${cells[2].slice(0,4)}-${String(Number(cells[3])).padStart(2,'0')}-${String(Number(cells[4])).padStart(2,'0')}`,period:cells[2],max:Number.isFinite(max)&&cells[12]!==''?max:null,kategori:cells[1]});}
assert.equal(Object.values(ispuRows).flat().length,ispu.rowsImported,'every parseable CSV row is accounted for in the bake');
for(const s of ispu.stations){assert.match(s.code,/^DKI[1-5]$/);
 const rows=ispuRows[s.code];assert.ok(rows?.length,'the CSV contains this station');
 const measured=rows.filter(r=>r.max!==null).sort((a,b)=>a.date<b.date?-1:1);
 const latestPeriod=measured.at(-1).period;const latest=measured.filter(r=>r.period===latestPeriod);
 const worst=latest.reduce((a,b)=>b.max>a.max?b:a);
 assert.equal(s.coverage.start,rows.map(r=>r.date).sort()[0],'coverage start reconciles with the raw CSV');
 assert.equal(s.coverage.end,rows.map(r=>r.date).sort().at(-1),'coverage end reconciles with the raw CSV');
 assert.equal(s.coverage.daysReported,measured.length);assert.equal(s.coverage.daysNoData,rows.length-measured.length);
 assert.equal(s.latest.period,`${latestPeriod.slice(0,4)}-${latestPeriod.slice(4)}`,'the declared batch is the freshest in the CSV');
 assert.equal(s.latest.daysReported,latest.length);
 assert.equal(Math.round(s.latest.meanDailyMax*10)/10,Math.round(latest.reduce((n,r)=>n+r.max,0)/latest.length*10)/10,'mean daily max reconciles with the raw CSV');
 assert.equal(s.latest.worstDay.date,worst.date);assert.equal(s.latest.worstDay.ispu,worst.max);
 assert.ok(ispu.categories.some(k=>k.name===s.latest.worstDay.kategori),'worst-day category is in the regulation legend');}
assert.ok(ispu.categories.every(k=>k.range[0]<=k.range[1]&&k.range[1]<=500));
console.log('PASS official data: proposal identity/units/coordinate quarantine, annual-period totals, geometry/field allowlist, historical facts and future targets');
// Exercise the actual async civic UI functions: typing during fetch remains loading,
// and a failed fetch clears the old layer's count and provenance.
const {runInNewContext}=await import('node:vm');
const dashboard=readFileSync(new URL('../public/dashboard.js',import.meta.url),'utf8');
const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:''});return nodes.get(id);};node('civic-kind').value='green';node('civic-search').value='Jagakarsa';
let settle,calls=0;const ctx={$:node,t:(id,en)=>en,civicData:{},civicLoading:new Set(),DASHBOARD_BUILD:'test',get:()=>{calls++;return new Promise(r=>settle=r);},unavailable:()=>'<p>Unavailable</p>',num:n=>String(n),esc:v=>String(v??''),date:v=>v};
runInNewContext(dashboard.slice(dashboard.indexOf('async function loadCivic()'),dashboard.indexOf('function renderCrmViewerStatus()')),ctx);
const pending=ctx.loadCivic();ctx.renderCivic();assert.match(node('civic-results-status').textContent,/Loading/);await ctx.loadCivic();assert.equal(calls,1,'No duplicate request while a layer is loading');settle(null);await pending;assert.match(node('civic-results-status').textContent,/unavailable/);assert.equal(node('civic-evidence').textContent,'');
const retry=ctx.loadCivic();settle({publisher:'Jakarta Satu',retrievedAt:'2026-10-11',count:0,sourceRecordCount:0,excludedOutOfRegion:0,excludedMissingGeometry:0,features:[]});await retry;assert.match(node('civic-results-status').textContent,/0 matching records/);assert.doesNotMatch(node('civic-results-status').textContent,/unavailable/);
console.log('PASS civic loading: search during pending fetch, request deduplication, failed response and successful empty reference');
// Actual bridge execution must accept the imported multipart green geometry,
// rather than only updating the parent's selected-label text.
const atlas=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');let added=null,fit=null,view=null;const sourceUpdates=[];
class Bounds{constructor(a,b){this.points=[a,b];}extend(c){this.points.push(c);return this;}}
const bridge={styleReady:Promise.resolve(),mapInstance:{getSource:()=>added?{setData:d=>sourceUpdates.push(d)}:null,addSource:(id,source)=>{added=source;},addLayer:()=>{},fitBounds:b=>{fit=b;}},mapTheme:()=>({accent:'#a66f00'}),setMapView:v=>{view=v;},maplibregl:{LngLatBounds:Bounds},window:{matchMedia:()=>({matches:true})},postMsg:()=>{}};
runInNewContext(atlas.slice(atlas.indexOf('function applyDashboardOverlay(data)'),atlas.indexOf('// Building filters compare')),bridge);
const multipart=g.features.find(f=>f.geometry.type==='MultiPolygon');assert.ok(multipart);bridge.applyDashboardOverlay({type:'FeatureCollection',features:[multipart]});await Promise.resolve();assert.equal(added.data.features[0].geometry.type,'MultiPolygon');assert.equal(view,'2d');assert.ok(fit.points.length>2);
bridge.applyDashboardOverlay({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'MultiPolygon',coordinates:[[[[112,-7],[113,-7],[112,-6],[112,-7]]]]}}]});await Promise.resolve();assert.equal(sourceUpdates.length,0,'Reject out-of-region multipart polygons');
console.log('PASS live-overlay bridge: imported MultiPolygon reaches source/camera; out-of-region multipart geometry rejected');
