import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPreparedness} from '../public/polder-preparedness.js';
const data=JSON.parse(readFileSync(new URL('../public/data/jakarta-v1/polder-facilities.json',import.meta.url)));
class Node {
 constructor(tag){this.tag=tag;this.children=[];this.events={};this.attributes={};this.value='';this._text='';}
 set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(name,fn){this.events[name]=fn;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}click(){this.events.click?.();}
}
const drawer={open:true};globalThis.document={createElement:tag=>new Node(tag),createTextNode:text=>{const n=new Node('text');n.textContent=text;return n;},getElementById:()=>drawer};
function mapFixture(){const sources=new Map(),layers=new Map(),container=new Node('map');return {sources,layers,container,getLayer:id=>layers.get(id),removeLayer:id=>layers.delete(id),getSource:id=>sources.get(id),removeSource:id=>sources.delete(id),addSource:(id,data)=>sources.set(id,data),addLayer:layer=>layers.set(layer.id,layer),getContainer:()=>container,easeTo(options){this.lastCamera=options;}};}
const find=(root,predicate)=>[root,...root.children.flatMap(c=>find(c,predicate))].filter(predicate);
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));};
let requests=0;globalThis.fetch=async()=>{requests++;return Response.json(data);};
const map=mapFixture(),controller=createPreparedness(map,{text:en=>en,isCurrent:()=>true,buildTag:'test'});
const first=controller.disclosure(12);first.open=true;first.events.toggle();await flush();
assert.match(first.textContent,/62 health reference locations/);assert.match(first.textContent,/234 school reference locations/);assert.equal(requests,1);
const next=find(first,n=>n.tag==='button'&&n.textContent==='Show next 20')[0];next.click();assert.match(first.textContent,/Showing 21–40 \/ 296/);find(first,n=>n.tag==='button'&&n.textContent==='Previous 20')[0].click();assert.match(first.textContent,/Showing 1–20 \/ 296/);
const search=find(first,n=>n.tag==='input')[0];search.value='kencana';search.events.input();assert.match(first.textContent,/Showing 1–2 \/ 2/);
find(first,n=>n.tag==='button'&&n.textContent==='POSYANDU KENCANA')[0].click();assert.equal(drawer.open,false);assert.deepEqual(map.lastCamera.center,[106.82088,-6.14246]);assert.match(map.container.textContent,/-6\.14246, 106\.82088/);assert.equal(map.sources.get('polder-preparedness').data.features.length,1);
const snapshot=controller.snapshot(12);assert.equal(snapshot.features.length,296);assert.equal(snapshot.sources[0].observedAt,null);
const second=controller.disclosure(1);assert.equal(map.layers.size,0,'boundary change clears markers');assert.equal(map.container.children.length,0,'boundary change clears location readout');second.open=true;second.events.toggle();await flush();assert.equal(requests,1,'valid reference product reused');controller.clear();assert.equal(map.sources.size,0);
let attempts=0;globalThis.fetch=async()=>++attempts===1?new Response('',{status:503}):Response.json(data);
const retry=createPreparedness(mapFixture(),{text:en=>en,isCurrent:()=>true,buildTag:'test'}),panel=retry.disclosure(12);panel.open=true;panel.events.toggle();await flush();assert.match(panel.textContent,/references unavailable/);find(panel,n=>n.tag==='button'&&n.textContent==='Retry references')[0].click();await flush();assert.match(panel.textContent,/62 health reference locations/);retry.clear();
let resolve;globalThis.fetch=()=>new Promise(r=>{resolve=r;});const slowMap=mapFixture(),slow=createPreparedness(slowMap,{text:en=>en,isCurrent:()=>true,buildTag:'test'}),late=slow.disclosure(12);late.open=true;late.events.toggle();slow.clear();resolve(Response.json(data));await flush();assert.doesNotMatch(late.textContent,/62 health reference locations/);assert.equal(slowMap.layers.size,0);
console.log('PASS actual preparedness controller: paging/search, precise map/readout, reference export scope, cache, retry, boundary cleanup and late response disposal');
