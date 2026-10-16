// Regression suite for the rain lens's synoptic layer.
//
// The failure this exists to stop: a pressure layer that draws confidently from
// a field it does not have. Every assertion below was checked by putting the
// bug back and watching it fail.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const client = read('public/synoptic.js');
const server = read('src/index.ts');
const app = read('public/app.js');
const mod = await import('../public/synoptic.js');

// ── The client math ───────────────────────────────────────────────────────
assert.equal(mod.flowVector(0, 10).toward, 180, 'wind FROM north blows toward the south');
assert.equal(mod.flowVector(270, 10).toward, 90, 'wind FROM west blows toward the east');
for (const bad of [null, NaN, -1, '270', 361]) {
  assert.equal(mod.flowVector(bad, 10), null, 'an out-of-range bearing is unknown, not a vector');
}
for (const bad of [null, undefined, NaN, -1, '10', Infinity]) {
  assert.equal(mod.flowVector(270, bad), null, 'a non-numeric speed is unknown, not calm');
}

// A synthetic grid: pressure falls to a low in the south-west corner, so the
// contour lines have a known shape and a known count. Cells carry `mslpHpa`
// hoisted, which is the shape hoursOf() produces for the contour code.
const mkCell = (lat, lng, mslpHpa, hours) => ({
  lat, lng, mslpHpa, hours: hours.map((h, i) => ({ validAt: 'h' + i, mslpHpa: h })),
});
const grid = [
  mkCell(-6, 104, 1008, [1008, 1008]),
  mkCell(-6, 106, 1006, [1006, 1006]),
  mkCell(-6, 108, 1008, [1008, 1008]),
  mkCell(-8, 104, 1004, [1004, 1002]),
  mkCell(-8, 106, 990, [990, 984]),
  mkCell(-8, 108, 1004, [1004, 1002]),
];
const rows = mod.gridOf(grid);
assert.equal(rows.length, 2, 'rows are grouped by latitude');
assert.equal(rows[0].cells.length, 3, 'each row keeps its columns in longitude order');
// A cell whose pressure only exists inside its hours array must NOT be
// contoured: the shape contour() reads is the top-level one. This is the exact
// bug that produced an empty isobar field, so it is checked through the real
// entry point rather than through gridOf() alone.
const raw = grid.map(({ lat, lng, hours }) => ({ lat, lng, hours }));
assert.equal(mod.gridOf(raw).length, 0,
  'a cell with no hoisted mslpHpa is not part of the field');
const hoisted = mod.hoursOf(raw, 0);
assert.equal(hoisted.length, 6, 'hoursOf keeps every cell that has a real pressure');
assert.ok(hoisted.every(c => Number.isFinite(c.mslpHpa)),
  'hoursOf lifts mslpHpa to the top level, which is where the contour reads it');
assert.deepEqual(mod.hoursOf([{ lat: 1, lng: 1, hours: [{ validAt: 'a', mslpHpa: null }] }], 0), [],
  'a cell with no pressure for that hour is not part of the field');

// The low is 990 hPa and sits at -8, 106. It must be found, not inferred.
const low = mod.lowCentre(grid, 0);
assert.equal(low.mslpHpa, 990, 'the lowest returned pressure is the low centre');
assert.equal(low.lat, -8, 'the low is reported at the cell that carries it');
assert.equal(low.lng, 106, 'the low keeps its real longitude');

// A tendency needs both hours. With hour 6 missing from every cell the tendency
// must be null — not 0, not a difference against a wrong index.
const shallow = mod.lowCentre(grid.map(c => ({ ...c, hours: c.hours.slice(0, 1) })), 0);
assert.equal(shallow.tendencyHpa, null, 'no prior hour means no tendency, not zero');
// The other half of the guard: the prior index (index − 6) EXISTS but that
// hour carries no pressure. A difference against nothing is zero, and zero
// reads as "the system is steady".
const gap = grid.map(c => ({
  ...c,
  hours: Array.from({ length: 7 }, (_, i) => ({ validAt: 'h' + i, mslpHpa: i === 0 ? null : c.hours[0].mslpHpa })),
}));
const gapLow = mod.lowCentre(gap, 6);
assert.equal(gapLow.mslpHpa, 990, 'the low is still found when only the prior hour is missing');
assert.equal(gapLow.tendencyHpa, null, 'a null prior pressure means no tendency, not zero');
assert.deepEqual(mod.lowCentre([{ lat: 1, lng: 1, hours: [{ validAt: 'a', mslpHpa: null }] }], 0), null,
  'a cell with no pressure carries no low');

// Isobars: at 1000 hPa the field crosses once per row pair, giving two segments
// between the 1004 edge and the 990 centre.
const segs = mod.contour(rows, 1000);
assert.ok(segs.length >= 1, 'a level inside the field produces a crossing');
assert.ok(segs.every(s => s.length === 2), 'each contour segment has two endpoints');
assert.equal(mod.contour(rows, 900).length, 0, 'a level below the whole field produces nothing');
assert.equal(mod.contour(rows, 1200).length, 0, 'a level above the whole field produces nothing');
// A level between the low and the surrounding cells MUST cross, or the isobars
// are missing the feature the layer exists to show.
assert.ok(mod.contour(rows, 995).length > 0, 'a level inside the field produces a crossing');
assert.ok(segs.length > 0, 'sanity: the chosen level is actually inside the field');
// The end-to-end shape: hoursOf -> gridOf -> contour, the exact chain draw()
// uses. It must produce the same field as the hand-built fixture.
assert.equal(mod.contour(mod.gridOf(hoisted), 1000).length, segs.length,
  'the real hoursOf -> gridOf -> contour chain reproduces the fixture field');

// Stitching must actually join. If it does not, the map shows loose 170 km
// chords that read as noise instead of a pressure pattern.
const ring = [
  [[0, 0], [1, 0]], [[1, 0], [1, 1]], [[1, 1], [0, 1]], [[0, 1], [0, 0]],
];
const joined = mod.stitch(ring);
assert.equal(joined.length, 1, 'four connected segments become one closed line');
assert.equal(joined[0].length, 5, 'the closed line keeps all four corners');
assert.equal(mod.stitch([[[0, 0], [1, 0]]]).length, 1, 'a lone segment is still a line');
assert.deepEqual(mod.stitch([]), [], 'no segments means no lines, not a placeholder');
assert.equal(mod.stitch([[[0, 0], [1, 0]], [[5, 5], [6, 6]]]).length, 2,
  'disconnected segments stay separate');

// A hole must not be bridged. Unknown pressure is not "sea level".
const holed = grid.map(c => (c.lat === -8 && c.lng === 106 ? { ...c, mslpHpa: null, hours: [{ validAt: 'h0', mslpHpa: null }] } : c));
assert.equal(mod.contour(mod.gridOf(holed), 1000).length, 0,
  'no contour is drawn across a cell whose pressure is unknown');
// The row is now missing its MIDDLE column, so the remaining columns shift.
// Without an alignment guard the algorithm pairs 104 with 108 and draws an
// isobar straight across the 106 gap — a line through a place nothing was
// measured.
const shifted = mod.gridOf(grid.filter(c => !(c.lat === -8 && c.lng === 106)));
assert.equal(shifted[1].cells.length, 2, 'the row with the hole really is short a column');
// 1005 hPa is the level that exposes the mispairing: the surviving columns are
// 1008/1006 above and 1004/1004 below, so a wrong pairing bridges 106 to 108
// with a line through the gap. A level that never crosses would pass whether
// the guard exists or not.
assert.equal(mod.contour(shifted, 1005).length, 0, 'a row that lost a column is not contoured at all');
assert.ok(mod.contour(rows, 1005).length > 0, 'the intact grid does contour at that same level');

// ── The honest claim, in words the code actually ships ────────────────────
assert.match(server, /\/api\/atlas\/synoptic",?\s*return handleSynoptic|\/api\/atlas\/synoptic/, 'the route is registered');
assert.match(server, /boundedNumber\(mslp\[i\], 870, 1085\)/,
  'MSLP is bounded to a real sea-level observation before it is used');
// The bounding must survive a value the provider could not have sent.
assert.doesNotMatch(client, /mslpHpa\s*[:=]\s*0(\D|$)/,
  'pressure is never defaulted to zero');

// Himawari supplies no wind product, so the layer must not claim one.
assert.match(client, /Himawari supplies cloud imagery, not wind/,
  'the client states the wind is model wind, not a Himawari product');
assert.match(server, /no Himawari wind product/,
  'the endpoint says the same thing on the API contract');
// That sentence is the whole reason the wording exists: it must not be deleted
// as redundant copy. A guard that matches the sentence stating the rule always
// fires — this one is checked against comment-stripped, real prose.
assert.doesNotMatch(app, /Himawari wind(?!,)/,
  'no copy anywhere calls a wind layer a Himawari product');

// Isobars are interpolation. Drawing them as measurement is the one error the
// whole panel exists to prevent.
assert.match(client, /interpolated between the model/, 'the client says isobars are interpolated');

// ── The lens wiring ───────────────────────────────────────────────────────
assert.match(app, /import\('\.\/synoptic\.js\?v='/, 'the module is loaded lazily with the build tag');
assert.match(app, /rain:'radar'/, 'the rain lens opens on radar, the instrument that sees rain');
assert.match(app, /synopticController\?\.clear\(\)/, 'the layer is cleared when the lens changes');
// The repaint path: renderLensEvidence() calls body.replaceChildren(), so a
// panel that is only built in selectCityLens vanishes on every repaint.
assert.match(app, /if \(synopticController\) synopticController\.render\(body\);/,
  'the synoptic panel repaints from renderLensEvidence, not only from selectCityLens');
assert.match(app, /lens === 'rain' \? 5/, 'the rain lens may zoom out far enough to hold a weather system');
assert.ok(/zoom:\s*7\.2/.test(app), 'the rain lens opens on the regional frame its grid was requested over');
// The five forecast points must survive: this lens is still "where rain is
// forecast", and the synoptic layer is added evidence, not a replacement.
assert.match(app, /rainfallData\?\.points \|\| \[\]/, 'the five sample points still render on the rain lens');
assert.match(app, /pick\('himawari'/, 'Himawari IR is one button away on the lens');
assert.match(app, /pick\('satellite-rain'/, 'IMERG satellite rain is one button away on the lens');

// Both languages. A missing Indonesian string is a silent blank.
assert.ok(client.includes('Konteks sinoptik'), 'the panel has an Indonesian title');
assert.ok(client.includes('Tidak ada isobar'), 'the Indonesian failure copy says no isobar is drawn');
assert.match(app, /rain: \['The rain system, from city to region', 'Sistem hujan, dari kota ke kawasan'\]/,
  'the rain lens title exists in both languages');

// A minimum of four cells cannot bound a contour surface. Two cells can make a
// line, and a line drawn from two points is not a field.
assert.match(server, /cells\.length < 4/, 'too few cells is an explicit outage, not a contour');

// The number that bounds contour accuracy is the gap to a cell's own NEAREST
// neighbour. A median over ALL pairs is dominated by the diagonals: on a 5×5
// grid it reported ~499 km for a grid whose step is ~175 km, which tells the
// reader the field is coarser than it is.
assert.match(server, /spacingKm: gridStepKm\(cells\)/, 'the reported spacing is the grid step, not the median pairwise distance');
const gridStepBody = server.match(/function gridStepKm[\s\S]*?\n\}/)?.[0] || '';
assert.match(gridStepBody, /if \(i === j\) continue;/, 'gridStepKm compares every other cell, so it really finds the nearest');
// Any index arithmetic ("only look at the next cell") silently turns a
// nearest-neighbour search into a positional guess.
assert.doesNotMatch(gridStepBody, /j\s*[!=]==?\s*i\s*[+-]/, 'gridStepKm must not shortcut the neighbour search by index');
assert.match(server, /nearestPairKm: medianSpacingKm\(cells\)/, 'the wider pairwise figure is still reported, not hidden');
assert.match(client, /grid step/, 'the panel labels the number as the grid step');

console.log('test-synoptic: ok');