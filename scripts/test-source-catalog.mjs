import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=root+'public/data/jakarta-v1/';
const d=JSON.parse(fs.readFileSync(base+'source-catalog.json','utf8'));
assert.equal(d.schemaVersion,1);assert.ok(d.records.length>20);
const ids=new Set();
for(const r of d.records){
 assert.ok(!ids.has(r.id));ids.add(r.id);
 assert.ok(['integrated','candidate','blocked','registration-required'].includes(r.status));
 assert.equal(new URL(r.sourceUrl).protocol,'https:');
 assert.ok(r.license&&r.access&&r.verification&&r.limitations);
 for(const asset of r.assets){assert.ok(!asset.includes('..'));assert.ok(fs.existsSync(base+asset));if(r.assetSha256)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(base+asset)).digest('hex'),r.assetSha256);}
}
const flood=d.records.find(r=>r.id==='petabencana-area');assert.equal(flood.status,'candidate');assert.equal(flood.dataAsOf,'2024-09-27T11:02:28.940Z');assert.match(flood.limitations,/Not current/);
assert.equal(d.records.find(r=>r.id==='satudata-ridership').endpoint,'');
const csv=fs.readFileSync(base+'source-catalog.csv','utf8');
// RFC4180 parser permits quoted commas and doubled quotes.
let rows=[],row=[],cell='',quoted=false;
for(let i=0;i<csv.length;i++){const c=csv[i];if(c==='"'){if(quoted&&csv[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}
assert.equal(quoted,false);assert.equal(rows.length,d.records.length+1);
const header=rows.shift();for(let i=0;i<rows.length;i++)for(let j=0;j<header.length;j++){const v=d.records[i][header[j]];assert.equal(rows[i][j],Array.isArray(v)?v.join(';'):v==null?'':String(v));}
const scenario=JSON.parse(fs.readFileSync(base+'water-scenario.json','utf8'));
assert.match(scenario.sourceRouteGeometry,/Straight station-to-station schematic/);assert.match(scenario.routeGeometry,/Mapped OpenStreetMap Ciliwung/);assert.match(scenario.routeGeometry,/schematic fallback/);
for(const key of ['routeSourceAsset','routeManifestAsset'])assert.ok(fs.existsSync(root+'public'+scenario[key]));
console.log('source catalog: JSON/CSV parity, statuses, dates and asset hashes verified');
