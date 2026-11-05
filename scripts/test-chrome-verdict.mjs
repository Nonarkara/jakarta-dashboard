import assert from 'node:assert/strict';
import {chromeDifference,plantedBandDetected} from './chrome-verdict.mjs';
const receipt={top:23,topSel:'header'},control={chrome:23,blocks:1},planted={chrome:47,blocks:2};
assert.equal(chromeDifference(receipt,control),false);
assert.equal(plantedBandDetected(receipt,control,planted),true,'positive control sees the specific24px band');
for(const invalid of [null,{}, {error:'navigation timeout',chrome:47,blocks:2},{chrome:NaN,blocks:2},{chrome:47,blocks:null}]){
 assert.equal(plantedBandDetected(receipt,control,invalid),false,'infrastructure/missing result cannot kill fixture');
 assert.throws(()=>chromeDifference(receipt,invalid));
}
for(const candidate of [control,{chrome:23,blocks:2},{chrome:10,blocks:2},{chrome:80,blocks:2},{chrome:47,blocks:1}])assert.equal(plantedBandDetected(receipt,control,candidate),false,'unrelated changes are not the planted band');
assert.equal(plantedBandDetected(receipt,{chrome:0,blocks:0},planted),false,'a broken control is not a baseline');
assert.equal(plantedBandDetected(null,control,planted),false,'missing receipt cannot pass');
assert.throws(()=>chromeDifference(null,control));
// A band that clips its own content is a difference, even when its height
// and its block count are exactly what the receipt says. This is the axis
// the receipt cannot hold: how tall the chrome is, yes; whether the reader
// can see what is inside it, no.
assert.equal(chromeDifference(receipt,{chrome:23,blocks:1,clipped:[{key:'nav.sections in nav.sections',text:'At'}]}),true,'a band that clips its own content differs from the receipt');
assert.equal(chromeDifference(receipt,{chrome:23,blocks:1,clipped:[]}),false,'a band that clips nothing is unchanged');
console.log('PASS chrome verdict: exact positive delta, healthy control, missing/error/timeout outcomes, unrelated mismatches and clipped band content');
