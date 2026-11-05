import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {validPlace,nearestPoint,distanceM,geometryDistance,nearby,loadReferences} from '../public/place-context.js';
const p=[106.83,-6.2];
assert.ok(validPlace(p));
for(const bad of [[-6.2,106.83],[null,-6.2],[106.83,NaN],[120,-6.2]])assert.equal(validPlace(bad),false);
assert.equal(distanceM(p,p),0);
assert.ok(Math.abs(distanceM(p,[106.83,-6.21])-1111.95)<1);
const crossing={type:'LineString',coordinates:[[106.82,-6.2],[106.84,-6.2]]};
assert.deepEqual(nearestPoint(p,crossing),p,'map handoff uses nearest segment point');
assert.ok(geometryDistance(p,crossing)<0.001,'nearest river segment, not distant vertices');
assert.ok(geometryDistance([106.85,-6.2],crossing)>1100,'projection clamps to segment end');
assert.equal(geometryDistance(p,{type:'Polygon',coordinates:[]}),Infinity,'no invented polygon distance');
const point=(x,name)=>({type:'Feature',properties:{name},geometry:{type:'Point',coordinates:[x,-6.2]}});
const dataset={type:'FeatureCollection',crs:'EPSG:4326',features:[point(106.87,'far'),point(106.831,'near'),point(106.84,'middle'),point(106.83,'exact'),point(107,'outside')]};
assert.deepEqual(nearby(p,dataset).map(r=>r.feature.properties.name),['exact','near','middle']);
const duplicates={...dataset,features:[point(106.831,'near'),point(106.831,'near'),point(106.84,'middle')]};
assert.equal(nearby(p,duplicates).length,2,'exact duplicate source rows do not crowd out useful references');
assert.equal(nearby([120,-6.2],dataset).length,0);
let count=0;
const fakeFetch=async url=>{count++;if(url.includes('schools'))throw Error('outage');return Response.json(dataset);};
const results=await loadReferences(fakeFetch,new AbortController().signal,'test');
assert.equal(results.filter(r=>r.data).length,4,'failed provider does not hide others');
assert.equal(results.find(r=>r.id==='schools').data,null,'missing is not zero');
count=0;await loadReferences(fakeFetch,new AbortController().signal,'test',results);assert.equal(count,1,'retry retains valid datasets');
const invalid=await loadReferences(async()=>Response.json({...dataset,crs:'EPSG:3857'}),new AbortController().signal,'test');assert.ok(invalid.every(r=>r.data===null));
const aborted=new AbortController();aborted.abort();assert.ok((await loadReferences(async()=>{throw Error('aborted');},aborted.signal,'test')).every(r=>r.data===null));
const slowController=new AbortController();
const partial=loadReferences(async url=>{
 if(url.includes('schools'))return new Promise((resolve,reject)=>slowController.signal.addEventListener('abort',()=>reject(Error('timeout')),{once:true}));
 return Response.json(dataset);
},slowController.signal,'test');
await new Promise(resolve=>setTimeout(resolve,10));slowController.abort();
assert.equal((await partial).filter(r=>r.data).length,4,'one timed-out source preserves completed references');
assert.deepEqual(nearby(p,{features:[null,{geometry:null}]}),[],'malformed feature rows cannot crash the place view');
for(const id of ['waterways','pumps','awlr','health','schools']){
 const real=JSON.parse(readFileSync(new URL('../public/data/jakarta-v1/'+id+'.geojson',import.meta.url)));
 const rows=nearby(p,real);assert.ok(rows.length>0,id+' real nearby references');assert.ok(rows.every(r=>r.distance>=0&&r.distance<=5000));
}
console.log('Place context: distance, real reference joins, boundary validation, partial failure, retry and abort passed.');

// Execute the real 3D inspector's location handoff, rather than testing a nearby helper.
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const fn=app.slice(app.indexOf('function inspectionLocation('),app.indexOf('function closeInspect('));
const context=vm.createContext({});vm.runInContext(fn,context);
const landmarks=JSON.parse(readFileSync(new URL('../public/jakarta-landmarks.geojson',import.meta.url)));
context.tower=landmarks.features.find(f=>f.properties.name==='Autograph Tower');
const anchor=JSON.parse(JSON.stringify(vm.runInContext('inspectionLocation(tower,{lng:106.82284,lat:-6.20745})',context)));
assert.deepEqual([anchor.lng,anchor.lat],context.tower.geometry.coordinates[0][0]);
assert.ok(distanceM([anchor.lng,anchor.lat],[106.82284,-6.20745])>900,'source footprint replaces the displaced ground-plane click');
assert.equal(vm.runInContext('inspectionLocation({geometry:{type:"Polygon",coordinates:[]}},"fallback")',context),'fallback');
console.log('PASS 3D place handoff: actual tower footprint replaces the ground-plane click.');
