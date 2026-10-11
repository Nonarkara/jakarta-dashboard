// Audit reproduction, not a passing production contract. No network or R2 writes.
// Run: node docs/reproduce-air-boundaries.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace("./jakarta.js", new URL("../src/jakarta.js", import.meta.url).href);
const worker = (await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))).default;
const savedFetch = globalThis.fetch, savedCaches = globalThis.caches;
const points = [[-6.18,106.83],[-6.12,106.88],[-6.17,106.75],[-6.27,106.81],[-6.23,106.90]];
let offset = 0, shift = 0;
try {
  globalThis.caches = { default: { match: async () => null, put: async () => {} } };
  globalThis.fetch = async () => Response.json(points.map(([lat,lng]) => ({
    latitude: lat + shift, longitude: lng, utc_offset_seconds: offset,
    current_units: { us_aqi: 'USAQI', pm2_5: 'µg/m³' },
    current: { time: new Date().toISOString().slice(0,16), us_aqi: 160, pm2_5: 50 },
  })));
  for (const scenario of ['control', 'nonzero_timezone', 'shifted_44km']) {
    offset = scenario === 'nonzero_timezone' ? 25200 : 0;
    shift = scenario === 'shifted_44km' ? 0.4 : 0;
    const response = await worker.fetch(new Request('https://audit.test/api/atlas/air-quality'), {});
    const data = await response.json();
    const count = Array.isArray(data) ? data.length : 0;
    if (scenario === 'control') assert.equal(count, 5);
    console.log(`${scenario}: HTTP ${response.status}, accepted rows ${count}`);
    if (scenario !== 'control') console.log(count ? 'AUDIT FINDING: invalid sample accepted' : 'Boundary now rejects this fixture; update the audit.');
  }
} finally {
  globalThis.fetch = savedFetch;
  globalThis.caches = savedCaches;
}
