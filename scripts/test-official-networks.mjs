import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createController,validPolderReference} from '../public/water-traffic.js';
const base=new URL('../public/',import.meta.url);
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.events={};this.open=false;this.attrs={};}
 append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 addEventListener(event,fn){this.events[event]=fn;}
 setAttribute(k,v){this.attrs[k]=v;}
 scrollIntoView(){}
}
const evidence=new Element('details');
globalThis.document={createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),getElementById:()=>evidence};
globalThis.location={origin:'https://atlas.test'};
const originalFetch=globalThis.fetch;
const feeds={
 '/api/atlas/hydrology':{stations:[],predictions:[],checkedAt:new Date().toISOString()},
 '/api/atlas/jaxa-water':{available:false},'/api/atlas/environment':{products:[]}
};
globalThis.fetch=async path=>{const p=String(path).split('?')[0];return Response.json(feeds[p]||JSON.parse(readFileSync(new URL('.'+p,base))));};
const sources=new Map(),layers=new Map(),events=[];
const map={getSource:id=>sources.get(id),getLayer:id=>layers.get(id),
 addSource:(id,source)=>{assert.ok(!sources.has(id));sources.set(id,source);},
 addLayer:layer=>{assert.ok(sources.has(layer.source));assert.ok(!layers.has(layer.id));layers.set(layer.id,layer);},
 removeLayer:id=>layers.delete(id),removeSource:id=>{assert.ok(![...layers.values()].some(l=>l.source===id),'remove dependent layers first');sources.delete(id);},
 on:(...args)=>events.push(args),off(){},flyTo(){},setLayoutProperty:(id,key,value)=>{layers.get(id).layout||={};layers.get(id).layout[key]=value;}};
const controller=createController(map,{text:en=>en,active:()=> 'waterways',buildTag:'test'});
const body=new Element('div');await controller.show('waterways',body);await new Promise(resolve=>setImmediate(resolve));
assert.ok(layers.has('official-drain-lines'),'official drains built alongside OSM');assert.ok(layers.has('network-water-lines'),'OSM preserved');
assert.equal(layers.get('official-drain-lines')['source-layer'],'official_drains');assert.equal(layers.get('official-drain-lines').minzoom,11);
assert.match(sources.get('official-drain-lines').url,/pmtiles:\/\/https:\/\/atlas.test\/jakarta-official-drainage.pmtiles/);
assert.ok(layers.has('official-polder-lines'));assert.equal(sources.get('official-polder-lines').data.features.length,65);
controller.clear();assert.equal(sources.size,0);assert.equal(layers.size,0,'all official and old reference layers clear on exit');
const manifest=JSON.parse(readFileSync(new URL('data/jakarta-v1/official-drainage-manifest.json',base)));
assert.equal(manifest.sourceRecordCount,manifest.count+manifest.excluded);assert.equal(manifest.dataAsOf,null,'unknown source epoch stays unknown');
assert.match(manifest.limitations,/connectivity/);assert.match(manifest.outputCRS,/EPSG:4326/);
const worker=readFileSync(new URL('../src/index.ts',import.meta.url),'utf8');assert.match(worker,/path === "\/jakarta-official-drainage.pmtiles"[^\n]*servePmtilesFromR2/);
const realFetch=globalThis.fetch;
globalThis.fetch=async path=>String(path).includes('waterways.geojson')||String(path).includes('hydrology-reference.json')?new Response('missing',{status:503}):realFetch(path);
const partialController=createController(map,{text:en=>en,active:()=> 'waterways',buildTag:'test'});
await partialController.show('waterways',new Element('div'));await new Promise(resolve=>setImmediate(resolve));
assert.ok(layers.has('official-drain-lines'),'official network survives missing OSM');assert.ok(layers.has('official-polder-lines'),'polders survive missing gauges and OSM');partialController.clear();
assert.equal(validPolderReference({type:'FeatureCollection',features:[{geometry:{type:'Polygon',coordinates:[[[106.8,-6.2],[NaN,-6.2]]]}}]},{count:1,outputCRS:'EPSG:4326'}),false);
assert.equal(validPolderReference({type:'FeatureCollection',features:[]},{count:0,outputCRS:'EPSG:3857'}),false);
globalThis.fetch=originalFetch;
console.log('PASS official drainage: source count reconciliation, geometry/reference limits, actual map layers, separate OSM, Range route and complete exit cleanup.');
