import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validatePreparedness,referenceRows,referenceCsv} from '../public/polder-preparedness.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const data=JSON.parse(read('public/data/jakarta-v1/polder-facilities.json'));
assert.ok(validatePreparedness(data));assert.equal(data.boundaries.length,64);assert.deepEqual(data.excludedBoundaryIds,[48]);assert.equal(data.features.length,1990);
for(const source of data.sources){const raw=read('public/data/jakarta-v1/'+source.asset);assert.equal(createHash('sha256').update(raw).digest('hex'),source.sha256);assert.equal(source.inputRows,source.validUniqueRows+source.duplicates+source.invalidRows.length);assert.equal(source.validUniqueRows,source.insideAnyBoundary+source.outsideAllBoundaries);assert.equal(source.observedAt,null);}
assert.deepEqual(data.sources.map(s=>[s.duplicates,s.insideAnyBoundary]),[[140,312],[627,1678]]);
for(const b of data.boundaries){const rows=referenceRows(data,b.id);assert.equal(rows.length,b.counts.health+b.counts.schools);assert.equal(new Set(rows.map(f=>f.properties.key)).size,rows.length);}
assert.equal(referenceRows(data,48),null);assert.deepEqual(referenceRows(data,1,'absolutely-unmatched'),[]);
assert.equal(validatePreparedness({...data,features:[null]}),false);
assert.equal(validatePreparedness({...data,features:[...data.features,data.features[0]]}),false);
assert.equal(validatePreparedness({...data,boundaries:data.boundaries.map((b,i)=>i?b:{...b,counts:{health:999,schools:999}})}),false);
const row=structuredClone(data.features[0]);row.properties.name='=HYPERLINK("https://example.invalid")';
let csv=referenceCsv([row],data.sources,data.boundaries[0]);assert.ok(csv.includes('"\'=HYPERLINK('));assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('Published reference point membership'));
for(const payload of ['+SUM(1,1)','-1+1','@SUM(1,1)',' \t=1+1','\ttext','\rtext']){row.properties.name=payload;assert.ok(referenceCsv([row],data.sources,data.boundaries[0]).includes('"\''+payload));}
console.log('PASS preparedness: source hashes, duplicate reconciliation, all boundary lists, unknowns, malformed assets and spreadsheet-injection protection');

assert.ok(referenceRows(data,12)[0].properties.name.trim(),'named records precede unnamed/whitespace records');
