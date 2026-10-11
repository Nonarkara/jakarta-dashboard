import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const js=readFileSync(new URL('../public/dashboard.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/dashboard.html',import.meta.url),'utf8');
class Node {
 constructor(id,tag='DIV'){this.id=id;this.tagName=tag;this.children=[];this.events={};this.dataset={};this.open=false;}
 append(...nodes){for(const n of nodes){if(n.parent)n.parent.children=n.parent.children.filter(c=>c!==n);n.parent=this;this.children.push(n);}}
 prepend(n){this.append(n);this.children.unshift(this.children.pop());}
 querySelector(){return this.content;}
 addEventListener(name,fn){this.events[name]=fn;}
 showModal(){this.open=true;}
 close(){this.open=false;this.events.close?.();}
 focus(){this.focused=true;}
 getAttribute(){return '';}
}
const nodes=new Map(),get=id=>nodes.get(id);
for(const id of ['workspace','alerts-panel','observations','controls'])nodes.set(id,new Node(id));
const dialogs=['weather-detail','mobility','civic','crm','sources','warnings'].map(id=>{
 const d=new Node(id+'-dialog','DIALOG');d.content=new Node(id+'-content');nodes.set(d.id,d);return d;
});
const workspace=get('workspace');workspace.append(get('observations'),get('alerts-panel'));
const media={matches:false,addEventListener(_e,fn){this.change=fn;}};
const document={querySelectorAll:()=>dialogs,querySelector:s=>s==='.city-controls'?get('controls'):s==='.observations'?get('observations'):dialogs.find(d=>d.open),addEventListener(_e,fn){this.click=fn;}};
const context=vm.createContext({document,$:get,matchMedia:()=>media,location:{hash:''},crmViewerOpened:false});
const start=js.indexOf('function initDetailDialogs()');const end=js.indexOf('initDetailDialogs();',start);
vm.runInContext(js.slice(start,end)+'initDetailDialogs();',context);
for(const id of ['weather-detail','mobility','civic','crm','sources']){
 const d=get(id+'-dialog');const trigger=new Node('trigger');trigger.dataset.open=d.id;
 let prevented=false;document.click({target:{closest:()=>trigger},preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(d.open,true,'button opens '+id);d.close();assert.equal(trigger.focused,true,'closing restores focus');
 assert.match(html,new RegExp('<dialog id="'+id+'-dialog"[^]*?<section id="'+id+'"'),'original '+id+' content stays inside its dialog');
}
media.matches=true;media.change();assert.equal(get('observations').parent,get('weather-detail-dialog').content);assert.equal(get('alerts-panel').parent,get('warnings-dialog').content);
media.matches=false;media.change();assert.equal(get('observations').parent,workspace);assert.equal(get('alerts-panel').parent,workspace);
console.log('PASS popup contract: explicit opening, closing/focus, preserved sections and responsive panel docking');
