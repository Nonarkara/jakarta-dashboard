import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const m=JSON.parse(fs.readFileSync(path.join(root,'public/data/jakarta-v1/worldcover-2021-reference.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(m.schema,1); assert.equal(m.sourceTile,'S09E105'); assert.equal(m.license,'CC BY 4.0');
assert.equal(m.periodStart,'2021-01-01T00:00:00Z'); assert.equal(m.periodEnd,'2021-12-31T23:59:59Z');
assert.equal(m.nativeWidth,4200); assert.equal(m.nativeHeight,3840);
assert.equal(m.nativeCells,16128000); assert.equal(m.validCells+m.nodataCells,m.nativeCells);
assert.equal(m.classes.reduce((sum,c)=>sum+c.cells,0),m.validCells);
assert.equal(m.nodataValue,0); assert.equal(m.nativeResolutionMetres,10);
assert.deepEqual(m.bounds,m.requestedBounds);
assert.deepEqual(m.imageCoordinates,[[106.65,-6.08],[107,-6.08],[107,-6.4],[106.65,-6.4]]);
assert.match(m.display.resampling,/nearest/); assert.equal(m.display.nominalResolutionMetres,20);
assert.equal(m.display.width*2,m.nativeWidth); assert.equal(m.display.height*2,m.nativeHeight);
const image=fs.readFileSync(path.join(root,'public',m.display.path));
assert.equal(sha(image),m.display.sha256); assert.equal(image.length,m.display.bytes);
assert.deepEqual([...image.subarray(0,8)],[137,80,78,71,13,10,26,10]);
assert.equal(image.readUInt32BE(16),2100); assert.equal(image.readUInt32BE(20),1920);
assert.equal(sha(fs.readFileSync(path.join(root,m.rawCrop.evidencePath))),m.rawCrop.sha256);
assert.match(m.limitationsEn,/not current flood extent/); assert.match(m.limitationsId,/bukan genangan terkini/);
// Native counts and every displayed RGBA pixel must be derived from the admitted crop.
execFileSync('python3',['-c',`
import json,numpy as np,rasterio
from PIL import Image
from pathlib import Path
root=Path(${JSON.stringify(root)})
m=json.loads((root/'public/data/jakarta-v1/worldcover-2021-reference.json').read_text())
with rasterio.open(root/m['rawCrop']['evidencePath']) as src:
 a=src.read(1)
 assert list(src.bounds)==m['bounds']
 assert src.crs.to_epsg()==4326 and src.nodata==m['nodataValue']
 assert src.tags()['time_start']==m['periodStart']
values,counts=np.unique(a,return_counts=True)
h=dict(zip(values.tolist(),counts.tolist()))
assert h.get(0,0)==m['nodataCells']
assert all(h.get(c['value'],0)==c['cells'] for c in m['classes'])
b=np.asarray(Image.fromarray(a).resize((2100,1920),Image.Resampling.NEAREST))
actual=np.asarray(Image.open(root/'public'/m['display']['path'].lstrip('/')))
expected=np.zeros((*b.shape,4),dtype=np.uint8)
for c in m['classes']: expected[b==c['value']]=(*bytes.fromhex(c['color'][1:]),255)
assert np.array_equal(actual,expected), 'Display is not nearest-neighbour categorical source'
`],{stdio:'pipe'});
console.log('PASS WorldCover native class reconciliation, provenance, bounds, SHA256 and every nearest-neighbour display pixel');
