import assert from 'node:assert/strict';
import {tileFor,metresPerPixel,decodeTerrarium,sampleElevation,groundElevation,ELEVATION_SOURCE} from '../public/ground-elevation.js';

// The tile that holds a point. Jakarta, at the zoom the place context uses.
const jakarta = tileFor(-6.2088, 106.8456, 13);
assert.deepEqual(jakarta, { z: 13, x: 6527, y: 4237 }, 'the tile under Jakarta is the tile the terrain service serves');
assert.equal(tileFor(NaN, 106.8, 13), null, 'a broken coordinate has no tile');
assert.equal(tileFor(-6.2, 106.8, 13).z, 13);

// How coarse the ground model is, at that latitude.
const resolution = metresPerPixel(-6.2088, 13);
assert.ok(resolution > 18 && resolution < 20, 'about 19 m of ground per pixel over Jakarta');
assert.ok(metresPerPixel(0, 13) > resolution, 'the pixels shrink towards the poles');

// Terrarium: metres = R * 256 + G + B / 256 - 32768.
assert.equal(decodeTerrarium(128, 0, 0), 0, 'the encoding is centred on sea level');
assert.equal(decodeTerrarium(0, 0, 0), -32768);
assert.ok(Math.abs(decodeTerrarium(129, 0, 0) - 256) < 1e-9);

// The pixel inside the tile that holds the point.
const width = 256, height = 256;
const pixels = new Uint8ClampedArray(width * height * 4);
// fill the tile with 10 m
for (let i = 0; i < width * height; i++) { pixels[i*4] = 128; pixels[i*4+1] = 0; pixels[i*4+2] = 128*256/256*0; }
// 10 m in terrarium is R*256 + G + B/256 - 32768 = 10 -> R = 128, G = 10, B = 0
for (let i = 0; i < width * height; i++) { pixels[i*4] = 128; pixels[i*4+1] = 10; pixels[i*4+2] = 0; }
assert.equal(sampleElevation(pixels, width, height, -6.2088, 106.8456, 13), 10, 'the sample comes from the pixel that holds the point');
assert.equal(sampleElevation(null, width, height, -6.2088, 106.8456, 13), null, 'no pixels, no height');
assert.equal(sampleElevation(pixels, width, height, 91, 181, 13), null, 'a point outside the world has no pixel');

// The whole call: a fetched tile, decoded, with its source and its coarseness.
let requested = null;
const ok = await groundElevation({
  lat: -6.2088, lng: 106.8456, zoom: 13,
  fetch: async (url) => { requested = url; return { ok: true, blob: async () => 'blob' }; },
  decodeImage: async () => ({ data: pixels, width, height }),
});
assert.ok(ok, 'a readable tile gives a height');
assert.equal(ok.metres, 10);
assert.ok(ok.resolutionMetres > 18 && ok.resolutionMetres < 20, 'the height carries its own resolution');
assert.equal(ok.source, ELEVATION_SOURCE, 'the height carries its source');
assert.equal(requested, '/api/ground-elevation?z=13&x=6527&y=4237', 'the tile asked for is the tile that holds the point, through our own edge');

// A missing tile is UNKNOWN, never zero. A height of zero is a real reading
// in Jakarta — it is the low city — and it must not be faked by a failure.
const missing = await groundElevation({
  lat: -6.2088, lng: 106.8456, zoom: 13,
  fetch: async () => ({ ok: false, blob: async () => null }),
});
assert.equal(missing, null, 'an unavailable tile is null, not zero');
const failed = await groundElevation({
  lat: -6.2088, lng: 106.8456, zoom: 13,
  fetch: async () => { throw Error('network'); },
});
assert.equal(failed, null, 'a failed tile is null, not zero');
assert.equal(await groundElevation({ lat: NaN, lng: 106.8, zoom: 13, fetch: async () => ({ ok: true }) }), null, 'a broken point has no height');

console.log('ground elevation: tile maths, terrarium decoding, sampling, resolution and an unavailable tile that stays unknown');
