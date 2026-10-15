import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const root=new URL('../',import.meta.url),load=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const m=load('public/data/jakarta-v1/official-drainage-manifest.json');
assert.equal(m.sourceRecordCount,60718);assert.equal(m.count+m.excluded,m.sourceRecordCount);assert.equal(m.count,60714);assert.equal(m.dataAsOf,null);
assert.equal(m.tiles.sourceLayer,'official_drains');assert.equal(m.tiles.path,'/jakarta-official-drainage.pmtiles');assert.equal(m.tiles.minzoom,11);assert.equal(m.tiles.maxzoom,16);assert.match(m.limitations,/no publication epoch|no.*epoch/i);
const evidence=new URL('data/source-evidence/coverage-audit-2026-10-15/',root),ids=new Set(),digest=crypto.createHash('sha256');let sourceCount=0;
for(let offset=0;offset<m.sourceRecordCount;offset+=1000){const b=gunzipSync(fs.readFileSync(new URL('drainage-'+String(offset).padStart(5,'0')+'.json.gz',evidence)));digest.update(b);const page=JSON.parse(b);for(const f of page.features){assert.ok(!ids.has(f.properties.OBJECTID));ids.add(f.properties.OBJECTID);sourceCount++;}}
assert.equal(sourceCount,m.sourceRecordCount);assert.equal(digest.digest('hex'),m.rawSha256);
const archive=new URL('data/tiles/jakarta-official-drainage-v1.pmtiles',root);
if(fs.existsSync(archive)){const b=fs.readFileSync(archive);assert.equal(b.subarray(0,7).toString(),'PMTiles');assert.equal(b[100],11);assert.equal(b[101],16);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),m.tiles.sha256);assert.equal(b.length,m.tiles.bytes);}
const p=load('public/data/jakarta-v1/official-polders.geojson'),pm=load('public/data/jakarta-v1/official-polders-manifest.json');assert.equal(p.features.length,65);assert.equal(pm.dataAsOf,null);assert.deepEqual(p.features.filter(f=>!f.properties.geometryValid).map(f=>f.properties.OBJECTID),pm.invalidObjectIds);assert.deepEqual(pm.invalidObjectIds,[48]);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('public/data/jakarta-v1/official-polders.geojson',root))).digest('hex'),pm.assetSha256);
console.log('PASS official drainage: every source page/digest, count reconciliation, honest metadata, archive hash/header, polder invalid-shape flags');
