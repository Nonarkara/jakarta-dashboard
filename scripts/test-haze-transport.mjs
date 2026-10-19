// Haze transport: where the wind would carry it.
//
// The failure this exists to stop is a map that draws confident smoke paths
// from nothing. Every assertion below was checked by putting the bug back and
// watching it fail, and the last block drives the real factory rather than
// reading its source.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const client = read('public/haze-transport.js');
const app = read('public/app.js');
const html = read('public/index.html');
const mod = await import('../public/haze-transport.js');

// ── The maths ─────────────────────────────────────────────────────────────
assert.equal(mod.flowVector(0, 10).toward, 180, 'wind FROM north blows toward the south');
assert.equal(mod.flowVector(270, 10).toward, 90, 'wind FROM west blows toward the east');
for (const bad of [null, NaN, -1, '270', 361, Infinity]) {
  assert.equal(mod.flowVector(bad, 10), null, 'an out-of-range bearing is unknown, not a vector');
}
for (const bad of [null, undefined, NaN, -1, '10']) {
  assert.equal(mod.flowVector(270, bad), null, 'a non-numeric speed is unknown, not calm');
}

// A parcel in a pure easterly wind (FROM 90°) travels due west, and the
// distance it covers in one hour is its speed converted through real
// kilometres-per-degree. Working in degrees directly is how a gentle wind
// becomes a hundred-kilometre hop.
{
  // A field wide enough that one step stays inside it, so the assertion is
  // about distance and not about the data edge.
  const wide = [100, 103, 106, 109, 112].map((lng) => ({ lat: -6, lng, u: -10, v: 0 }));
  const hours = [wide, wide, wide];
  const r = mod.trajectory(hours, 0, { lat: -6, lng: 106 }, 1);
  const [lng, lat] = r.path[1];
  const km = Math.abs(106 - lng) * mod.kmPerDegLng(-6);
  assert.ok(Math.abs(km - 36) < 1, `10 m/s for one hour is about 36 km, got ${km.toFixed(1)}`);
  assert.ok(lat === -6, 'a zonal wind does not move the parcel north or south');
  assert.equal(r.stopped, null, 'a path fully inside the field does not stop');
}

// The data edge. Without this the parcel walked 697 km out to sea on the
// westernmost cell's wind, long after the provider stopped answering.
{
  const cells = [{ lat: -6, lng: 106, u: -10, v: 0 }];
  const hours = [cells, cells, cells, cells];
  const r = mod.trajectory(hours, 0, { lat: -6, lng: 106 }, 6);
  assert.equal(r.stopped, 'left-field', 'a path leaves the field and says so');
  assert.ok(r.hours < 6, 'and it is genuinely shorter than requested');
  for (const [lng] of r.path) {
    assert.ok(lng >= 106 - 1e-9, 'no point beyond the westernmost cell is invented');
  }
}

// No wind anywhere near the origin means the path never moves, and says why.
assert.equal(mod.trajectory([[], []], 0, { lat: -6, lng: 106 }, 3).stopped, 'no-wind',
  'an empty hour field stops the path rather than guessing');
assert.equal(mod.trajectory(null, 0, { lat: -6, lng: 106 }, 3), null, 'no field is not a path');
assert.equal(mod.trajectory([[{ lat: -6, lng: 106, u: 1, v: 1 }]], 5, { lat: -6, lng: 106 }, 1), null,
  'an hour outside the forecast is not a path');
// Running past the end of the forecast is its own reason, not a silent stop.
assert.equal(mod.trajectory([[{ lat: -6, lng: 106, u: 1, v: 0 }]], 0, { lat: -6, lng: 106 }, 3).stopped, 'forecast-ends',
  'a path cannot run past the hours the provider published');

// Sampling reaches, but does not invent, beyond the cells.
assert.equal(mod.sampleWind([{ lat: -6, lng: 106, u: 5, v: 5 }], 106, -6).u > 0, true, 'a point on a cell samples it');
assert.equal(mod.sampleWind([{ lat: -6, lng: 106, u: 5, v: 5 }], 120, 20), null,
  'a point far from every cell is unknown, not extrapolated');
assert.equal(mod.sampleWind([], 106, -6), null, 'no cells means no wind');
// One malformed cell must be skipped, not averaged in. Allowed through, its
// NaN weights make wsum NaN, the sample returns null, and a perfectly good
// field silently stops every path on the map.
{
  const mixed = [{ lat: -6, lng: 106, u: 10, v: 0 }, { lat: NaN, lng: 106, u: 10, v: 0 },
    null, { lat: -6, lng: 106 }, { lng: 106, lat: -6, u: 'x', v: 0 }];
  const s = mod.sampleWind(mixed, 106, -6);
  assert.ok(s && Number.isFinite(s.u) && Number.isFinite(s.v),
    'a malformed cell is skipped, not averaged into the field');
  assert.equal(s.used, 1, 'and only the one real cell contributes');
}

// ── The claims the module refuses to make ─────────────────────────────────
assert.match(client, /It is a path, not a plume/, 'the panel says a path is not a plume');
assert.match(client, /no concentration, optical depth, width or source mass is drawn/i,
  'and names the quantities it never draws');
assert.match(client, /not a dispersion model/, 'the panel says it is not a dispersion model');
assert.match(client, /shows where air would go — not how much would arrive/i,
  'and separates path from quantity');
assert.match(client, /It is a path, not a plume|Tidak ada konsentrasi, optical depth, lebar/,
  'the same rule is stated in Bahasa');
assert.match(client, /planning points not emission sources/, 'the Jakarta seeds are not called emission sources');
assert.match(client, /there is nothing real to carry\. No path is invented/,
  'with no detections it invents no path');
// Nothing in the file may render a concentration, a width or a colour scale.
assert.doesNotMatch(client, /pm25|concentration\s*[:=]\s*[0-9]|plumeWidth|AOD\s*[:=]/i,
  'no concentration field is ever computed or drawn');

// Origins are real detections, and the cap is stated rather than hidden.
{
  const many = Array.from({ length: 40 }, (_, i) => ({ geometry: { coordinates: [106 + i * 0.01, -6] }, properties: { frp: 1, observedAt: 'x' } }));
  const f = mod.fireOrigins(many);
  assert.equal(f.total, 40, 'every detection is counted');
  assert.equal(f.paths.length, 12, 'only a readable number is drawn');
  assert.equal(f.capped, true, 'and the cap is reported, not hidden');
  assert.deepEqual(mod.fireOrigins(null), { paths: [], total: 0, outside: 0, capped: false }, 'no data is no paths');
  // Seeds outside the wind field cannot be advected (the live case: all twelve
  // in Borneo, east of the box), and the strongest fires are drawn first.
  const pt = (lng, lat, frp) => ({ geometry: { coordinates: [lng, lat] }, properties: { frp } });
  const box = { minLat: -9, maxLat: -2.5, minLng: 103, maxLng: 109.4 };
  const b = mod.fireOrigins([pt(114, -1, 900), pt(105, -4, 5), pt(106, -3, 80), pt(104, -5, null)], box);
  assert.equal(b.total, 3, 'only detections inside the field are seeds');
  assert.equal(b.outside, 1, 'and the rest are counted as outside, not dropped silently');
  assert.deepEqual(b.paths.map((p) => p.frp), [80, 5, null], 'ranked by fire radiative power, unknown last');
}
// Forward Euler: the step out of hour i uses hour i's wind, not hour i+1's.
{
  const at = (u) => [100, 103, 106, 109, 112].map((lng) => ({ lat: -6, lng, u, v: 0 }));
  const r = mod.trajectory([at(-10), at(10)], 0, { lat: -6, lng: 106 }, 1);
  assert.ok(r.path[1][0] < 106, 'the first step moves with the starting hour\'s easterly, not the next hour\'s westerly');
  assert.deepEqual(mod.fireOrigins([{ geometry: { coordinates: [NaN, 6] } }]).paths, [],
    'a detection with no coordinates is not an origin');
}

// ── Driven for real ───────────────────────────────────────────────────────
// String matches cannot see a scope error or a layer that never gets removed.
function stubMap(zoom = 5) {
  const layers = new Set(), sources = new Map(), handlers = {};
  const map = {
    layers, sources, handlers, zoom,
    getLayer: (id) => (layers.has(id) ? { id } : undefined),
    addLayer: (l) => layers.add(l.id), removeLayer: (id) => layers.delete(id),
    getSource: (id) => sources.get(id), addSource: (id, s) => sources.set(id, s), removeSource: (id) => sources.delete(id),
    on: (ev, fn) => { (handlers[ev] ||= []).push(fn); },
    off: (ev, fn) => { handlers[ev] = (handlers[ev] || []).filter((f) => f !== fn); },
    getZoom: () => map.zoom, fitBounds: () => {},
    fire: (ev) => (handlers[ev] || []).forEach((f) => f()),
  };
  return map;
}
function stubBody() {
  const node = (cls = '') => ({
    className: cls, textContent: '', dataset: {}, children: [],
    append(...c) { this.children.push(...c); }, setAttribute() {}, addEventListener() {},
    replaceChildren() { this.children.length = 0; },
    querySelector: () => null, querySelectorAll: () => [], prepend(...c){this.children.unshift(...c);},
  });
  const body = node();
  body.querySelector = (sel) => body.children.find((c) => c.className === sel.replace(/[.:>]/g, '')) || null;
  return body;
}

const synFixture = JSON.parse(read('test/fixtures/synoptic-response.json'));
const realFetch = globalThis.fetch;
const realDocument = globalThis.document;
const realDate = globalThis.Date;
globalThis.document = {
  addEventListener(){}, removeEventListener(){},
  createElement: () => ({
    className: '', textContent: '', dataset: {}, children: [],
    append(...c) { this.children.push(...c); }, setAttribute() {}, addEventListener() {},
    replaceChildren() { this.children.length = 0; }, querySelector: () => null, querySelectorAll: () => [], prepend(...c){this.children.unshift(...c);},
  }),
};
globalThis.fetch = async (url) => {
  if (String(url).includes('/api/atlas/synoptic')) return { ok: true, json: async () => synFixture };
  if (String(url).includes('/api/atlas/fires')) return { ok: true, json: async () => ({ features: [] }) };
  return { ok: false, json: async () => ({ available: false }) };
};
try {
  // Pin "now" to the moment the payload says it was checked: a wall-clock test
  // passes on the day the fixture was captured and fails forever after. The
  // clock must agree with the payload's own checkedAt — a model stamped ahead
  // of the viewer is refused as a future source, and that guard is the point.
  // Three forecast hours (09, 10, 11) remain, which is what the scrub covers.
  globalThis.Date = class extends realDate { static now() { return realDate.parse(synFixture.checkedAt); } };
  // The haze lens draws it; no other lens does.
  for (const lens of ['haze', 'rain', 'green']) {
    const map = stubMap();
    const body = stubBody();
    const ctl = mod.createHazeTransport(map, { text: (en) => en, active: () => lens, buildTag: 'test' });
    ctl.show(body);
    await new Promise((r) => setTimeout(r, 40));
    ctl.render(body);
    // On the haze lens it renders; on any other lens it must write NOTHING
    // into that lens's panel rather than scribbling a stranger's section.
    if (lens === 'haze') {
      assert.ok(body.children.length > 0, 'the panel renders on the haze lens without throwing');
      assert.ok(map.layers.has('haze-path'), 'the haze lens draws the paths');
      assert.ok(map.layers.has('haze-seed'), 'the haze lens marks the seeds');
      assert.ok(map.layers.has('haze-hour'), 'the haze lens marks the hours');
      const drawn = map.sources.get('haze-transport-1');
      assert.ok(drawn, 'the paths reached a source');
      const feats = drawn.data.features;
      assert.ok(feats.length > 0, 'the source carries features');
      // Three kinds in one source, each filtered by an explicit role.
      for (const role of ['path', 'seed']) {
        assert.ok(feats.some((f) => f.properties.role === role), `the source carries ${role} features`);
      }
      // Hour markers appear only where a path actually reached that hour. The
      // fixture is trimmed to twelve hours, so a marker must NOT appear here —
      // inventing one at +6 h on a two-hour path would be the whole error.
      const longest = Math.max(0, ...feats.filter((f) => f.properties.role === 'path').map((f) => f.properties.hours));
      const hours = feats.filter((f) => f.properties.role === 'hour').map((f) => f.properties.hour);
      assert.ok(longest < 6, 'the trimmed fixture leaves less than six hours of forecast');
      assert.deepEqual(hours, [], 'no hour marker is drawn beyond the hours a path reached');
      for (const h of hours) assert.ok(h <= longest, 'no hour marker outruns its path');
      // A path is a path: it carries no quantity.
      assert.ok(feats.filter((f) => f.properties.role === 'path')
        .every((f) => !('concentration' in f.properties) && !('aod' in f.properties)),
        'no path carries a concentration');
    } else {
      assert.equal(map.layers.size, 0, `${lens}: transport never paints on a lens that did not ask`);
      assert.equal(body.children.length, 0, `${lens}: and writes nothing into that lens's panel`);
    }
    ctl.clear();
    assert.equal(map.layers.size, 0, `${lens}: clear removes every layer`);
  }

  // Hour markers on a path long enough to reach them.
{
  const longFixture = {
    available: true, contract: 'synoptic-v1', requestedPoints: 5, cellCount: 5, spacingKm: 174,
    // Stamped to the instant this test pins "now" to, so the envelope agrees
    // with its own clock. A payload with no checkedAt is not a current field.
    checkedAt: new Date(Date.UTC(2026, 0, 1, 0)).toISOString().replace('.000Z', 'Z'),
    hours: Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 0, 1, i)).toISOString().replace('.000Z', 'Z')),
    cells: [-8, -6, -4].flatMap((lat) => [100, 103, 106, 109, 112].map((lng) => ({
      lat, lng,
      hours: Array.from({ length: 30 }, () => ({ validAt: 'x', mslpHpa: 1008, wind850Ms: 8, wind850FromDeg: 90 })),
    }))),
  };
  globalThis.fetch = async (url) => String(url).includes('/api/atlas/synoptic')
    ? { ok: true, json: async () => longFixture }
    : { ok: true, json: async () => ({ features: [] }) };
  // "now" must land inside the fixture's hours for the start index to resolve.
  globalThis.Date = class extends Date { static now() { return Date.UTC(2026, 0, 1, 0); } };
  const map = stubMap();
  const body = stubBody();
  const ctl = mod.createHazeTransport(map, { text: (en) => en, active: () => 'haze', buildTag: 'test' });
  ctl.show(body);
  await new Promise((r) => setTimeout(r, 40));
  const feats = map.sources.get('haze-transport-1').data.features;
  const paths = feats.filter((f) => f.properties.role === 'path');
  assert.ok(paths.length === 5, `five Jakarta origins are drawn, got ${paths.length}`);
  assert.ok(paths.every((p) => p.properties.hours >= 6), 'a 24 h horizon with enough wind reaches 6 h');
  const hours = [...new Set(feats.filter((f) => f.properties.role === 'hour').map((f) => f.properties.hour))].sort((a, b) => a - b);
  assert.deepEqual(hours, [6, 12, 18, 24], 'hour markers appear at 6, 12, 18 and 24 h');
  assert.ok(paths.every((p) => p.geometry.coordinates.length === p.properties.hours + 1),
    'a path has one point per hour it travelled');
  ctl.clear();
  globalThis.Date = realDate;
}

// A dead provider is an explicit absence, never a drawn path.
  {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ available: false }) });
    const map = stubMap();
    const body = stubBody();
    const ctl = mod.createHazeTransport(map, { text: (en) => en, active: () => 'haze', buildTag: 'test' });
    ctl.show(body);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(map.layers.size, 0, 'no wind field means no path drawn');
    assert.ok(JSON.stringify(body.children).includes('No path is drawn'),
      'and the panel says no path is drawn, in English');
    ctl.clear();
  }

  // A model check older than the admission window is refused even though its
  // hours still cover now. Only driving the controller proves the rule is
  // called; an import in the source proves nothing.
  {
    const checkedAt = realDate.parse(synFixture.checkedAt);
    globalThis.Date = class extends realDate { static now() { return checkedAt; } };
    globalThis.fetch = async (url) => String(url).includes('/api/atlas/synoptic')
      ? { ok: true, json: async () => ({ ...synFixture, checkedAt: new Date(checkedAt - 60 * 60 * 1000).toISOString() }) }
      : { ok: true, json: async () => ({ type: 'FeatureCollection', fetchedAt: new Date(checkedAt).toISOString(), windowHours: 24, features: [] }) };
    const map = stubMap();
    const body = stubBody();
    const ctl = mod.createHazeTransport(map, { text: (en) => en, active: () => 'haze', buildTag: 'test' });
    ctl.show(body);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(map.layers.size, 0, 'a model check older than ten minutes draws no path');
    assert.ok(JSON.stringify(body.children).includes('older than 10 minutes'),
      'and the panel states the check is stale, in English');
    ctl.clear();
  }
  // Real haze controller: hide retires layers; return fetches again; an open
  // session crossing beyond its model hours never borrows index zero.
  {
    let clock=realDate.parse(synFixture.checkedAt),tick,visibility,calls=0;
    const oldSet=globalThis.setInterval,oldClear=globalThis.clearInterval;
    const add=document.addEventListener,remove=document.removeEventListener;
    globalThis.Date=class extends realDate {static now(){return clock;}};
    globalThis.setInterval=fn=>{tick=fn;return {unref(){}};};globalThis.clearInterval=()=>{};
    document.hidden=false;document.addEventListener=(name,fn)=>{if(name==='visibilitychange')visibility=fn;};document.removeEventListener=()=>{};
    globalThis.fetch=async url=>{calls++;return {ok:true,json:async()=>String(url).includes('/synoptic')?{...synFixture,checkedAt:new realDate(clock).toISOString()}:{type:'FeatureCollection',windowHours:24,fetchedAt:new realDate(clock).toISOString(),features:[]}};};
    const map=stubMap(),body=stubBody(),ctl=mod.createHazeTransport(map,{text:en=>en,active:()=> 'haze'});
    try {
      ctl.show(body);await new Promise(r=>setTimeout(r,10));assert.ok(map.layers.has('haze-path'));
      document.hidden=true;visibility();assert.equal(map.layers.size,0,'hidden haze retires the actual layers');
      const before=calls;clock+=660000;document.hidden=false;visibility();await new Promise(r=>setTimeout(r,10));assert.ok(calls>before,'return refetches all evidence');assert.ok(map.layers.has('haze-path'));
      clock+=4*3600000;tick();assert.equal(map.layers.size,0,'refresh removes old paths before async response');await new Promise(r=>setTimeout(r,10));assert.equal(map.layers.size,0,'missing current hour never falls back to first forecast hour');
    }finally{ctl.clear();globalThis.setInterval=oldSet;globalThis.clearInterval=oldClear;document.addEventListener=add;document.removeEventListener=remove;delete document.hidden;}
  }
} finally {
  globalThis.fetch = realFetch;
  if (realDocument === undefined) delete globalThis.document; else globalThis.document = realDocument;
}

// ── The wiring ────────────────────────────────────────────────────────────
assert.match(app, /import\('\.\/haze-transport\.js\?v='/, 'the module is loaded lazily with the build tag');
assert.match(app, /hazeTransportController\?\.clear\(\)/, 'it is cleared when the lens changes');
assert.match(app, /if \(hazeTransportController\) hazeTransportController\.render\(body\);/,
  'the panel repaints from renderLensEvidence, not only from selectCityLens');
const hazeBranch = app.slice(app.indexOf("} else if (lens === 'haze') {"), app.indexOf("} else if (lens === 'air')"));
assert.ok(hazeBranch.includes('loadHazeTransport()'), 'the haze lens loads it');
assert.ok(hazeBranch.includes('ev.open = true'), 'and opens its evidence panel on desktop');

// Reachable from the power menu, which is where the question gets asked.
assert.match(html, /id="atlas-haze-transport"/, 'the Controls menu carries the entry point');
assert.match(app, /getElementById\('atlas-haze-transport'\)[\s\S]{0,300}?selectCityLens\('haze'\)/,
  'and it goes straight to the haze lens');
assert.match(app, /atlas-menu'\)\?\.removeAttribute\('open'\)/, 'closing the menu after the jump');

// Every localisation call must carry both languages: lensText(en, id) returns
// undefined on the Bahasa page, which renders as an empty control with no error.
const single = [];
for (const m of client.matchAll(/(?<![.\w])t\(([^()]*)\)/g)) {
  if (!m[1].includes(',') && !m[1].includes('...')) single.push(m[0].slice(0, 60));
}
assert.deepEqual(single, [], 'every t() call passes both languages: ' + single.join(' | '));

console.log('test-haze-transport: ok');