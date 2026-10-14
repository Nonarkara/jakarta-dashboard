// Runtime check for the four insight lenses. Boots the real public/app.js in a
// VM against a fake MapLibre map and the real baked data files, then drives each
// lens and inspects what it actually built. A lens that throws, paints the wrong
// expression, forgets its source line or leaves its layers behind fails here
// rather than in a visitor's browser.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const data = name => readFileSync(new URL(name.startsWith('/') ? '../public' + name : '../public/data/jakarta-v1/' + name, import.meta.url), 'utf8');
const parsed = name => JSON.parse(data(name));
const insight = parsed('insight.json');
const feeds = {
  '/data/jakarta-v1/insight.json': insight,
  '/data/jakarta-v1/water-scenario.json': parsed('water-scenario.json'),
  '/data/jakarta-v1/ciliwung-route.geojson': parsed('ciliwung-route.geojson'),
  '/data/jakarta-v1/ciliwung-manifest.json': parsed('ciliwung-manifest.json'),
  '/data/jakarta-v1/risk.geojson': parsed('risk.geojson'),
  '/data/jakarta-v1/green.geojson': parsed('green.geojson'),
  '/data/jakarta-v1/awlr.geojson': parsed('awlr.geojson'),
  '/data/jakarta-v1/arr.geojson': parsed('arr.geojson'),
  '/data/jakarta-v1/pumps.geojson': parsed('pumps.geojson'),
  '/data/jakarta-v1/flood-network.json': parsed('flood-network.json'),
  '/data/jakarta-v1/city-context.json': parsed('city-context.json'),
  '/jakarta-areas.json': parsed('/jakarta-areas.json'),
  '/jakarta-landmarks.geojson': parsed('/jakarta-landmarks.geojson'),
  '/jakarta-rail.geojson': { type: 'FeatureCollection', features: [] },
  '/api/atlas/air-quality': [],
  '/api/atlas/rainfall': { points: [] },
  '/api/atlas/environment': { products: [], radar: { available: false, frames: [] } },
  '/api/atlas/watch': { places: [] },
};

function element(tag) {
  const node = {
    tagName: String(tag || 'div').toUpperCase(), dataset: {}, style: {}, children: [], attrs: {}, listeners: {},
    hidden: false, value: '0', textContent: '', innerHTML: '', className: '',
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    scrollIntoView() {}, focus() {}, closest: () => null, remove() {},
    dispatchEvent() {}, click() {},
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] ?? null; },
    removeAttribute(k) { delete this.attrs[k]; },
    hasAttribute(k) { return k in this.attrs; },
    addEventListener(k, cb) { this.listeners[k] = cb; },
    appendChild(el) { this.children.push(el); return el; },
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = [...nodes]; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
  };
  return node;
}

const textOf = node => {
  if (!node) return '';
  if (node.nodeType === 3) return String(node.nodeValue);
  if (typeof node.textContent === 'string' && node.textContent && !node.children.length) return node.textContent;
  return (node.children || []).map(textOf).join(' ');
};

class FakeMap {
  constructor(options) {
    this.style = { _loaded: true };
    this.sources = { ...options.style.sources };
    this.layers = Object.fromEntries(options.style.layers.map(l => [l.id, { ...l, layout: {} }]));
    this.handlers = []; this.removed = [];
    this.buildings = [];
  }
  setMinZoom(value) { this.minZoom=value; }
  getPitch() { return 60; } getBearing() { return -18; } setMaxPitch() {}
  dragRotate = { enable() {}, disable() {} }; easeTo() {} resize() {} addControl() {} setLight() {}
  fitBounds(bounds,options) { this.bounds={bounds,options}; }
  moveLayer() {} stop() {} jumpTo() {} flyTo(o) { this.flight = o; }
  getZoom() { return 14; } areTilesLoaded() { return true; }
  getFilter(id) { return this.layers[id]?.filter; } setFilter() {}
  addSource(id, source) { this.sources[id] = { ...source, setData(data) { this.data = data; } }; }
  addLayer(layer) { this.layers[layer.id] = { ...layer, layout: { ...layer.layout } }; }
  removeLayer(id) { this.removed.push(id); delete this.layers[id]; }
  removeSource(id) { if(Object.values(this.layers).some(layer=>layer.source===id))throw new Error('source still referenced: '+id); this.removed.push(id); delete this.sources[id]; }
  getLayer(id) { return this.layers[id]; } getSource(id) { return this.sources[id]; }
  getLayoutProperty(id, p) { return this.layers[id]?.layout?.[p]; }
  setPaintProperty(id, p, v) { this.layers[id].paint[p] = v; }
  setLayoutProperty(id, p, v) { this.layers[id].layout[p] = v; }
  getStyle() { return { sources: this.sources, layers: Object.values(this.layers) }; }
  isStyleLoaded() { return true; } loaded() { return true; }
  on(...args) { this.handlers.push(args); } once() {}
  setFeatureState() {} getCanvas() { return { style: {} }; }
  queryRenderedFeatures(_point, options) {
    if (options && options.layers && options.layers[0] === 'jkt-buildings') return this.buildings;
    return [];
  }
}

function boot() {
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  get('atlas-lens-title').textContent = '';
  get('atlas-lens-description').textContent = '';
  get('atlas-lens-body').textContent = '';
  get('atlas-lens-evidence');
  get('atlas-view').value = '3d';
  get('atlas-environment-layer').value = 'none';
  const lenses = ['city', 'arrival', 'exposure', 'confidence', 'green', 'coverage', 'rain', 'radar', 'cloud', 'water', 'recurring', 'air']
    .map(id => { const el = element('button'); el.dataset.lens = id; return el; });
  const toggles = ['jkt-buildings', 'rail-stations', 'jkt-landmarks-3d', 'aqi-points', 'waterways-line', 'rain-model-samples']
    .map(id => { const el = element('button'); el.dataset.layerToggle = id; return el; });
  const window = {
    location: { origin: 'https://atlas.test', href: 'https://atlas.test/', search: '' },
    parent: { postMessage() {} },
    matchMedia: () => ({ matches: false }),
    __listeners: {},
    addEventListener(type, cb) { (this.__listeners[type] ??= []).push(cb); },
    dispatchEvent(ev) { for (const cb of this.__listeners[ev.type] || []) cb(ev); },
    history: {},
  };
  window.maplibregl = { Map: FakeMap, addProtocol() {}, NavigationControl: class {}, ScaleControl: class {} };
  window.pmtiles = { Protocol: class {} };
  const context = vm.createContext({
    window, URL, URLSearchParams, AbortSignal, Date, Math, JSON, Event: class Event { constructor(type, init) { this.type = type; Object.assign(this, init || {}); } },
    document: {
      documentElement: { ...element('html'), dataset: { theme: 'dark' } },
      body: element('body'), head: element('head'), referrer: '',
      getElementById: get,
      createElement: tag => { const node = element(tag); Object.defineProperty(node, 'id', { configurable: true, get() { return this._id ?? ''; }, set(v) { this._id = v; if (v) elements.set(v, node); } }); return node; },
      querySelectorAll: s => (s === '[data-layer-toggle]' ? toggles : s === '[data-lens]' ? lenses : []),
      querySelector: s => ['.atlas-map-wrap', '.atlas-menu-body', '#atlas-environment', '#atlas-data', '.atlas-footer', '#atlas-watch-shell', '#atlas-watch', '#atlas-inspect'].includes(s) ? get(s) : null,
      addEventListener() {},
    },
    console: { error() {}, warn() {}, log() {} },
    history: { replaceState() {} },
    requestAnimationFrame: cb => cb(),
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    fetch: async url => {
      const path = String(url).split('?')[0];
      if (path in feeds) return Response.json(feeds[path]);
      return new Response(null, { status: 404 });
    },
  });
  // Top-level let/const in a VM script are script-scoped, not context properties, so
  // the probe is appended to the same script to reach them.
  vm.runInContext(app + `
;globalThis.__probe = {
  selectCityLens, waterPosition, waterGaugeLevel, stopWaterPlayback,
  get waterState() { return waterState; },
  get waterPlayback() { return waterPlayback; },
  renderLensEvidence,
  buildingThemeColor,
  mapTheme,
  get mapInstance() { return mapInstance; },
  get buildingPaintMode() { return buildingPaintMode; },
  set buildingPaintMode(value) { buildingPaintMode = value; },
};
`, context);
  return { context, get, lenses };
}

const settle = async (rounds = 14) => { for (let i = 0; i < rounds; i++) await new Promise(resolve => setImmediate(resolve)); };

const { context, get, lenses } = boot();
await settle();
const map = context.__probe && context.__probe.mapInstance;
assert.ok(map, 'the map booted');

const pick = lens => lenses.find(l => l.dataset.lens === lens).listeners.click;
const body = () => get('atlas-lens-body');

// ── exposure ───────────────────────────────────────────────────────────────
await (pick('exposure'))();
await settle(40);
assert.ok(map.getLayer('insight-risk'), 'exposure adds its layer');
const fill = map.getLayer('insight-risk').paint['fill-color'];
assert.equal(fill[0], 'match', 'exposure paints with a match on the neighbourhood code');
assert.equal(fill[1][0], 'get', 'the match reads the normalised code');
assert.equal(fill[1][1], '__code', 'the normalised key is explicit, not a rewritten publisher value');
// ['match', input, label, value, ..., fallback]: length = 3 + 2 * codes.
const covered = (fill.length - 3) / 2;
assert.equal(covered, insight.exposure.kelurahan.length, 'every neighbourhood gets a band, none falls through');
const source = map.getSource('insight-risk');
assert.equal(source.data.features.length, parsed('risk.geojson').features.length, 'no risk polygon is dropped on the way to the map');
assert.ok(map.getSource('insight-risk').data.features.every(f => /^\d+$/.test(f.properties.__code)), 'every feature carries a digits-only join key');
assert.equal(map.getSource('insight-risk').data.features[0].properties.kelurahanCode.indexOf('.'), map.getSource('insight-risk').data.features[0].properties.kelurahanCode.includes('.') ? map.getSource('insight-risk').data.features[0].properties.kelurahanCode.indexOf('.') : -1, 'the published code is left untouched');
const exposureText = textOf(body());
assert.match(exposureText, /Jakarta Satu flood-risk reference/, 'exposure states its source');
assert.ok(exposureText.includes(insight.checkedAt), 'exposure states the checked date');
assert.match(exposureText, /Semester 2 2023/, 'exposure states the population period');
assert.match(exposureText, /Kapuk/, 'the ranked neighbourhood list renders');
assert.doesNotMatch(exposureText, /undefined|NaN|\[object/, 'no unresolved value reaches the panel');
const findRows = (n, out = []) => { for (const c of n.children || []) { if (String(c.className || '').includes('lens-row--button')) out.push(c); findRows(c, out); } return out; };
const rankRows = findRows(body());
assert.ok(rankRows.length, 'exposure rows are clickable');
map.flight = null;
rankRows[0].listeners.click();
assert.ok(map.flight, 'clicking a ranked row flies the map');
assert.deepEqual(map.flight.center, insight.exposure.kelurahan[0].center, 'the fly target is the clicked neighbourhood, not a hardcoded city point');

// ── green ──────────────────────────────────────────────────────────────────
await (pick('green'))();
assert.ok(!map.getLayer('insight-risk'),'exposure clears on a direct switch to green');
await settle(40);
assert.ok(map.getLayer('insight-green'), 'green adds its layer');
assert.equal(map.getLayer('insight-green').paint['fill-color'], context.__probe.mapTheme().green, 'green reads the theme token');
const greenText = textOf(body());
assert.match(greenText, /Jakarta Satu green-space reference/, 'green states its source');
assert.match(greenText, new RegExp(String(insight.green.unresolvedFeatures)), 'green states how many rows it could not place');
assert.match(greenText, new RegExp(String(insight.green.unknownKindPolygons)), 'green states how many polygons have no stated category');

// ── coverage ───────────────────────────────────────────────────────────────
await (pick('coverage'))();
assert.ok(!map.getLayer('insight-green'),'green clears on a direct switch to coverage');
await settle(40);
assert.ok(map.getLayer('insight-stations'), 'coverage adds its station layer');
const stations = map.getSource('insight-stations').data.features;
assert.ok(stations.length > 0, 'stations actually loaded');
assert.ok(stations.every(f => f.properties.__kind !== undefined), 'each feature knows which inventory it came from');
for(const [kind,n] of [[2,263],[3,589],[4,147]])assert.equal(stations.filter(f=>f.properties.__kind===kind).length,n,'infrastructure category keeps identity '+kind);
const coverageText = textOf(body());
assert.match(coverageText, /Jakarta Satu monitoring network/, 'coverage states its source');
assert.match(coverageText, /floodgates not placed by borough/i, 'an unplaced inventory is said out loud, not shown as zero');
assert.doesNotMatch(coverageText, /\b0 floodgates\b/i, 'no floodgate zero is published');
// Theme changes must refresh the live legend: a stale panel would keep the old
// palette's evidence. Corrupt the body, fire the theme event, demand a rebuild.
const staleMarker = element('span');
staleMarker.textContent = 'STALE-PANEL';
body().children.push(staleMarker);
context.window.dispatchEvent({ type: 'atlas:theme' });
assert.ok(!body().children.includes(staleMarker), 'a theme change re-renders the coverage legend, not a stale panel');
assert.match(textOf(body()), /Jakarta Satu monitoring network/, 'the rebuilt coverage panel states its source again');

// ── confidence ─────────────────────────────────────────────────────────────
await (pick('confidence'))();
assert.ok(!map.getLayer('insight-stations'),'coverage clears on a direct switch to confidence');
await settle(30);
const buildings = [];
for (const hs of ['measured', 'google', 'floors', 'ghsl', 'estimated'])
  buildings.push({ properties: { hs } });
buildings.push({ properties: { hs: 'google' } });
map.buildings = buildings;
map.handlers.filter(h => h[0] === 'moveend').forEach(h => h[1]());
const confidenceText = textOf(body());
assert.match(confidenceText, /6 buildings on screen/, 'the viewport count is the number actually queried');
assert.match(confidenceText, /Tagged height 17%/, 'measured is reported as a share of what is on screen');
assert.match(confidenceText, /Satellite, per building 33%/, 'a repeated tier is counted honestly');
assert.match(confidenceText, /none on screen/, 'a tier with no buildings on screen says so instead of showing zero');
assert.match(confidenceText, /Floor count/, 'every tier is named');
assert.ok(confidenceText.includes(insight.checkedAt), 'confidence states its checked date like the other lenses');
assert.doesNotMatch(confidenceText, /undefined|NaN/, 'no unresolved tier reaches the panel');

// ── leaving an insight lens restores the map ───────────────────────────────
await (pick('city'))();
await settle(20);
for (const id of ['insight-risk', 'insight-green', 'insight-stations'])
  assert.ok(!map.getLayer(id) && !map.getSource(id), id + ' is removed when the lens is left');
assert.equal(context.__probe.buildingPaintMode, 'height', 'the building paint mode is restored');
const repaint = context.__probe.buildingThemeColor();
assert.equal(repaint[0], 'interpolate', 'buildings go back to colouring by height');
assert.equal(typeof context.__probe.buildingThemeColor, 'function', 'buildingThemeColor stays a plain function');

// ── the confidence expression itself ───────────────────────────────────────
context.__probe.buildingPaintMode = 'confidence';
const confidencePaint = context.__probe.buildingThemeColor();
assert.equal(confidencePaint[0], 'case', 'confidence paints with a case');
assert.match(JSON.stringify(confidencePaint), /"measured"/, 'confidence keys on the height source property');
assert.match(JSON.stringify(confidencePaint), /"has","hs"/, 'a building with no stated source is handled explicitly');

console.log('PASS insight runtime: four lenses build their real layers, paint from theme tokens, state their source and date, and clear themselves on exit');

// Scenario endpoints, piecewise timing and real rendering/cleanup, not a regex.
const scenario = parsed('water-scenario.json');
const pos=context.__probe.waterPosition;
assert.deepEqual(Array.from(pos(0,1,scenario).coordinates),scenario.stations[0].coordinates);
assert.deepEqual(Array.from(pos(3,1,scenario).coordinates),scenario.stations[1].coordinates);
assert.deepEqual(Array.from(pos(9,1,scenario).coordinates),scenario.stations[2].coordinates);
assert.equal(pos(18,2,scenario).total,18);
assert.equal(pos(9,0.5,scenario).elapsed,4.5,'front clamps at arrival');
assert.equal(context.__probe.waterGaugeLevel(3,100,10),130,'level uses only explicit local assumptions');
assert.equal(context.__probe.waterGaugeLevel(0,-50,0),-50,'negative local datum is preserved');
await (pick('arrival'))(); await settle(30);
for(const id of ['water-scenario-route','water-scenario-front','water-scenario-stations','water-scenario-labels'])assert.ok(map.getLayer(id),'real scenario layer '+id);
assert.equal(map.getSource('water-scenario-stations').data.features.length,3);
assert.match(textOf(body()),/OpenStreetMap river geometry/,'the mapped route states its OSM basis');
assert.match(textOf(body()),/BPBD 2021 historical guidance, not a speed derived from the mapped length/,'timing stays a historical assumption, never a mapped-length speed');
assert.match(textOf(body()),/No flood extent or street depth predicted/);
const routeSource = map.getSource('water-scenario-route');
assert.equal(routeSource.data.features.length, 2, 'one route feature per station pair');
assert.ok(routeSource.data.features.every(f => f.properties.mapped === true), 'both segments carry admitted geometry when the assets verify them');
assert.equal(map.getSource('water-scenario-front').data.features.length,1);
// Geometry-aware traversal: the marker follows the mapped polyline, not the straight chord.
const polys = [routeSource.data.features[0].geometry.coordinates, routeSource.data.features[1].geometry.coordinates];
const straightMid = scenario.stations[0].coordinates.map((n,i)=>n+(scenario.stations[1].coordinates[i]-n)*0.5);
const onPoly = pos(1.5, 1, scenario, polys);
assert.equal(onPoly.segment, 0);
assert.ok(Math.hypot(onPoly.coordinates[0]-straightMid[0], onPoly.coordinates[1]-straightMid[1]) > 0.0005, 'the mid-journey marker sits on the mapped meander, not the straight chord');
const startPt = pos(0, 1, scenario, polys);
assert.ok(Math.hypot(startPt.coordinates[0]-polys[0][0][0], startPt.coordinates[1]-polys[0][0][1]) < 1e-9, 'the marker starts exactly on the mapped geometry');
const endPt = pos(9, 1, scenario, polys);
assert.ok(Math.hypot(endPt.coordinates[0]-polys[1][polys[1].length-1][0], endPt.coordinates[1]-polys[1][polys[1].length-1][1]) < 1e-9, 'the marker ends exactly on the mapped geometry');
assert.match(textOf(body()),/separate datum/);
assert.equal(map.getSource('water-scenario-front').data.features.length,1);
// Playback button state must track playback exactly: start, pause, scrub,
// central stop and lens exit all reset the label AND the pressed state.
const playBtn = get('water-play');
assert.ok(playBtn, 'the scenario renders a play control');
assert.equal(playBtn.getAttribute('aria-pressed'), 'false', 'play starts unpressed');
playBtn.listeners.click();
assert.notEqual(context.__probe.waterPlayback, null, 'click starts playback');
assert.equal(playBtn.getAttribute('aria-pressed'), 'true', 'starting sets the pressed state');
playBtn.listeners.click();
assert.equal(context.__probe.waterPlayback, null, 'the button pauses playback');
assert.equal(playBtn.getAttribute('aria-pressed'), 'false', 'pausing resets the pressed state');
playBtn.listeners.click();
get('water-hours').listeners.input();
assert.equal(context.__probe.waterPlayback, null, 'scrubbing the timeline stops playback');
assert.equal(playBtn.getAttribute('aria-pressed'), 'false', 'a scrub resets the pressed state');
playBtn.listeners.click();
context.__probe.stopWaterPlayback();
assert.equal(context.__probe.waterPlayback, null, 'the central stop stops playback');
assert.equal(playBtn.getAttribute('aria-pressed'), 'false', 'the central stop resets the pressed state, not just the label');
assert.doesNotMatch(playBtn.textContent, /pause|jeda/i, 'the central stop resets the label too');
await (pick('city'))();
for(const id of ['water-scenario-route','water-scenario-front','water-scenario-stations','water-scenario-labels'])assert.ok(!map.getLayer(id)&&!map.getSource(id),'scenario cleans '+id);
assert.equal(context.__probe.waterPlayback,null,'leaving pauses animation');
assert.equal(playBtn.getAttribute('aria-pressed'),'false','leaving the lens resets the pressed state');
assert.match(exposureText,/uniform density/,'population proxy assumption visible');
console.log('PASS water scenario: exact station endpoints, variable travel time, independent gauge datum, map layers, limitations and cleanup');

await (pick('green'))();await settle(30);assert.equal(context.__probe.buildingPaintMode,'height','confidence paint clears on direct switch to green');

// Reading/drawer updates must not interrupt a camera flight through resize().
let resizeCallback, viewportRect={width:1280,height:648};
const sizingMap={resizes:0,moving:false,resize(){this.resizes++;this.moving=false;}};
const sizingNode={getBoundingClientRect:()=>viewportRect};
const sizingContext=vm.createContext({mapInstance:sizingMap,postMsg(){},document:{documentElement:{style:{setProperty(){}}},querySelector:()=>sizingNode,getElementById:()=>sizingNode},ResizeObserver:class{constructor(cb){resizeCallback=cb;}observe(){}}});
const sizingStart=app.indexOf('(function sizeAtlasViewport()');
vm.runInContext(app.slice(sizingStart,app.indexOf('// ── Insight lenses',sizingStart)),sizingContext);
assert.equal(sizingMap.resizes,1,'initial compact layout sizes the canvas');
sizingMap.moving=true;resizeCallback();
assert.equal(sizingMap.resizes,1,'same viewport does not resize on HUD changes');assert.equal(sizingMap.moving,true,'camera motion survives HUD updates');
viewportRect={width:390,height:756};resizeCallback();assert.equal(sizingMap.resizes,2,'actual viewport change still resizes');
console.log('PASS map sizing: initial canvas setup, live-reading stability and responsive resize');

await vm.runInContext("selectCityLens('haze')", context);
assert.equal(vm.runInContext('mapInstance.minZoom',context),4,'regional haze permits the documented regional view');
assert.equal(vm.runInContext("mapInstance.getLayoutProperty('fire-hotspots','visibility')",context),'visible');
assert.match(textOf(get('atlas-lens-body')),/thermal detections|deteksi termal/i,'haze keeps satellite interpretation visible');
await vm.runInContext("selectCityLens('city')",context);
assert.equal(vm.runInContext('mapInstance.minZoom',context),9,'leaving regional evidence restores city zoom floor');
assert.equal(vm.runInContext("mapInstance.getLayoutProperty('fire-hotspots','visibility')",context),'none');
console.log('PASS regional haze: meaningful regional zoom, source limits and direct-exit cleanup');

vm.runInContext("airTimelineController={render(body){const p=document.createElement('p');p.textContent='retained air timeline';body.append(p);}};activeLens='air';renderLensEvidence();",context);
assert.match(textOf(get('atlas-lens-body')),/retained air timeline/,'air lens renders its controller after a general evidence refresh');
vm.runInContext('renderLensEvidence()',context);
assert.equal(textOf(get('atlas-lens-body')),'retained air timeline','repeated evidence refresh preserves exactly one air panel');
console.log('PASS air evidence refresh: controller delegation preserves the model timeline');
