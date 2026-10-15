import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validCoastal,validLandCover} from '../public/water-context.js';
const base=process.env.ATLAS_URL||'https://jakarta.nonarkara.org';
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const path of ['/water-context.js','/data/jakarta-v1/worldcover-2021-reference.json','/data/jakarta-v1/worldcover-2021-reference.png']){
 const response=await fetch(base+path,{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200,path);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),hash(readFileSync(new URL('../public'+path,import.meta.url))),'exact new context asset: '+path);
 if(path.endsWith('.json'))assert.equal(validLandCover(JSON.parse(bytes)),true);
}
const response=await fetch(base+'/api/atlas/coastal',{signal:AbortSignal.timeout(18000)});assert.ok([200,503].includes(response.status),'bounded coastal envelope');const d=await response.json();
assert.equal(d.contract,'coastal-v1');assert.equal(d.station.code,'XJ001');assert.equal(d.tier,'official-coastal-forecast');assert.equal(d.datum,null);assert.ok(d.sourceUrl.startsWith('https://maritim.bmkg.go.id/'));assert.ok(Number.isFinite(Date.parse(d.checkedAt)));
if(response.status===200){assert.equal(validCoastal(d),true);console.log('PASS live BMKG Priok forecast: '+d.points.length+' dated points; issued '+d.issuedAt+'; datum unknown');}
else{assert.equal(d.available,false);assert.ok(d.error);assert.equal(response.headers.get('cache-control'),'no-store');console.log('WARN BMKG upstream unavailable; validated explicit coastal outage envelope');}
console.log('PASS exact water-context client and WorldCover manifest/image hashes');
