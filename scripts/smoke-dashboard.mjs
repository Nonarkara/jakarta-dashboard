import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=process.env.ATLAS_URL||'https://jakarta.nonarkara.org';
const r=await fetch(base+'/');assert.equal(r.status,200);const html=await r.text();assert.match(html,/data-surface="jakarta-dashboard"/);assert.match(html,/src="\/atlas\?showcase=1/);
const script=html.match(/src="(\/dashboard.js\?v=[^"]+)"/)[1];const deployed=await(await fetch(base+script)).text();const local=readFileSync(new URL('../public/dashboard.js',import.meta.url),'utf8');assert.equal(deployed,local,'exact dashboard asset deployed');
const tag=local.match(/const DASHBOARD_BUILD = '([^']+)'/)[1];assert.ok(script.includes(tag));
const design=html.match(/href="(\/jakarta-design.css\?v=[^"]+)"/)[1];assert.ok(design.includes(tag));
const css=await fetch(base+design);assert.equal(css.status,200);assert.equal(await css.text(),readFileSync(new URL('../public/jakarta-design.css',import.meta.url),'utf8'),'exact shared design deployed');
const font=await fetch(base+'/fonts/PlusJakartaSans-variable.woff2');assert.equal(font.status,200);assert.deepEqual(Buffer.from(await font.arrayBuffer()),readFileSync(new URL('../public/fonts/PlusJakartaSans-variable.woff2',import.meta.url)),'exact licensed font deployed');
assert.match(html,/id="crm-viewer"/);assert.match(deployed,/d7d87175-bfa2-4067-bf4d-42e8b996da11/);
assert.match(r.headers.get('content-security-policy'),/frame-src 'self' https:\/\/datastudio.google.com https:\/\/lookerstudio.google.com/);
for(const path of ['/data/jakarta-v1/transit.json','/data/jakarta-v1/civic.json']){const res=await fetch(base+path);assert.equal(res.status,200);assert.ok((await res.json()).retrievedAt);}
for(const path of ['/api/jakarta/weather','/api/jakarta/alerts','/api/jakarta/earthquake','/api/jakarta/flood-reports']){
 const res=await fetch(base+path);assert.ok([200,503].includes(res.status),path+' must return a bounded data envelope');const d=await res.json();assert.ok(d.source&&d.tier&&d.fetchedAt,path+' source/tier/time');if(res.status===503)console.log('WARN upstream unavailable:',path);else console.log('PASS',path);
}
console.log('PASS dashboard root, preserved atlas link, exact build bytes, prepared data and all four provider envelopes · '+tag);
