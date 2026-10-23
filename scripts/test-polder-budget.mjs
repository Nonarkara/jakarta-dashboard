import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {waterBudget,stormProfile,rainForBoundary} from '../public/polder-budget-model.js';
const data=JSON.parse(readFileSync(new URL('../public/data/jakarta-v1/polder-budget-context.json',import.meta.url)));
const polygons=JSON.parse(readFileSync(new URL('../public/data/jakarta-v1/official-polders.geojson',import.meta.url)));
assert.equal(data.count,64);assert.equal(data.sourceRecordCount,65);assert.deepEqual(data.excluded.map(r=>r.id),[48]);assert.ok(data.overlapPairs.length>0);
const ids=new Set();for(const row of data.records){assert.ok(!ids.has(row.id));ids.add(row.id);assert.ok(polygons.features.some(f=>f.properties.OBJECTID===row.id));assert.ok(row.areaM2>0);assert.equal(row.classes.reduce((n,c)=>n+c.cells,0),row.validCells);assert.equal(row.nativeCells,row.validCells+row.nodataCells);}
const hash=p=>createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex');
assert.equal(hash('public/data/jakarta-v1/official-polders.geojson'),data.inputHashes.displayPolders);
assert.equal(hash('data/source-evidence/terrain-satellite-2026-10-15/worldcover-2021-jakarta-native.tif'),data.inputHashes.nativeWorldCover);
let budget=waterBudget({areaM2:1e6,rainMm:stormProfile()});assert.ok(Math.abs(budget.remainingM3-50000)<1e-8);
budget=waterBudget({areaM2:1e6,rainMm:stormProfile(),runoffFraction:.5,pumpM3s:1,freeStorageM3:5000});assert.ok(budget.peakM3>5000);assert.ok(budget.maxAboveSpaceM3>0);assert.ok(Math.abs(budget.conservationErrorM3)<1e-8);assert.equal(budget.remainingM3,0,'dry hours can remove the remaining account');
for(const pumpM3s of [0,1,10,1000])for(const fraction of [0,.35,1]){const result=waterBudget({areaM2:1234567,rainMm:stormProfile(71,7),pumpM3s,runoffFraction:fraction,initialM3:500,freeStorageM3:0});assert.ok(Math.abs(result.conservationErrorM3)<1e-6);assert.ok(result.rows.every(r=>r.remainingM3>=0&&r.pumpedM3<=pumpM3s*3600));}
assert.equal(waterBudget({areaM2:1e6,rainMm:Array(24).fill(0),pumpM3s:100}).removedM3,0,'pump cannot remove absent water');
assert.equal(waterBudget({areaM2:1e6,rainMm:stormProfile(),freeStorageM3:null}).maxAboveSpaceM3,null,'unknown storage is not zero');
for(const rainMm of [null,Array(24).fill(null),Array(23).fill(0),Array(24).fill('0')])assert.equal(waterBudget({areaM2:1e6,rainMm}),null);
const now=Date.UTC(2026,9,23,8,30),from=Date.UTC(2026,9,23,9),boundary={representativePoint:[106.8,-6.2]};
const point={available:true,name:'Sample',validAt:new Date(now).toISOString(),forecastFromUtc:new Date(from).toISOString(),forecastToUtc:new Date(from+86400000).toISOString(),modelLocation:{lng:106.8,lat:-6.2},forecast:Array.from({length:24},(_,i)=>({validAt:new Date(from+(i+1)*3600000).toISOString(),precipitationMm:i===0?0:1}))};
const raw={timezone:'UTC',fetchedAt:new Date(now).toISOString(),points:[point]};assert.equal(rainForBoundary(raw,boundary,now).mm[0],0);
for(const patch of [{modelLocation:{lng:107.5,lat:-6.2}},{forecast:point.forecast.slice(1)},{forecast:point.forecast.map((r,i)=>i===2?{...r,precipitationMm:null}:r)},{forecast:point.forecast.map((r,i)=>i===2?{...r,validAt:point.forecast[1].validAt}:r)},{forecastFromUtc:'bad'}])assert.equal(rainForBoundary({...raw,points:[{...point,...patch}]},boundary,now),null);
assert.equal(rainForBoundary(raw,boundary,now+1800001),null,'old fetch is refused');assert.equal(rainForBoundary({...raw,fetchedAt:new Date(now+600000).toISOString()},boundary,now),null);
console.log('PASS polder budget: raw hashes, exclusions, native cells, exact rain intervals, actual-cell distance, unknowns and water conservation');

// Seeded independent-review case: full removal must yield exactly zero, never −0.
let seed=123456789;const random=()=>((seed=Math.imul(1664525,seed)+1013904223>>>0)/4294967296);
for(let k=0;k<1000;k++){const result=waterBudget({areaM2:1e5+random()*3e7,rainMm:Array.from({length:24},()=>random()*200),pumpM3s:random()*500,runoffFraction:random(),initialM3:random()*1e6,freeStorageM3:random()*1e6});assert.ok(result.rows.every(r=>r.remainingM3>=0));assert.ok(Math.abs(result.conservationErrorM3)<1e-5);}
