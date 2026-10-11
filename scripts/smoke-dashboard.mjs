import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=process.env.ATLAS_URL||'https://jakarta.nonarkara.org';
const r=await fetch(base+'/');assert.equal(r.status,200);const html=await r.text();assert.match(html,/data-surface="jakarta-dashboard"/);assert.match(html,/src="\/atlas\?showcase=1/);
const script=html.match(/src="(\/dashboard.js\?v=[^"]+)"/)[1];const deployed=await(await fetch(base+script)).text();const local=readFileSync(new URL('../public/dashboard.js',import.meta.url),'utf8');assert.equal(deployed,local,'exact dashboard asset deployed');
const tag=local.match(/const DASHBOARD_BUILD = '([^']+)'/)[1];assert.ok(script.includes(tag));
for(const path of ['/data/jakarta-v1/transit.json','/data/jakarta-v1/civic.json']){const res=await fetch(base+path);assert.equal(res.status,200);assert.ok((await res.json()).retrievedAt);}
for(const path of ['/api/jakarta/weather','/api/jakarta/alerts','/api/jakarta/earthquake','/api/jakarta/flood-reports']){
 const res=await fetch(base+path);assert.ok([200,503].includes(res.status),path+' must return a bounded data envelope');const d=await res.json();assert.ok(d.source&&d.tier&&d.fetchedAt,path+' source/tier/time');if(res.status===503)console.log('WARN upstream unavailable:',path);else console.log('PASS',path);
}
console.log('PASS dashboard root, preserved atlas link, exact build bytes, prepared data and all four provider envelopes · '+tag);
