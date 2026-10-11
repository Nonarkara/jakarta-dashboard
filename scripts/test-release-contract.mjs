import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace("./jakarta.js", new URL("../src/jakarta.js", import.meta.url).href);
const worker = (await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))).default;
const originalFetch = globalThis.fetch, originalCaches = globalThis.caches;
const stamp = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString().slice(0, 16);
let air = [];
let head = { size: 1000, httpEtag: '"atlas"' }, reads = 0;
const areas = JSON.parse(readFileSync(new URL('../public/jakarta-areas.json', import.meta.url), 'utf8'));
const env = {
  ASSETS: { fetch: async () => Response.json(areas) },
  JAKARTA_TILES: { head: async () => head, get: async (_key, options) => { reads++; return { body: new Uint8Array(options?.range?.length ?? 1000), size: 1000 }; } },
};
globalThis.caches = { default: { match: async () => null, put: async () => {} } };
globalThis.fetch = async url => {
  const host = new URL(url).hostname;
  if (host === 'air-quality-api.open-meteo.com') return Response.json(air);
  return new Response(null, { status: 503 });
};
const request = (path, options) => worker.fetch(new Request('https://atlas.test' + path, options), env);
try {
  for (const path of ['/api/atlas/areas', '/api/atlas/buildings']) {
    for (const bbox of ['bad', '107,-6,106,-7', '106,,107,-6', '106,-7,107,100']) assert.equal((await request(path + '?bbox=' + bbox)).status, 400);
  }
  for (const query of ['lng=106.8oops&lat=-6.2', 'lng=&lat=', 'lng=106.8&lat=-6.2no']) assert.equal((await request('/api/atlas/at-this-point?' + query)).status, 400);
  const outside = await request('/api/atlas/at-this-point?lng=106.7&lat=10.78');
  assert.equal(outside.status, 400); assert.equal((await outside.json()).error, 'out_of_jakarta_bbox');

  // Air quality comes straight from Open-Meteo; invalid rows never become zero AQI.
  air = [null, { latitude: -6.12, longitude: 106.88, current_units: { us_aqi: 'USAQI' }, current: { time: stamp, us_aqi: null } }];
  assert.equal((await request('/api/atlas/air-quality')).status, 503, 'invalid data never becomes zero AQI');
  air = [-6.18, -6.12, -6.17, -6.27, -6.23].map((lat, i) => ({ latitude: lat, longitude: [106.83, 106.88, 106.75, 106.81, 106.90][i],
    utc_offset_seconds: 0, current_units: { pm2_5: 'µg/m³', pm10: 'µg/m³', us_aqi: 'USAQI' }, current: { time: stamp, pm2_5: 20, pm10: 30, us_aqi: i === 1 ? 160 : 0 } }));
  let rows = await (await request('/api/atlas/air-quality')).json();
  assert.equal(rows.length, 5); assert.equal(rows[0].aqi, 0, 'zero AQI is valid data'); assert.equal(rows[1].category, 'Unhealthy');
  air.forEach(row => { row.utc_offset_seconds = 25200; });
  assert.equal((await request('/api/atlas/air-quality')).status, 503, 'non-UTC data rejected');
  air.forEach(row => { row.utc_offset_seconds = 0; row.latitude += 0.4; });
  assert.equal((await request('/api/atlas/air-quality')).status, 503, 'wrong model location rejected');
  air.forEach(row => { row.latitude -= 0.4; });
  air.forEach(row => { row.current.time = '2020-01-01T00:00'; });
  assert.equal((await request('/api/atlas/air-quality')).status, 503, 'stale model time is not current air');

  const here = await (await request('/api/atlas/at-this-point?lng=106.8205&lat=-6.2060')).json();
  assert.equal(here.nearestArea.id, 'sudirman-thamrin');
  assert.equal(here.nearestModelSample.id, 'pusat');
  assert.equal(here.nearestModelSample.available, false, 'weather outage is reported, not filled');

  for (const retired of ['/api/risk', '/api/traffic', '/api/atlas/transit', '/api/atlas/scoreboard', '/api/atlas/city-events']) {
    const r = await request(retired);
    assert.notEqual(r.headers.get('content-type'), 'application/json; charset=utf-8', retired + ' must not invent a feed');
  }

  let response = await request('/jakarta-buildings.pmtiles', { method: 'HEAD' });
  assert.equal(response.status, 200); assert.equal(reads, 0); assert.equal(await response.text(), '');
  response = await request('/jakarta-buildings.pmtiles', { headers: { range: 'bytes=995-1100' } });
  assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), 'bytes 995-999/1000');
  assert.equal((await response.arrayBuffer()).byteLength, 5);
  response = await request('/jakarta-buildings.pmtiles', { headers: { range: 'bytes=1000-' } });
  assert.equal(response.status, 416); assert.equal(response.headers.get('content-range'), 'bytes */1000');
  response = await request('/jakarta-buildings.pmtiles', { headers: { range: 'bytes=-10' } });
  assert.equal(response.headers.get('content-range'), 'bytes 990-999/1000');
  assert.equal(response.headers.get('x-jktx-source'), 'R2 jakarta-tiles/buildings/jakarta-v1.pmtiles');
  head = null;
  response = await request('/api/health');
  assert.equal(response.status, 503); assert.equal((await response.json()).ok, false);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'self'/);
  assert.equal((await request('/api/atlas/areas', { method: 'POST' })).status, 405);
} finally { globalThis.fetch = originalFetch; globalThis.caches = originalCaches; }
console.log('PASS release contract: input validation, bbox, air-quality truth, nearest-sample honesty, retired feeds, HEAD, Range, health and headers');
