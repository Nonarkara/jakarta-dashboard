import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,unlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {snapshotInputs,changedInputs} from './release-snapshot.mjs';
const root=mkdtempSync(join(tmpdir(),'jakarta-release-inputs-'));
try {
  writeFileSync(join(root,'app.js'),'committed map');
  writeFileSync(join(root,'data.json'),'source evidence');
  const frozen=snapshotInputs(root,['app.js','data.json']);
  assert.deepEqual(changedInputs(root,frozen),[]);
  writeFileSync(join(root,'app.js'),'parallel agent edit');
  assert.deepEqual(changedInputs(root,frozen),['app.js'],'late client edits cannot be stamped as deployed');
  unlinkSync(join(root,'data.json'));
  assert.deepEqual(changedInputs(root,frozen),['app.js','data.json'],'deleted inputs also invalidate the receipt');
} finally {rmSync(root,{recursive:true,force:true});}
console.log('PASS release snapshot: unchanged bytes pass; late mutation and deletion fail');
