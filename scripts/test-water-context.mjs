import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {coastalModuleUrl} from './coastal-test-module.mjs';
import {validCoastal,validLandCover,createWaterContext} from '../public/water-context.js';
const load=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const cover=load('public/data/jakarta-v1/worldcover-2021-reference.json');
const {cleanCoastal}=await import(coastalModuleUrl);
const oldNow=Date.now;Date.now=()=>Date.parse('2026-10-15T15:50:00Z');
const coast=cleanCoastal(load('data/source-evidence/water-candidates-2026-10-15/bmkg-priok.json'),Date.parse('2026-10-15T15:50:00Z'));
assert.equal(validCoastal(coast),true);assert.equal(validCoastal(coast,Date.parse('2026-10-18T00:00:00Z')),false,'expired available flag cannot pass client boundary');assert.equal(validCoastal({...coast,issuedAt:'2026-10-16T00:00:00Z'}),false);assert.equal(validLandCover(cover),true);
for(const bad of [null,{...coast,available:false},{...coast,datum:'MSL'},{...coast,points:[{validAt:'2026-10-18T00:00:00Z',tideM:0}]}])assert.equal(validCoastal(bad),false);
for(const bad of [null,{...cover,bounds:[0,0,1,1]},{...cover,nodataCells:-1},{...cover,classes:[]},{...cover,display:{path:'https://untrusted/image.png'}}])assert.equal(validLandCover(bad),false);
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.style={};this.events={};this.attrs={};}
 append(...n){this.children.push(...n);}prepend(...n){this.children.unshift(...n);}replaceChildren(...n){this.children=n;}
 addEventListener(e,f){this.events[e]=f;}setAttribute(k,v){this.attrs[k]=v;}
}
const text=n=>[n.textContent||'',...(n.children||[]).map(text)].join(' ');
const descendants=n=>[n,...(n.children||[]).flatMap(descendants)];
globalThis.document={createElement:t=>new Element(t),createTextNode:t=>({textContent:t})};
const sources=new Map(),layers=new Map(),events=new Map();const map={on:(e,fn)=>events.set(e,fn),off:e=>events.delete(e),removeLayer:id=>layers.delete(id),removeSource:id=>sources.delete(id),getSource:id=>sources.get(id),getLayer:id=>layers.get(id),addSource:(id,s)=>sources.set(id,s),addLayer:l=>layers.set(l.id,l),setLayoutProperty:(id,k,v)=>{layers.get(id)[k]=v;}};
let current=true,fail=false;const paths=[];
const get=async p=>{paths.push(p);if(fail)throw Error('offline');return p.startsWith('/api/')?coast:cover;};
const context=createWaterContext(map,{text:en=>en,get,isCurrent:()=>current,buildTag:'test'});
const land=new Element('div');await context.landCover(land);assert.match(text(land),/2021/);assert.match(text(land),/not a measured impervious fraction/);assert.match(text(land),/69.3%/);assert.match(text(land),/<0.1%/,'small nonzero classes never round to apparent absence');
assert.equal(layers.size,0,'image remains opt-in');const checkbox=descendants(land).find(n=>n.tagName==='input');checkbox.checked=true;checkbox.events.change();assert.equal(layers.get('network-landcover').paint['raster-resampling'],'nearest');assert.deepEqual(sources.get('network-landcover').coordinates,cover.imageCoordinates);assert.deepEqual(Object.keys(sources.get('network-landcover')).sort(),['coordinates','type','url'],'ImageSource rejects raster/vector-only attribution property');assert.match(text(land),/Contains modified Copernicus Sentinel data/);checkbox.checked=false;checkbox.events.change();assert.equal(layers.get('network-landcover').visibility,'none');
checkbox.checked=true;checkbox.events.change();events.get('error')({sourceId:'network-landcover'});assert.equal(checkbox.checked,false,'failed image resets toggle');assert.equal(layers.size,0);assert.equal(sources.size,0);assert.match(text(land),/image unavailable/);
let expiryCallback;const oldSetTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn,delay)=>{if(delay>12000){expiryCallback=fn;return 987654321;}return oldSetTimeout(fn,delay);};
const coastal=new Element('div');await context.coastal(coastal);globalThis.setTimeout=oldSetTimeout;assert.equal(descendants(coastal).filter(n=>n.tagName==='td').length,120);assert.match(text(coastal),/vertical datum not published/);assert.match(text(coastal),/106.88229/);
expiryCallback();assert.match(text(coastal),/Forecast expired/,'an open forecast table changes to dated evidence at expiry');
const links=descendants(coastal).filter(n=>n.tagName==='a');assert.ok(links.every(a=>a.href.startsWith('https://maritim.bmkg.go.id/')));
current=false;const abandoned=new Element('div');await context.landCover(abandoned);assert.equal(descendants(abandoned).some(n=>n.tagName==='input'),false,'late response cannot create closed-lens control');
current=true;fail=true;await context.coastal(coastal);assert.match(text(coastal),/unavailable/);assert.ok(descendants(coastal).some(n=>n.tagName==='button'),'outage is retryable');
await context.landCover(land);assert.match(text(land),/Water layers remain usable/);
context.clear();assert.equal(events.size,0,'source event listeners removed');Date.now=oldNow;
console.log('PASS water context: actual source contracts, explicit datum/history, cell shares, opt-in image bounds, nearest categories, independent failures, retry and late-response guard');
