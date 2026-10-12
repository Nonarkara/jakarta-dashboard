import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Element {
  constructor(tag,children=[]){this.nodeType=1;this.tagName=tag;this.childNodes=children;this.attrs={};}
  hasAttribute(k){return k in this.attrs;}getAttribute(k){return this.attrs[k];}setAttribute(k,v){this.attrs[k]=v;} addEventListener(){}
}
const text=value=>({nodeType:3,nodeValue:value});
const node=text('Data & sources'), dynamic=text('Air quality · model'), heading=new Element('H2',[node]);
heading.attrs['aria-label']='Data & sources';
const body=new Element('BODY',[heading,new Element('P',[dynamic])]), title=new Element('TITLE',[text('JKTx 3D Atlas -- Jakarta block by block')]);
let mutation, ready;
const select=new Element('SELECT');
const window={location:{search:''},dispatchEvent(){}};
const document={body,documentElement:{},querySelector:()=>title,getElementById:()=>select,addEventListener:(_e,fn)=>{ready=fn;}};
const context=vm.createContext({window,document,URLSearchParams,localStorage:{getItem:()=>null,setItem(){}},CustomEvent:class{},MutationObserver:class{constructor(fn){mutation=fn;}observe(){}}});
vm.runInContext(fs.readFileSync(new URL('../public/translations.js',import.meta.url),'utf8'),context);
vm.runInContext(fs.readFileSync(new URL('../public/i18n.js',import.meta.url),'utf8'),context);ready();
assert.equal(document.documentElement.lang,'id');assert.equal(node.nodeValue,'Data dan sumber');assert.equal(heading.attrs['aria-label'],'Data dan sumber');assert.equal(dynamic.nodeValue,'Kualitas udara · model');
window.AtlasLanguage.set('en');assert.equal(node.nodeValue,'Data & sources');assert.equal(dynamic.nodeValue,'Air quality · model');
window.AtlasLanguage.set('id');dynamic.nodeValue='Air-quality feed unavailable or invalid. Retained values, if any, are marked last retrieved.';mutation([{type:'characterData',target:dynamic}]);
assert.match(dynamic.nodeValue,/tidak tersedia/);window.AtlasLanguage.set('en');assert.equal(dynamic.nodeValue,'Air-quality feed unavailable or invalid. Retained values, if any, are marked last retrieved.');
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8').replace(/<!--[^]*?-->|<script[^]*?<\/script>|<noscript[^]*?<\/noscript>/g,'');
const brands=new Set(['Jx','JKTx','Overture Maps','Google Open Buildings 2.5D Temporal','Google Open Buildings','GHSL','Esri World Imagery','OpenStreetMap','Open-Meteo / CAMS','Open-Meteo','RainViewer','NASA GIBS','JMA Himawari','GDACS','and','OpenStreetMap / ODbL','JKTx 3D Atlas -- jakarta.nonarkara.org --','Bahasa Indonesia','English']);
const missing=[];
for(const match of html.matchAll(/>([^<>]+)</g)){const s=match[1].replace(/\s+/g,' ').trim().replaceAll('&amp;','&');if(/[A-Za-z]/.test(s)&&!brands.has(s)&&!(s in window.ATLAS_ID))missing.push(s);}
assert.deepEqual(missing,[],'every static English interface string must have Indonesian');
console.log('PASS bilingual contract: complete static catalog, default Indonesian, reversible English, dynamic outage updates and accessible names');

const workerSource = fs.readFileSync(new URL('../src/index.ts',import.meta.url),'utf8');
for (const match of workerSource.matchAll(/const WATCH_[A-Z]+_ACTION = "([^"]+)"/g)) {
  assert.ok(match[1] in window.ATLAS_ID, 'every operator notice needs a complete Indonesian translation');
  window.AtlasLanguage.set('id');
  assert.notEqual(window.AtlasLanguage.translate(match[1]),match[1]);
  window.AtlasLanguage.set('en');
  assert.equal(window.AtlasLanguage.translate(match[1]),match[1]);
}
for (const match of html.matchAll(/(?:aria-label|title)="([^"]+)"/g)) {
  const value=match[1].replaceAll('&amp;','&');
  if (/[A-Za-z]/.test(value)) assert.ok(value in window.ATLAS_ID || brands.has(value), 'accessible name is bilingual: '+value);
}
window.AtlasLanguage.set('id');
assert.equal(window.AtlasLanguage.translate('US AQI 165, PM2.5 45 µg/m³'), 'AQI AS 165, PM2.5 45 µg/m³');
assert.equal(window.AtlasLanguage.translate('Open-Meteo / CAMS · model-estimate'), 'Open-Meteo / CAMS · perkiraan model');
assert.equal(window.AtlasLanguage.translate('Private repository'), 'Repositori privat');

// Research translations are explicit presentation views; the source stays exact.
vm.runInContext(fs.readFileSync(new URL('../public/reference-language.js',import.meta.url),'utf8'),context);
const native=window.CivicLanguage;
assert.equal(native.cost('IDR 7.80 Trillion','id'),'Rp 7,80 triliun');assert.equal(native.cost('IDR 7.80 Trillion','en'),'IDR 7.80 trillion');
assert.equal(native.text('Upon completion of FS','id'),'Setelah studi kelayakan selesai');assert.equal(native.text('Upon completion of FS','en'),'After the feasibility study is complete');
assert.equal(native.text('Masterplan Book 3: Executive Summary','id'),'Buku 3: Ringkasan eksekutif');
assert.equal(native.text('Development Area: 4,590 ha Total Pipe Length: 686.71 km','id'),'Luas pengembangan: 4.590 ha Panjang pipa keseluruhan: 686,71 km');
assert.equal(native.kind('Hutan Kota','en'),'Urban forest');assert.equal(native.kind('Hutan Kota','id'),'Hutan Kota');assert.equal(native.kind('Unknown source code','en'),'Unknown source code');
assert.equal(native.admin('Kota Adm. Jakarta Selatan','en'),'South Jakarta');assert.equal(native.alert('Observed','id'),'Teramati');
assert.equal(native.status('Monas · titik referensi','en'),'Monas · reference point');assert.equal(native.status('Monas · reference point','id'),'Monas · titik referensi');
const dashboardHtml=fs.readFileSync(new URL('../public/dashboard.html',import.meta.url),'utf8');assert.match(dashboardHtml,/id="language-toggle"/);assert.match(dashboardHtml,/data-en="Research">Riset/);assert.match(dashboardHtml,/data-en-placeholder="Gambir · hospital"/);
const dashboardSource=fs.readFileSync(new URL('../public/dashboard.js',import.meta.url),'utf8');assert.match(dashboardSource,/d\.language!==lang/,'Map acknowledgement must not create a language loop');assert.match(dashboardSource,/data-en-.*attribute/,'Accessible attributes switch with visible labels');
assert.match(fs.readFileSync(new URL('../public/official-data.js',import.meta.url),'utf8'),/expanded\.has\(p\.id\)/,'Expanded research rows survive a language change');
console.log('PASS native research: bilingual costs/documents/status/types, unchanged unknown values, visible switch, accessible attributes and state preservation');

assert.match(fs.readFileSync(new URL('../public/dashboard.js',import.meta.url),'utf8'),/mapReady\?t\('Atlas siap','Atlas ready'\):t\('Memuat atlas','Loading atlas'\)/,'language updates preserve map readiness');
