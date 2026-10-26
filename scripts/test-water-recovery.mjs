import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createController} from '../public/water-traffic.js';
const water=JSON.parse(readFileSync(new URL('../public/data/jakarta-v1/waterways.geojson',import.meta.url)));
class Node {
 constructor(tag='div'){this.tag=tag;this.children=[];this.events={};this.attributes={};this.value='';this._text='';}
 set textContent(s){this._text=String(s);this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent).join(' ');}
 append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}replaceChildren(...nodes){this._text='';this.children=[];this.append(...nodes);}
 setAttribute(k,v){this.attributes[k]=v;}addEventListener(e,fn){this.events[e]=fn;}click(){this.events.click?.();}
}
const saved={document:globalThis.document,Option:globalThis.Option,fetch:globalThis.fetch};
globalThis.document={createElement:tag=>new Node(tag),createTextNode:s=>{const n=new Node('text');n.textContent=s;return n;},getElementById:()=>({open:false}),addEventListener(){},removeEventListener(){}};
globalThis.Option=class extends Node{constructor(text,value){super('option');this.textContent=text;this.value=value;}};
const all=root=>[root,...root.children.flatMap(all)],find=(root,text)=>all(root).find(n=>n.tag==='summary'&&n.textContent===text);
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
function mapFixture(){const layers=new Map(),sources=new Map(),listeners=[];return {layers,sources,listeners,cameras:[],getLayer:id=>layers.get(id),getSource:id=>sources.get(id),getStyle:()=>({layers:[...layers.values()]}),addSource:(id,s)=>{assert.ok(!sources.has(id));sources.set(id,s);},addLayer:(l,before)=>{assert.ok(!layers.has(l.id));const entries=[...layers.entries()],at=before?entries.findIndex(([id])=>id===before):entries.length;assert.ok(at>=0);entries.splice(at,0,[l.id,{...l,before}]);layers.clear();for(const [id,layer] of entries)layers.set(id,layer);},removeLayer:id=>layers.delete(id),removeSource:id=>sources.delete(id),on:(...args)=>listeners.push(args),off:(...args)=>{const i=listeners.findIndex(a=>a.every((v,j)=>v===args[j]));if(i>=0)listeners.splice(i,1);},flyTo(options){this.cameras.push(options);}};}
const other=path=>path==='/api/atlas/environment'?Response.json({products:[{id:'surface-water',available:true,date:'2026-10-24',tiles:['/example/{z}/{x}/{y}'],maxzoom:12}]}):String(path).includes('hydrology')?Response.json({stations:[],predictions:[],available:false}):new Response('',{status:503});
try{
 // A stalled OSM asset must not prevent independent controls from mounting.
 let resolveWater,resolveGauge,waterCalls=0;const signals=[];
 globalThis.fetch=(path,init)=>{signals.push(init.signal);if(String(path).includes('waterways.geojson')){waterCalls++;return new Promise(r=>resolveWater=r);}if(path==='/api/atlas/hydrology')return new Promise(r=>resolveGauge=r);return Promise.resolve(other(path));};
 const map=mapFixture(),body=new Node(),ui=createController(map,{text:en=>en,active:()=> 'waterways',buildTag:'test'});
 const showing=ui.show('waterways',body);await flush();
 const budget=find(body,'Rain → polder water budget');assert.ok(budget,'budget mounts before OSM or gauge responds');assert.equal(body.attributes['aria-busy'],'true','pending sources remain explicit');assert.ok(find(body,'Coastal tide forecast · Priok'));assert.equal(waterCalls,1);assert.equal(map.cameras.length,1);
 budget.parentElement.open=true;budget.parentElement.savedAssumption='user edit';
 resolveWater(new Response('',{status:503}));await flush();
 const retry=all(body).find(n=>n.tag==='button'&&n.textContent==='Retry mapped waterways');assert.ok(retry);assert.match(body.textContent,/OSM waterways unavailable/);
 retry.click();retry.click();await flush();assert.equal(waterCalls,2,'only one scoped retry in flight');
 for(const id of ['polder-preparedness-points','official-drain-lines'])map.layers.set(id,{id});
 const comparison=all(body).find(n=>n.tag==='select'&&n.attributes['aria-label']==='Water comparison layer');comparison.value='nasa';comparison.events.change();
 assert.equal(map.layers.get('network-comparison').before,'polder-preparedness-points','raster enabled while OSM pending stays under the actual first foreground');
 map.layers.set('network-landcover',{id:'network-landcover'});
 // Match the WorldCover handler: insertion is beneath the first foreground.
 map.layers.delete('network-landcover');map.addLayer({id:'network-landcover'},'polder-preparedness-points');
 resolveWater(Response.json(water));await flush();assert.match(body.textContent,/3,885 mapped features/);assert.ok(!all(body).some(n=>n.textContent==='Retry mapped waterways'));
 assert.equal(find(body,'Rain → polder water budget'),budget,'retry preserves mounted controls and user state');assert.equal(budget.parentElement.savedAssumption,'user edit');assert.equal(budget.parentElement.open,true);
 assert.equal(map.layers.get('network-water-fill').before,'polder-preparedness-points','late OSM fill is beneath the actual first foreground layer');
 const order=[...map.layers.keys()];for(const id of ['network-landcover','network-comparison'])assert.ok(order.indexOf(id)<order.indexOf('network-water-lines'),'raster stays below OSM vectors');for(const id of ['polder-preparedness-points','official-drain-lines'])assert.ok(order.indexOf('network-water-labels')<order.indexOf(id),'foreground stays above OSM');
 assert.equal(map.listeners.filter(a=>a[1]==='network-water-lines').length,1);
 const cameraCount=map.cameras.length;resolveGauge(other('/api/atlas/hydrology'));await showing;assert.equal(body.attributes['aria-busy'],'false','terminal sources clear busy state');assert.equal(map.cameras.length,cameraCount,'late gauges never recenter a user-selected view');assert.ok(signals.every(s=>s instanceof AbortSignal));ui.clear();
 // A response arriving after exit cannot draw or repopulate the old panel.
 let lateResolve;globalThis.fetch=path=>String(path).includes('waterways.geojson')?new Promise(r=>lateResolve=r):Promise.resolve(other(path));
 const lateMap=mapFixture(),lateBody=new Node(),late=createController(lateMap,{text:en=>en,active:()=> 'waterways',buildTag:'test'});await late.show('waterways',lateBody);late.clear();lateResolve(Response.json(water));await flush();assert.equal(lateMap.sources.size,0);assert.equal(lateMap.listeners.length,0);assert.doesNotMatch(lateBody.textContent,/3,885 mapped features/);
 // Malformed assets stay unavailable and the recovery action is native Bahasa.
 globalThis.fetch=async path=>String(path).includes('waterways.geojson')?Response.json({type:'FeatureCollection',crs:'EPSG:4326',features:null}):other(path);
 const badMap=mapFixture(),badBody=new Node(),bad=createController(badMap,{text:(_en,id)=>id,active:()=> 'waterways',buildTag:'test'});await bad.show('waterways',badBody);await flush();assert.match(badBody.textContent,/Coba lagi alur air terpetakan/);assert.equal(badMap.sources.size,0);bad.clear();
 console.log('PASS water recovery: independent mount, scoped/single retry, preserved edits, late-layer order, no camera reset, exit guard, malformed input and Bahasa');
}finally{Object.assign(globalThis,saved);}
