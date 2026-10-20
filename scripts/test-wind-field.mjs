import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const client = read('public/wind-field.js');
const server = read('src/index.ts');
const app = read('public/app.js');

// ── The client math ───────────────────────────────────────────────────────
// Export the two pure functions and exercise them directly: a wrong advection
// or an off-by-180 bearing would move particles the wrong way across the city.
const mod = await import('../public/wind-field.js');

assert.equal(mod.flowVector(0, 5).toward, 180, 'wind FROM north blows toward the south');
assert.equal(mod.flowVector(180, 5).toward, 0, 'wind FROM south blows toward the north');
assert.equal(mod.flowVector(90, 5).toward, 270, 'wind FROM east blows toward the west');
assert.equal(mod.flowVector(270, 3).toward, 90, 'wind FROM west blows toward the east');
assert.equal(mod.flowVector(360, 4).toward, 180, '360° wraps like 0°');
for (const bad of [null, undefined, NaN, -1, '180']) {
  assert.equal(mod.flowVector(bad, 5), null, 'a non-numeric bearing is unknown, not calm');
  assert.equal(mod.flowVector(180, bad), null, 'a non-numeric speed is unknown, not calm');
  assert.equal(mod.flowVector(180, -3), null, 'a negative speed is not a real observation');
}
// A scalar speed must survive the direction conversion unchanged.
assert.equal(mod.flowVector(45, 7.5).speed, 7.5, 'conversion preserves speed');

const field = [
  { lat: -6.18, lng: 106.83, u: 2, v: 0 },   // blowing east
  { lat: -6.28, lng: 106.83, u: -2, v: 0 },  // blowing west
];
const mid = mod.sampleField(field, 106.83, -6.23);
assert.ok(Math.abs(mid.u) < 1e-9 && Math.abs(mid.v) < 1e-9, 'opposing cells cancel at the midpoint');
assert.equal(mid.used, 2, 'both real cells contributed');
assert.equal(mod.sampleField([], 106.83, -6.2), null, 'no cells means unknown, never calm');
assert.equal(mod.sampleField(field, 100, 0), null, 'a point far from every cell stays unknown rather than extrapolating');
// Sitting exactly on a cell, the opposing cell 11 km away still contributes a
// small inverse-square weight, so the answer is dominated by, not identical to,
// the near cell. The property that matters is which cell it follows.
const one = mod.sampleField(field, 106.83, -6.18);
assert.ok(one.u > 1.9, `the near cell dominates: u=${one.u} should stay positive and near its 2 m/s`);
assert.equal(one.toward, 90, 'and it blows in the near cell direction');
assert.ok(one.nearestKm < 0.001, 'the nearest cell is the one it sits on');
// The two real cells disagree, so the field must actually turn between them.
assert.ok(mod.sampleField(field, 106.83, -6.27).u < 0, 'nearer the opposing cell, it turns with it');
assert.ok(mod.sampleField(field, 106.83, -6.19).u > 0, 'nearer the first cell, it turns with that one');

// ── The honesty law ───────────────────────────────────────────────────────
// This project's conservation law: every number keeps its source, and nothing
// invents a measurement. These assertions are the guard, not decoration.
// Strip comments first: a guard that matches the very sentence stating the rule
// is a guard that always fires, which teaches you to ignore it.
const code = client.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
assert.doesNotMatch(code, /\b(concentration|plume|smoke)\w*\s*[:=]\s*(?!null)/i,
  'the wind layer must not assign a concentration, plume or smoke value');
assert.doesNotMatch(code, /\bat\tribute/i,
  'the wind layer must not attribute an event to a source');
assert.match(client, /No concentration, plume width, source or exposure is derived/,
  'the panel must state in words what it does not compute');
assert.match(client, /interpolation, which is the only interpolated quantity/,
  'inverse-distance interpolation must be disclosed, not hidden');
assert.match(client, /This layer is wind, not pollution/,
  'motion must be labelled as wind, not as pollution transport');
assert.match(client, /cellNote/, 'the panel must surface the provider cell note, not a request count');
assert.match(client, /no calm is implied/, 'an absent wind must never read as calm air');

// CAMS is one ~45 km cell over all of Jakarta, so the timeline may only move
// through time. A spatial PM2.5 gradient would invent variation that the single
// model value does not contain.
assert.doesNotMatch(client, /pm25\s*[:=].*interpolat|interpolat[a-z]*.*pm25/i,
  'PM2.5 must not be interpolated across space from a single model cell');

// ── Lifecycle ─────────────────────────────────────────────────────────────
// Animation that outlives its lens keeps moving and burning frames. Reduced
// motion must also be honoured: no autoplay for a reader who asked for none.
assert.match(client, /prefers-reduced-motion:\s*reduce/, 'reduced motion is honoured');
assert.match(app, /windFieldController\?\.clear\(\)/, 'leaving the lens must clear the wind layer');
assert.match(client, /visibilitychange/, 'a hidden document must stop the animation');
// Animation lives in the shared flow canvas; wind-field keeps no loop of its own
// (its old one referenced removed state and crashed on Play).
assert.doesNotMatch(client, /requestAnimationFrame/, 'wind-field runs no animation loop of its own');
assert.match(readFileSync(new URL('../public/flow-canvas.js', import.meta.url), 'utf8'), /cancelAnimationFrame/, 'the flow canvas frame must be cancellable');
assert.match(app, /import\('\.\/wind-field\.js\?v='/, 'the module is loaded lazily with the build tag');

// The evidence panel wipes and repaints the lens body on every refresh. When
// the wind field rendered only from selectCityLens, the first repaint destroyed
// it and the panel silently vanished. It must repaint from renderLensEvidence,
// and it must not append a second loading placeholder each time.
// Slice from the air branch forward to the NEXT haze branch; an earlier haze
// check exists elsewhere in the file and would make the slice run backwards.
const airAt = app.indexOf("if (activeLens === 'air')");
const hazeAt = app.indexOf("if (activeLens === 'haze')", airAt);
assert.ok(airAt > 0 && hazeAt > airAt, 'the air branch sits before the haze branch in renderLensEvidence');
const airBranch = app.slice(airAt, hazeAt);
assert.match(airBranch, /windFieldController\.render\(body\)/, 'a general evidence refresh must repaint the wind field, not delete it');
assert.match(airBranch, /airTimelineController\.render\(body\)/, 'and still the timeline');
assert.doesNotMatch(airBranch, /body\.append\(el/, 'a repaint must not append another loading placeholder');
assert.ok(
  airBranch.indexOf('windFieldController.render') < airBranch.indexOf('airTimelineController.render'),
  'wind renders first, matching the order selectCityLens builds them in',
);
assert.doesNotMatch(airBranch, /windFieldController\.show\(/, 'a refresh repaints from the loaded module; it must not re-fetch the model');

// ── The endpoint ──────────────────────────────────────────────────────────
assert.match(server, /\/api\/atlas\/wind-field/, 'the wind-field route is registered');
assert.match(server, /dedupe on the cell the provider returned/i,
  'cells must be deduplicated on the returned cell, not the requested point');
assert.doesNotMatch(server, /wind_field[\s\S]{0,400}concentration\s*=/,
  'the endpoint must not compute a concentration');
assert.match(server, /No wind is drawn and no calm is implied/,
  'an empty field is an explicit outage, never calm');
assert.match(server, /utc_offset_seconds !== 0/, 'timezone must be verified as UTC');
assert.match(server, /wind_speed_10m !== "m\/s"/, 'speed units must be verified as m/s');
assert.match(server, /WIND_FIELD_MAX_CELLS/, 'the cell count is bounded');

// Geometry scale. An arrow that crosses the whole city is not a data error you
// can see in a JSON assertion; it has to be pinned in degrees-to-km terms.
const arrowSrc = code.slice(code.indexOf('const km = 3 +'), code.indexOf('properties: { i, speed'));
assert.match(arrowSrc, /110\.57/, 'latitude degrees must come from a real km-per-degree constant');
assert.match(arrowSrc, /111\.32 \* Math\.cos\(c\.lat/, 'longitude degrees must account for latitude, not assume a degree is a degree');
assert.doesNotMatch(arrowSrc, /0\.5 \* c\.speed/, 'the old 0.5-degrees-per-m/s scaling produced 166 km arrows');
// 3..21 km on a ~50 km city is legible without spanning the map.
const kmAt = (ms) => 3 + Math.min(ms, 6) * 3;
assert.ok(kmAt(0) >= 3 && kmAt(1.5) > 0 && kmAt(6) <= 21, `arrow span stays in 3..21 km (got ${kmAt(6)})`);
assert.ok(kmAt(50) === kmAt(6), 'a gust is capped, not extrapolated');

console.log('PASS wind field: bearing conversion, bounded interpolation, the no-concentration law, lifecycle and endpoint validation');
// ── Arrowheads point TOWARD, data stays FROM ─────────────────────────────
{
  // Wind FROM the west (270°) blows east: shaft runs west→east, tip at east end.
  const shaft = { type: 'Feature', properties: { from: 270 }, geometry: { type: 'LineString', coordinates: [[106.80, -6.2], [106.86, -6.2]] } };
  const head = mod.arrowHead(shaft);
  const [b1, tip, b2] = head.geometry.coordinates;
  assert.deepEqual(tip, [106.86, -6.2], 'the head sits on the TOWARD end of the shaft');
  assert.ok(b1[0] < tip[0] && b2[0] < tip[0], 'both barbs trail behind the tip');
  assert.ok((b1[1] - tip[1]) * (b2[1] - tip[1]) < 0, 'barbs fan out on either side');
  assert.equal(head.properties.from, 270, 'the head keeps the FROM bearing as data');
  assert.ok(Math.hypot((b1[0]-tip[0])*110.7, (b1[1]-tip[1])*110.57) <= 2.6, 'a head is short (≤2.5 km), not another shaft');
  assert.match(client, /flatMap\(\(shaft\) => \[shaft, arrowHead\(shaft\)\]\)/, 'every drawn shaft carries a head');
}
// ── The panel is opened, not folded shut, on the air lens (desktop) ───────
assert.match(app, /getElementById\('atlas-lens-evidence'\); if \(ev\) ev\.open = true;/, 'the air lens opens its evidence so the wind panel and disclaimer are visible');
assert.match(app, /lone red square is one high reading, not a mapped plume/, 'a single AOD pixel is explained, not hidden');
console.log('PASS wind arrowheads, open panel and AOD pixel note');
{
  const tl = read('public/air-timeline.js'), css = read('public/jakarta-design.css'), tr = read('public/translations.js');
  assert.match(tl, /el\('details', undefined, 'air-timeline'\)/, 'the CAMS table is folded behind a summary, not open by default');
  assert.match(client, /t\('Wind, not pollution', 'Angin, bukan pencemaran'\)/, 'the phone chip states the rule in both languages');
  assert.match(client, /getElementById\('wind-not-pollution-chip'\)\?\.remove\(\)/, 'the chip leaves with the lens');
  assert.match(css, /\[data-lens="air"\] \.atlas-lens-popup \{ width:min\(240px, 21vw\); \}/, 'the air panel stays a slim rail');
  assert.match(tr, /Setiap kotak adalah satu pengambilan ~10 km/, 'the AOD square note is translated');
}
console.log('PASS air lens slim panel, folded CAMS, phone chip, ID/EN AOD note');

// ── City wind compass ─────────────────────────────────────────────────────
{
  const near = mod.citySummary([{ u: Math.sin(Math.PI*10/180), v: Math.cos(Math.PI*10/180) }, { u: Math.sin(-Math.PI*10/180), v: Math.cos(-Math.PI*10/180) }].map(c => ({ u: c.u*5, v: c.v*5 })));
  assert.ok(near.toward < 1 || near.toward > 359, 'vector mean of 10° and 350° is north, not 180°');
  assert.equal(mod.compassPoint(near.from), 'S', 'air going north comes from the south');
  assert.equal(mod.citySummary([{ u: 2, v: 0 }, { u: -2, v: 0 }]).calm, true, 'opposed cells read as near calm, not a direction');
  assert.equal(mod.citySummary([]), null, 'no cells means no compass');
  assert.equal(mod.compassPoint(225), 'SW'); assert.equal(mod.compassPoint(225, 'id'), 'BD');
  const e = mod.citySummary([{ u: -5, v: 0 }]);
  assert.equal(mod.compassPoint(e.from), 'E', 'westward air is an easterly'); assert.equal(Math.round(e.kmh), 18, '5 m/s is 18 km/h');
  // The trailing `;` matters: `function showCompass(cells, hour) {` matches a bare
  // /showCompass\(cells, hour\)/, so a pattern without it would happily pass on the
  // SIGNATURE while the call site passes a null hour.
  assert.match(client, /showCompass\(cells, hour\);/, 'the compass is redrawn per frame WITH that frame\'s hour, not a null one');
  assert.match(client, /getElementById\('wind-compass'\)\?\.remove\(\)/, 'leaving the lens removes the compass');
  // The compass is the only wind number drawn straight onto the map, and the
  // lens animates through forecast hours. Without the valid time it is a bare
  // km/h that could belong to any hour. The two steps are asserted together, so
  // breaking either end of the chain fails: `const tail = ''` still interpolates
  // ${tail}, and a null hour still produces `const at = ''`.
  assert.match(client, /const at = hour \? clock\(hour\) : '';[\s\S]{0,200}?const tail = at \? ' · ' \+ at : '';/, 'the compass derives its label time from the frame hour, and the label from that time');
  assert.match(client, /\$\{tail\}/, 'the compass label prints the time it derived');
  console.log('PASS wind compass: vector mean, calm, compass points, km/h, valid time');
}

// ── The controller must refuse a stale check ───────────────────────────────
// An import in the source proves the rule is referenced, not that the lens
// still calls it. Driving the real controller is the only thing that tells.
{
  const realDate = Date, realFetch = globalThis.fetch, realDocument = globalThis.document;
  const now = Date.UTC(2026, 9, 19, 3, 20);
  const hour = Math.floor(now / 3600000) * 3600000;
  const hours = [hour - 2 * 3600000, hour - 3600000, hour, hour + 3600000, hour + 2 * 3600000].map((h) => new Date(h).toISOString());
  const cells = [-6.15, -6.35].flatMap((lat) => [106.7, 106.9].map((lng) => ({
    lat, lng,
    hours: hours.map(() => ({ validAt: 'x', windMs: 2.5, windFromDeg: 140 })),
  })));
  const envelope = (over = {}) => ({
    available: true, contract: 'wind-field-v1', requestedPoints: 4, cellCount: 4,
    spacingKm: 20, checkedAt: new Date(now).toISOString(), hours, cells, ...over,
  });

  const node = (tag = 'DIV') => ({
    tagName: tag, className: '', textContent: '', dataset: {}, children: [],
    append(...c) { this.children.push(...c); }, setAttribute() {}, addEventListener() {},
    replaceChildren() { this.children.length = 0; }, querySelector: () => null, querySelectorAll: () => [],
  });
  const stubBody = () => { const b = node(); b.querySelector = () => null; return b; };
  const stubMap = () => {
    const layers = new Map(), sources = new Map();
    return {
      layers, sources, zoom: 9,
      getZoom: () => 9, getLayer: (id) => layers.get(id) || null, getSource: (id) => sources.get(id) || null,
      addLayer(l) { layers.set(l.id, l); }, addSource(id, s) { sources.set(id, s); },
      removeLayer(id) { layers.delete(id); }, removeSource(id) { sources.delete(id); },
      setPaintProperty() {}, on() {}, off() {},
    };
  };
  globalThis.document = {
    createElement(tag) { return node(String(tag).toUpperCase()); },
    addEventListener() {}, removeEventListener() {}, hidden: false,
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  };
  globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {} };
  globalThis.Date = class extends realDate { static now() { return now; } };

  try {
    let payload = envelope();
    globalThis.fetch = async (url) => String(url).includes('/api/atlas/wind-field')
      ? { ok: true, json: async () => payload }
      : { ok: true, json: async () => null };

    // Control: a current envelope really does draw. Without this, every
    // assertion below would also pass against a controller that draws nothing.
    const live = stubMap(), liveBody = stubBody();
    const liveCtl = mod.createWindField(live, { text: (en) => en, active: () => 'air', buildTag: 'test' });
    liveCtl.show(liveBody);
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(live.layers.size > 0, 'a current envelope draws the wind layer');
    liveCtl.clear();

    payload = envelope({ checkedAt: new Date(now - 60 * 60 * 1000).toISOString() });
    const map = stubMap(), body = stubBody();
    const ctl = mod.createWindField(map, { text: (en) => en, active: () => 'air', buildTag: 'test' });
    ctl.show(body);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(map.layers.size, 0, 'a model check older than ten minutes draws no wind layer');
    assert.ok(JSON.stringify(body.children).includes('older than 10 minutes'),
      'and the panel states the check is stale, in English');
    ctl.clear();

    payload = envelope({ checkedAt: new Date(now + 60 * 60 * 1000).toISOString() });
    const ahead = stubMap(), aheadBody = stubBody();
    const aheadCtl = mod.createWindField(ahead, { text: (en) => en, active: () => 'air', buildTag: 'test' });
    aheadCtl.show(aheadBody);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(ahead.layers.size, 0, 'a source clock ahead of the viewer draws nothing');
    aheadCtl.clear();
  } finally {
    globalThis.fetch = realFetch;
    if (realDocument === undefined) delete globalThis.document; else globalThis.document = realDocument;
    globalThis.Date = realDate;
  }
  console.log('PASS wind controller refuses a stale or future check without drawing');
}
