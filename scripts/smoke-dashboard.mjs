import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=process.env.ATLAS_URL||'https://jakarta.nonarkara.org';
const r=await fetch(base+'/');assert.equal(r.status,200);const html=await r.text();assert.match(html,/data-surface="jakarta-dashboard"/);assert.match(html,/src="\/atlas\?showcase=1/);
const script=html.match(/src="(\/dashboard.js\?v=[^"]+)"/)[1];const deployed=await(await fetch(base+script)).text();const local=readFileSync(new URL('../public/dashboard.js',import.meta.url),'utf8');assert.equal(deployed,local,'exact dashboard asset deployed');
const tag=local.match(/const DASHBOARD_BUILD = '([^']+)'/)[1];assert.ok(script.includes(tag));
const design=html.match(/href="(\/jakarta-design.css\?v=[^"]+)"/)[1];assert.ok(design.includes(tag));
const css=await fetch(base+design);assert.equal(css.status,200);assert.equal(await css.text(),readFileSync(new URL('../public/jakarta-design.css',import.meta.url),'utf8'),'exact shared design deployed');
const font=await fetch(base+'/fonts/SourceSans3-variable.woff2');assert.equal(font.status,200);assert.deepEqual(Buffer.from(await font.arrayBuffer()),readFileSync(new URL('../public/fonts/SourceSans3-variable.woff2',import.meta.url)),'exact licensed font deployed');
assert.match(html,/id="crm-viewer"/);assert.match(deployed,/d7d87175-bfa2-4067-bf4d-42e8b996da11/);
assert.match(r.headers.get('content-security-policy'),/frame-src 'self' https:\/\/datastudio.google.com https:\/\/lookerstudio.google.com/);
const officialScript=html.match(/src="(\/official-data.js\?v=[^"]+)"/)[1];assert.ok(officialScript.includes(tag));
const referenceScript=html.match(/src="(\/reference-language.js\?v=[^"]+)"/)[1];assert.ok(referenceScript.includes(tag));
const floodScript=html.match(/src="(\/flood-data.js\?v=[^"]+)"/)[1];assert.ok(floodScript.includes(tag));
for(const path of [officialScript, referenceScript, floodScript, '/i18n.js', '/translations.js', '/dashboard.css', '/data/jakarta-v1/projects.json', '/data/jakarta-v1/flood-reference.json', '/data/jakarta-v1/city-context.json', '/data/jakarta-v1/green.geojson', '/data/jakarta-v1/health.geojson', '/data/jakarta-v1/schools.geojson', '/data/jakarta-v1/flood-network.json', '/data/jakarta-v1/risk.geojson', '/data/jakarta-v1/population.json', '/data/jakarta-v1/awlr.geojson', '/data/jakarta-v1/arr.geojson', '/data/jakarta-v1/pumps.geojson', '/data/jakarta-v1/situ.geojson', '/data/jakarta-v1/ispu-reference.json', '/data/jakarta-v1/insight.json', '/data/jakarta-v1/water-scenario.json', '/data/jakarta-v1/bpbd-water-reference.json', '/jakarta-rail.geojson', '/jakarta-landmarks.geojson', '/jakarta-areas.json']){
 const res=await fetch(base+path);assert.equal(res.status,200,path);assert.equal(await res.text(),readFileSync(new URL('../public'+path.split('?')[0],import.meta.url),'utf8'),'exact official data/client/CSS deployed: '+path);
}
assert.match(html,/id="official-dialog"/);assert.match(html,/id="flood-dialog"/);console.log('PASS exact official data snapshots and popup client/CSS');
for(const path of ['/data/jakarta-v1/transit.json','/data/jakarta-v1/civic.json']){const res=await fetch(base+path);assert.equal(res.status,200);assert.ok((await res.json()).retrievedAt);}
const transitIndex=JSON.parse(readFileSync(new URL('../public/data/jakarta-v1/transit.json',import.meta.url),'utf8'));
const details=Array.from(new Set(transitIndex.routes.map(r=>r.detail).filter(Boolean)));
assert.ok(details.length>0,'transit index must carry detail routes');
for(const p of details){const out=await fetch(base+p);assert.equal(out.status,200,'detail status: '+p);}
for(const p of [details[0],details[details.length>>1],details.at(-1)]){
 const res=await fetch(base+p);assert.equal(await res.text(),readFileSync(new URL('../public'+p,import.meta.url),'utf8'),'exact route detail deployed: '+p);}
for(const path of ['/api/jakarta/weather','/api/jakarta/alerts','/api/jakarta/earthquake','/api/jakarta/flood-reports']){
 const res=await fetch(base+path);assert.ok([200,503].includes(res.status),path+' must return a bounded data envelope');const d=await res.json();assert.ok(d.source&&d.tier&&d.fetchedAt,path+' source/tier/time');if(res.status===503)console.log('WARN upstream unavailable:',path);else console.log('PASS',path);
}
console.log('PASS dashboard root, preserved atlas link, exact build bytes, prepared data and all four provider envelopes · '+tag);
