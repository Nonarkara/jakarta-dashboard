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
// The row KEEPS its column slot, as null. Dropping the cell entirely would
// shift the columns and marching squares would pair the wrong neighbours,
// drawing an isobar across the gap.
const gapped = mod.gridOf(grid.filter(c => !(c.lat === -8 && c.lng === 106)));
assert.equal(gapped[1].cells.length, 3, 'the row keeps all three column slots');
assert.equal(gapped[1].cells.filter(c => c === null).length, 1, 'the missing cell is a null slot, not a shift');
assert.equal(mod.contour(gapped, 1005).length, 0, 'a gap in the field is never contoured across');
assert.ok(mod.contour(rows, 1005).length > 0, 'the intact grid does contour at that same level');

// The provider does NOT answer a rectangular grid. Against the live 5×5 request
// it returned seven latitudes, two of them 0.07° apart, and dropped a column
// from one row. A lattice built by exact-coordinate grouping therefore has no
// rows at all, and the isobar field comes back empty — which is what the first
// deployed screenshot showed: a low marker and wind arrows, no isobars.
const jittered = [
  mkCell(-9.00, 103.00, 1010, [1010]), mkCell(-9.03, 104.60, 1010, [1010]), mkCell(-8.96, 106.20, 1010, [1010]),
  mkCell(-7.40, 103.00, 1006, [1006]), mkCell(-7.42, 104.60, 1004, [1004]), mkCell(-7.40, 106.20, 1004, [1004]),
  mkCell(-5.80, 103.00, 1002, [1002]), mkCell(-5.80, 104.60, 1000, [1000]), mkCell(-5.80, 106.20, 1000, [1000]),
  mkCell(-4.20, 103.00, 998, [998]), mkCell(-4.18, 104.60, 990, [990]), mkCell(-4.20, 106.20, 998, [998]),
  mkCell(-2.60, 103.00, 1002, [1002]), mkCell(-2.64, 104.60, 1004, [1004]), mkCell(-2.57, 106.20, 1002, [1002]),
];
const jRows = mod.gridOf(jittered);
assert.equal(jRows.length, 5, 'sub-tolerance jitter collapses into one row per requested latitude');
assert.ok(jRows.every(r => r.cells.length === 3 && r.cells.every(Boolean)), 'the jittered scatter becomes a full lattice');
assert.ok(mod.contour(jRows, 1000).length > 0, 'a jittered scatter still produces isobars');
// Cells an order of magnitude apart are two columns, never one.
const far = [mkCell(0, 0, 1000, [1000]), mkCell(0, 2, 1000, [1000]), mkCell(2, 0, 1000, [1000]), mkCell(2, 2, 1000, [1000])];
assert.equal(mod.gridOf(far)[0].cells.length, 2, 'genuinely separated cells stay separate columns');

// ── The real payload ──────────────────────────────────────────────────────
// A frozen live response. Synthetic fixtures are tidy: every cell present, the
// grid rectangular. The real one is not — it carries the ragged scatter, two
// latitudes 0.07° apart, and one of the 25 requested cells missing entirely.
// Every defect below was invisible to a tidy fixture and threw or rendered
// nothing on the deployed map.
const live = JSON.parse(read('test/fixtures/synoptic-response.json'));
assert.ok(live.cells.length > 4, 'the fixture is a real field, not a stub');
const liveRows = mod.gridOf(mod.hoursOf(live.cells, 0));
assert.equal(liveRows.length, 5, 'seven jittered latitudes collapse into five rows');
assert.equal(liveRows[0].cells.length, 5, 'the lattice is five columns wide');
assert.equal(liveRows.flatMap((r) => r.cells).filter((c) => !c).length, 1,
  'the cell the provider did not answer is a null node, not a shifted column');
// This is the line that threw on the live map: a null node read for a pressure.
const livePressures = liveRows.flatMap((r) => r.cells.filter(Boolean).map((c) => c.mslpHpa));
assert.ok(livePressures.length > 0 && livePressures.every(Number.isFinite),
  'every pressure read comes from a node backed by a real cell');
// And the field it produces must actually contain lines.
const lo = Math.ceil(Math.min(...livePressures) / 2) * 2;
const hi = Math.floor(Math.max(...livePressures) / 2) * 2;
let liveLines = 0;
for (let v = lo; v <= hi; v += 2) liveLines += mod.stitch(mod.contour(liveRows, v)).length;
assert.ok(liveLines > 0, `the real field produces isobars (got ${liveLines})`);
const liveLow = mod.lowCentre(live.cells, 0);
assert.ok(liveLow && Number.isFinite(liveLow.mslpHpa), 'the real field has a low centre');
// No draw path may read through a null node.
assert.doesNotMatch(client, /\.cells\.map\(\(c\) => c\.mslpHpa\)/,
  'no path maps over cells unguarded, which throws on a gap in the field');

// ── Three feature kinds in one source ─────────────────────────────────────
// Isobars, wind arrows and the low centre share a GeoJSON source, so the layers
// must be told apart by an explicit key. The deployed map drew an orange dot at
// every isobar VERTEX and labelled them as lows: the low layer filtered on
// `has hpa`, which isobar lines also carry, and a circle layer on a LineString
// renders a circle per vertex.
assert.match(client, /properties: \{ kind: 'iso'/, 'isobar features carry an explicit kind');
assert.match(client, /properties: \{ kind: 'wind'/, 'wind features carry an explicit kind');
assert.match(client, /properties: \{ kind: 'low'/, 'the low centre carries an explicit kind');
assert.doesNotMatch(client, /filter: \['has', 'hpa'\]/, 'no layer filters on a property two kinds share');
const layerFilters = [...client.matchAll(/id: 'synoptic-[a-z0-9-]+'[\s\S]{0,140}?filter: (\[[^\]]*\]|\[\s*\[[^\]]*\][\s\S]{0,60}?\])/g)].map((m) => m[1]);
assert.ok(layerFilters.length >= 3, 'every synoptic layer states a filter');
assert.ok(layerFilters.every((f) => /\['==',\s*\['get',\s*'kind'\]/.test(f)),
  'every synoptic layer filters on kind: ' + layerFilters.join(' | '));

// The module owns one container, so repainting cannot leave the loading line
// sitting above the panel that replaced it.
assert.match(client, /function slot\(body\)/, 'the module builds into its own slot');
assert.match(client, /host\.replaceChildren\(\)/, 'a repaint clears the slot');
assert.match(client, /host\.append\(section\)/, 'the panel is appended to the slot');
assert.doesNotMatch(client, /body\.append\(section\)/, 'the module never appends into the shared body directly');
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
// refreshRainfall() does not repaint, so without a second pass the five points
// are built from a null rainfallData and the lens shows no points at all.
const rainStart = app.indexOf("if (lens === 'rain') {");
// The terminator must exist, or slice() silently returns the whole file and
// every `includes` below passes no matter what is in it.
const rainEnd = app.indexOf("} else if (['waterways','traffic'].includes(lens))");
assert.ok(rainStart > 0 && rainEnd > rainStart, 'the rain branch boundaries were located');
const rainBranch = app.slice(rainStart, rainEnd);
assert.ok(rainBranch.length > 200, 'the rain branch was located');
// The repaint must sit BETWEEN the rainfall refresh and the synoptic module.
// The product buttons also call renderLensEvidence(), so an indexOf anywhere
// in the branch matches those instead and passes even when this one is gone.
const between = rainBranch.slice(
  rainBranch.indexOf('await refreshRainfall(false)'),
  rainBranch.indexOf('await loadSynoptic()'));
assert.ok(between.length > 0, 'the rainfall-to-synoptic span was located');
assert.ok(between.includes('renderLensEvidence();'),
  'the rain lens repaints after the forecast points arrive, before the synoptic slot is built');
// The map marks the low, but the marker is often behind the evidence panel.
assert.match(client, /const where = \(c\) =>/, 'the low\'s position is stated in the panel');
assert.match(client, /hPa · ' \+ where\(low\)/, 'the pressure fact carries its position');
assert.ok(/zoom:\s*7\.2/.test(app), 'the rain lens opens on the regional frame its grid was requested over');
// The five forecast points must survive: this lens is still "where rain is
// forecast", and the synoptic layer is added evidence, not a replacement.
assert.match(app, /rainfallData\?\.points \|\| \[\]/, 'the five sample points still render on the rain lens');
assert.match(app, /pick\('himawari'/, 'Himawari IR is one button away on the lens');
assert.match(app, /pick\('satellite-rain'/, 'IMERG satellite rain is one button away on the lens');

// The panel carries the spacing, the low's pressure and its tendency. Folded
// shut, the map shows isobars with nothing to interpret them against.
assert.ok(rainBranch.includes("document.getElementById('atlas-lens-evidence'); if (ev) ev.open = true"),
  'the rain lens opens its evidence panel on desktop');
assert.ok(client.includes('Konteks sinoptik'), 'the panel has an Indonesian title');
assert.ok(client.includes('Tidak ada isobar'), 'the Indonesian failure copy says no isobar is drawn');

// lensText(en, id) returns `id` — undefined when called with ONE argument — on
// the Bahasa page. It fails by rendering an empty control with no console
// error, so every call in this module is checked for a second argument.
const singleArg = [];
for (const m of client.matchAll(/(?<![.\w])t\(([^()]*)\)/g)) {
  // A spread of a bilingual pair counts; a bare literal does not.
  if (!m[1].includes(',') && !m[1].includes('...')) singleArg.push(m[0].slice(0, 60));
}
assert.deepEqual(singleArg, [], 'every t() call passes both languages: ' + singleArg.join(' | '));
// The same trap in the lens wiring it owns.
const appSingle = [];
for (const m of app.matchAll(/lensText\(([^()]*)\)/g)) {
  if (!m[1].includes(',') && !m[1].includes('...')) appSingle.push(m[0].slice(0, 60));
}
assert.deepEqual(appSingle, [], 'every lensText() call passes both languages: ' + appSingle.join(' | '));
// And the exact defect that shipped an empty button on the live site.
assert.doesNotMatch(client, /t\(on \? en\[1\] : en\[0\]\)/,
  'a toggle must not pass only its on-label: that renders an empty button in Bahasa');
// Both states of both toggles exist in Bahasa, not just the English default.
for (const label of ["'Isobar'", "'Isobar nyala'", "'Angin 850 hPa'", "'Angin 850 hPa nyala'"]) {
  assert.ok(client.includes(label), `the toggle labels are bilingual: ${label}`);
}
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

// ── The flood-monitoring lens ─────────────────────────────────────────────
// The synoptic field lives on two lenses now, and only those two: painting a
// pressure field over the green-space lens would imply the isobars say
// something about vegetation.
assert.match(client, /const PAINTS_ON = \['rain', 'coverage'\]/, 'the field is scoped to exactly two lenses');
assert.ok(!/PAINTS_ON = \[[^\]]*'green'/.test(client), 'the field never paints on the green-space lens');
// The lens predicate must be built where `active` exists. At module scope it
// reads an undefined binding and every call throws — which is exactly what the
// live page did, behind a suite that only matched strings.
assert.match(client, /export function createSynoptic\([\s\S]{0,300}?const activeIsOneOf = \(\) => PAINTS_ON\.includes\(active\(\)\)/,
  'the lens predicate is constructed inside the factory, where active exists');

// A contour between cells 174 km apart says nothing about the 300 m in front
// of it. At city zoom it would draw a stray fragment that reads as a
// street-level pressure line.
assert.match(client, /MAX_ZOOM_FOR_FIELD = 8\.3/, 'the field has an explicit zoom ceiling');
assert.match(client, /if \(map\.getZoom\(\) > MAX_ZOOM_FOR_FIELD\) \{ hide\(\); return; \}/,
  'the layers stay off above that ceiling');
assert.match(client, /Not drawn on the map at this zoom/, 'the panel says why the map is empty');
assert.match(client, /Tidak digambar di peta pada zoom ini/, 'and says so in Bahasa');
assert.match(client, /map\.on\('zoomend', zoomListener\)/, 'the note follows the camera');
assert.match(client, /map\.off\('zoomend', zoomListener\)/, 'and the listener is removed on clear');
// ── The module, actually run ──────────────────────────────────────────────
// Everything above reads the source. This drives the real factory against a
// stub map and a stub DOM, because the bug that shipped — a lens predicate
// reading `active` from module scope — is invisible to every string match and
// throws the moment the panel renders.
function stubMap(zoom = 7.2) {
  const layers = new Set(), sources = new Map(), handlers = {};
  // getZoom must read the object's own property: a closure copy would keep
  // returning the construction value and the test could never zoom.
  const map = {
    layers, sources, handlers, zoom,
    getLayer: (id) => (layers.has(id) ? { id } : undefined),
    addLayer: (l) => layers.add(l.id),
    removeLayer: (id) => layers.delete(id),
    getSource: (id) => sources.get(id),
    addSource: (id, s) => sources.set(id, s),
    removeSource: (id) => sources.delete(id),
    on: (ev, fn) => { (handlers[ev] ||= []).push(fn); },
    off: (ev, fn) => { handlers[ev] = (handlers[ev] || []).filter((f) => f !== fn); },
    getZoom: () => map.zoom,
    fire: (ev) => (handlers[ev] || []).forEach((f) => f()),
  };
  return map;
}
function stubBody() {
  const kids = [];
  const node = (tag = 'DIV', cls = '') => ({
    tagName: tag, className: cls, textContent: '', dataset: {}, children: [],
    append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); },
    setAttribute() {}, addEventListener() {}, replaceChildren() { this.children.length = 0; },
    querySelector: () => null, querySelectorAll: () => [],
  });
  const body = node('DIV');
  body.querySelector = (sel) => body.children.find((c) => c.className === sel.replace(/[.:>]/g, '')) || null;
  body.querySelectorAll = () => [];
  return body;
}

const realFetch = globalThis.fetch;
const realDocument = globalThis.document;
// The module builds nodes with document.createElement. Node has no DOM, so the
// stub is just enough to exercise the real render path.
globalThis.document = {
  createElement(tag) {
    return {
      tagName: String(tag).toUpperCase(), className: '', textContent: '', dataset: {}, children: [],
      append(...c) { this.children.push(...c); }, setAttribute() {}, addEventListener() {},
      replaceChildren() { this.children.length = 0; }, querySelector: () => null, querySelectorAll: () => [],
    };
  },
};
globalThis.fetch = async (url) => {
  if (String(url).includes('/api/atlas/synoptic')) {
    return { ok: true, json: async () => JSON.parse(read('test/fixtures/synoptic-response.json')) };
  }
  return { ok: false, json: async () => ({ available: false }) };
};
try {
  for (const lens of ['rain', 'coverage']) {
    let current = lens;
    const map = stubMap();
    const body = stubBody();
    const ctl = mod.createSynoptic(map, { text: (en) => en, active: () => current, buildTag: 'test' });
    ctl.show(body);
    await new Promise((r) => setTimeout(r, 30));
    ctl.render(body);
    assert.ok(body.children.length > 0, `${lens}: the panel renders without throwing`);
    assert.ok(map.layers.has('synoptic-isobars'), `${lens}: isobars are added at a regional zoom`);
    assert.ok(map.layers.has('synoptic-wind850'), `${lens}: the 850 hPa layer is added`);
    assert.ok(map.layers.has('synoptic-low'), `${lens}: the low centre is marked`);
    // The exact defect: the panel must not throw on either lens.
    assert.ok(!body.textContent.includes('is not a function'), `${lens}: no scope error in the panel`);
    ctl.clear();
    assert.equal(map.layers.size, 0, `${lens}: clear removes every layer`);
  }

  // A lens that did not ask for it must stay untouched.
  {
    const map = stubMap();
    const body = stubBody();
    const ctl = mod.createSynoptic(map, { text: (en) => en, active: () => 'green', buildTag: 'test' });
    ctl.show(body);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(map.layers.size, 0, 'the field never paints on a lens that did not ask for it');
    assert.ok(body.textContent === '' || !/Isobar/.test(body.textContent), 'and says nothing on that lens');
    ctl.clear();
  }

  // Too close: layers off, and the panel must say so rather than go blank.
  {
    const map = stubMap(9.6);
    const body = stubBody();
    const ctl = mod.createSynoptic(map, { text: (en) => en, active: () => 'coverage', buildTag: 'test' });
    ctl.show(body);
    await new Promise((r) => setTimeout(r, 30));
    ctl.render(body);
    assert.equal(map.layers.size, 0, 'at city zoom the field is not drawn');
    const said = JSON.stringify(body.children);
    assert.ok(/Not drawn on the map at this zoom/.test(said), 'and the panel says why, in English');
    // Zoom out and the field comes back, with the note gone.
    map.zoom = 7.2;
    map.fire('zoomend');
    assert.ok(map.layers.has('synoptic-isobars'), 'zooming out draws the field');
    ctl.clear();
    assert.equal((map.handlers.zoomend || []).length, 0, 'clear removes the zoom listener it added');
  }
} finally {
  globalThis.fetch = realFetch;
  if (realDocument === undefined) delete globalThis.document; else globalThis.document = realDocument;
}

console.log('test-synoptic: ok');

// ── What else sees this ───────────────────────────────────────────────────
// Every row the flood-monitoring lens adds has to name its own date and its own
// kind of evidence. A row with no date is a claim, not a measurement.
const covStart = app.indexOf('function renderCoverageSeeAlso(body)');
const covEnd = app.indexOf('function renderConfidencePanel');
assert.ok(covStart > 0 && covEnd > covStart, 'the coverage section was located');
const cov = app.slice(covStart, covEnd);
for (const id of ['radar', 'surface-water', 'satellite-rain', 'himawari']) {
  assert.ok(cov.includes(`pick('${id}'`), `the flood lens offers ${id} as a map view`);
}
// Observations and predictions must not be blurred together.
assert.match(cov, /No dated classification from the provider\. No water is assumed, and none is ruled out\./,
  'an unavailable satellite layer says neither present nor absent');
assert.match(cov, /No radar frames returned\. Absence of echo is not an all-clear\./,
  'an empty radar says absence of echo is not an all-clear');
assert.match(cov, /No dated infrared frame\. Nothing is inferred about the sky\./,
  'an absent infrared frame infers nothing about the sky');
assert.match(cov, /none replaces a station/, 'the section refuses to stand in for the network');
assert.match(cov, /Not a neighbourhood forecast/, 'the 24 h row does not pretend to be finer than five points');
assert.match(cov, /deep convection shows as cold tops before any gauge sees rain/i,
  'the cloud-top row says what infrared is for');
assert.match(cov, /Sees water where no station is published/, 'the satellite water row is about the gap in the network');
// The coverage lens must load the module and open its panel.
const covBranch = app.slice(app.indexOf("} else if (lens === 'coverage') {"), app.indexOf("} else if (lens === 'night')"));
assert.ok(covBranch.includes('loadSynoptic()'), 'the flood lens loads the pressure field');
assert.ok(covBranch.includes('refreshRainfall(false)'), 'the flood lens loads the 24 h forecast');
assert.ok(covBranch.includes('ev.open = true'), 'the flood lens opens its evidence panel on desktop');
assert.match(app, /night:'night-lights',rain:'radar',coverage:'radar'/, 'the flood lens opens on radar, not on nothing');

