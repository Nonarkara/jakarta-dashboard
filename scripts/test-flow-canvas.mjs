// The flow canvas draws only what the cells say: exact reads of a uniform
// field, nothing past the grid's reach, and geographic steps that scale
// longitude by cos(latitude).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { makeSampler, stepLngLat, particleBudget } = await import(new URL('../public/flow-canvas.js', import.meta.url));

// The particle budget was previously pinned by matching the source text for
// `Math.min(850, Math.round(area / 1800))`, which passes whether or not the
// renderer calls it. These drive the real function.
assert.equal(particleBudget(1600, 900), 800, 'a 1600x900 map carries 800 streaks');
assert.equal(particleBudget(390, 844), 183, 'a 390x844 phone carries 183 streaks');
assert.ok(particleBudget(3840, 2160) === 850, 'a 4K window is capped at 850 streaks so a frame stays affordable');
assert.ok(particleBudget(2560, 1440) > particleBudget(1280, 720), 'a larger window carries more streaks');
assert.ok(particleBudget(390, 844) > 0, 'a phone still carries a field, not an empty canvas');
// The budget is a function of CSS pixels: a retina display must not draw twice
// the streaks of a non-retina one showing the same map.
assert.equal(particleBudget(780, 1688, 2), particleBudget(390, 844, 1), 'device pixel ratio does not change how many streaks are drawn');

// Everything above tests the VALUE. It cannot see a renderer that stopped
// calling the function — swapping `return particleBudget(...)` for a literal
// left this whole block green. This one check is deliberately structural: it
// asserts the wiring, and only the wiring.
const flowSrc = readFileSync(new URL('../public/flow-canvas.js', import.meta.url), 'utf8');
const population = flowSrc.match(/function population\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
assert.match(population, /particleBudget\(/, 'the renderer derives its particle count from particleBudget, not from a private literal');
assert.ok(population.length > 0, 'population() was located, so the wiring check cannot pass vacuously');

// A 0.25° grid of identical 10 m/s easterlies (air moving west: u = -10).
const cells = [];
for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) cells.push({ lng: 106.5 + j * 0.25, lat: -6.5 + i * 0.25, u: -10, v: 0 });
const s = makeSampler(cells);
assert.ok(Math.abs(s.spacingKm - 27.6) < 1, 'grid spacing is the median nearest-neighbour distance (~27.6 km): ' + s.spacingKm);
const mid = s.sample(106.8, -6.2);
assert.ok(Math.abs(mid.u + 10) < 1e-9 && Math.abs(mid.v) < 1e-9, 'a uniform field reads back exactly');
assert.equal(s.sample(110, -6.2), null, 'far beyond the grid there is no wind to read, so none is invented');
assert.equal(s.sample(106.5 + 1 + s.reachKm / 111 + 0.05, -6.0), null, 'just past reach is still nothing');
assert.equal(makeSampler([]), null); assert.equal(makeSampler([{ lng: 1, lat: 1, u: NaN, v: 0 }]), null, 'non-finite cells are dropped');

// One hour of a 10 m/s easterly at 6°S moves 36 km west.
const [lng, lat] = stepLngLat(106.8, -6.2, -10, 0, 3600);
const km = (106.8 - lng) * 111.32 * Math.cos(-6.2 * Math.PI / 180);
assert.ok(Math.abs(km - 36) < 0.05, 'westward displacement is 36 km: ' + km);
assert.equal(lat, -6.2);
// Same wind at 60°N covers twice the longitude, because a degree is half as wide.
const [lngHigh] = stepLngLat(0, 60, -10, 0, 3600);
assert.ok(Math.abs(-lngHigh / ((106.8 - lng) * Math.cos(-6.2 * Math.PI / 180) / Math.cos(60 * Math.PI / 180)) - 1) < 1e-9, 'longitude step scales with 1/cos(lat)');
// Northward wind moves north by v*t / 110.574 km per degree.
assert.ok(Math.abs(stepLngLat(0, 0, 0, 5, 3600)[1] - 18000 / 110574) < 1e-12);
console.log('PASS flow canvas: exact uniform reads, no wind past the grid reach, 36 km/h easterly moves 36 km west, cos(lat) longitude scaling');
