import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const css=read('public/jakarta-design.css');
const base=Object.fromEntries([...css.slice(css.indexOf(':root {'),css.indexOf(':root[data-theme="light"]')).matchAll(/(--[a-z-]+): (#[0-9a-f]{6});/g)].map(m=>[m[1],m[2]]));
const luminance=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>{const[x,y]=[luminance(a),luminance(b)].sort((a,b)=>a-b);return (y+.05)/(x+.05);};
for(const theme of ['dark','light','contrast']){
 const block=css.match(new RegExp(':root\\[data-theme="'+theme+'"\\] \\{([^}]+)'))?.[1]||'';
 const tokens={...base,...Object.fromEntries([...block.matchAll(/(--[a-z-]+): (#[0-9a-f]{6});/g)].map(m=>[m[1],m[2]]))};
 for(const surface of ['--bg','--bg-raised','--bg-strong','--companion'])for(const ink of ['--ink','--dim','--accent'])assert.ok(ratio(tokens[ink],tokens[surface])>=4.5,theme+' '+ink+'/'+surface);
}
const font=readFileSync(new URL('../public/fonts/SourceSans3-variable.woff2',import.meta.url));assert.equal(font.subarray(0,4).toString(),'wOF2');assert.match(read('public/fonts/SourceSans3-OFL.txt'),/SIL OPEN FONT LICENSE/);
for(const f of ['public/dashboard.html','public/index.html'])assert.match(read(f),/\/jakarta-design\.css\?v=/);
const app=read('public/app.js');const theme=app.slice(app.indexOf('function applyMapTheme'),app.indexOf('window.addEventListener("atlas:theme"'));assert.doesNotMatch(theme,/rain-model-samples/,'brand theme changes may not replace the rain classification colours');
const js=read('public/dashboard.js');const source=js.slice(js.indexOf('function renderCrmViewerStatus()'),js.indexOf('const ledger=['));
const nodes=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,{hidden:id==='crm-viewer-shell',attributes:{},textContent:'',getAttribute(k){return this.attributes[k]??null;},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},addEventListener(k,fn){this[k]=fn;},scrollIntoView(){this.scrolled=true;},focus(){this.focused=true;},set src(v){this.attributes.src=v;}});return nodes.get(id);};
const context=vm.createContext({$:el,t:(id,en)=>en,crmViewerOpened:false,CRM_MONTHLY_URL:'https://datastudio.google.com/embed/reporting/d7d87175-bfa2-4067-bf4d-42e8b996da11/page/27A2C',matchMedia:()=>({matches:true})});
vm.runInContext(source,context);
assert.equal(el('crm-viewer').getAttribute('src'),null,'no third-party report loads before user action');
el('crm-load').click();assert.equal(el('crm-viewer-shell').hidden,false);assert.equal(el('crm-load').getAttribute('aria-expanded'),'true');assert.match(el('crm-viewer').getAttribute('src'),/^https:\/\/datastudio.google.com\/embed\/reporting\//);
el('crm-viewer').load();assert.match(el('crm-viewer-status').textContent,/Check its period and update time/,'iframe load must not claim data retrieval');
el('crm-close').click();assert.equal(el('crm-viewer-shell').hidden,true);assert.equal(el('crm-viewer').getAttribute('src'),null);assert.equal(el('crm-load').focused,true,'closing restores keyboard focus');
console.log('PASS local identity: three-theme contrast including green fields, licensed font, shared assets, rain semantics, CRM consent-to-load/close/focus and truthful viewer state');

// Real-estate law: the lens panel is a caption on the map, not a wall over it.
// At 520px the popup covered 22.6% of the map and sat against the lens row.
// Pin the budget on the element that actually carries the width — the POPUP.
// #atlas-lens-body is position:static inside it and only ever fills, so pinning
// the body is how a change lands and changes nothing.
{
 const design=read('public/jakarta-design.css');
 const rule=design.match(/body\.atlas-workbench \.atlas-lens-popup \{([^}]*)\}/)?.[1]||'';
 assert.ok(rule,'the workbench lens popup rule was located');
 const w=Number(rule.match(/width:min\((\d+)px/)?.[1]||0);
 assert.ok(w>0,'the popup width is declared in px');
 assert.ok(w<=400,'the lens popup is at most 400px wide (was 520px), got '+w);
 assert.match(rule,/top:calc\([\s\S]{0,140}?\+ \d+px\)/,'the popup drops clear of the lens row instead of sitting on it');
 assert.match(rule,/max-height:min\(\d+svh,/,'and its height stays bounded by what is left below, not an unbounded share');
 // The body rule is never allowed to grow geometry again: dead declarations that
 // read like positioning are how a 520px narrowing passed its own test and shipped
 // a no-op. Assert it is found, so the guard below cannot pass vacuously.
 const base=read('public/style.css');
 const bodyRule=base.match(/#atlas-lens-body \{([^}]*)\}/)?.[1]||'';
 assert.ok(bodyRule,'the base lens body rule was located');
 assert.ok(!/\b(position|width|height|min-height|max-height|top|right|left)\s*:/.test(bodyRule),'the static body declares no geometry; only .atlas-lens-popup positions the panel');

 // Narrowing the panel has to keep its content legible. .synoptic-facts sizes its
 // label track to the label, so at 380px the value track was squeezed to its longest
 // word and the pressure row wrapped to nine lines. In the rail it stacks instead.
 const stacked=read('public/style.css').match(/atlas-lens-popup \.synoptic-facts \{([^}]*)\}/)?.[1]||'';
 assert.ok(stacked,'the narrow-rail fact list rule was located');
 assert.match(stacked,/grid-template-columns:minmax\(0,1fr\)/,'the fact list stacks in the narrow rail so a long label cannot starve the value');
}
