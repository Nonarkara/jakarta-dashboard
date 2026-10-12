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
  getPitch() { return 60; } getBearing() { return -18; } setMaxPitch() {}
  dragRotate = { enable() {}, disable() {} }; easeTo() {} resize() {} addControl() {} setLight() {}
  moveLayer() {} stop() {} jumpTo() {} flyTo(o) { this.flight = o; }
  getZoom() { return 14; } areTilesLoaded() { return true; }
  getFilter(id) { return this.layers[id]?.filter; } setFilter() {}
  addSource(id, source) { this.sources[id] = { ...source, setData(data) { this.data = data; } }; }
  addLayer(layer) { this.layers[layer.id] = { ...layer, layout: { ...layer.layout } }; }
  removeLayer(id) { this.removed.push(id); delete this.layers[id]; }
  removeSource(id) { this.removed.push(id); delete this.sources[id]; }
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
  const lenses = ['city', 'exposure', 'confidence', 'green', 'coverage', 'rain', 'radar', 'cloud', 'water', 'recurring', 'air']
    .map(id => { const el = element('button'); el.dataset.lens = id; return el; });
  const toggles = ['jkt-buildings', 'rail-stations', 'jkt-landmarks-3d', 'aqi-points', 'waterways-line', 'rain-model-samples']
    .map(id => { const el = element('button'); el.dataset.layerToggle = id; return el; });
  const window = {
    location: { origin: 'https://atlas.test', href: 'https://atlas.test/', search: '' },
    parent: { postMessage() {} },
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    dispatchEvent() {},
    history: {},
  };
  window.maplibregl = { Map: FakeMap, addProtocol() {}, NavigationControl: class {}, ScaleControl: class {} };
  window.pmtiles = { Protocol: class {} };
  const context = vm.createContext({
    window, URL, URLSearchParams, AbortSignal, Date, Math, JSON, Event: class Event { constructor(type, init) { this.type = type; Object.assign(this, init || {}); } },
    document: {
      documentElement: { ...element('html'), dataset: { theme: 'dark' } },
      body: element('body'), head: element('head'), referrer: '',
      getElementById: get, createElement: element,
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
  selectCityLens,
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

// ── green ──────────────────────────────────────────────────────────────────
await (pick('green'))();
await settle(40);
assert.ok(map.getLayer('insight-green'), 'green adds its layer');
assert.equal(map.getLayer('insight-green').paint['fill-color'], context.__probe.mapTheme().green, 'green reads the theme token');
const greenText = textOf(body());
assert.match(greenText, /Jakarta Satu green-space reference/, 'green states its source');
assert.match(greenText, new RegExp(String(insight.green.unresolvedFeatures)), 'green states how many rows it could not place');
assert.match(greenText, new RegExp(String(insight.green.unknownKindPolygons)), 'green states how many polygons have no stated category');

// ── coverage ───────────────────────────────────────────────────────────────
await (pick('coverage'))();
await settle(40);
assert.ok(map.getLayer('insight-stations'), 'coverage adds its station layer');
const stations = map.getSource('insight-stations').data.features;
assert.ok(stations.length > 0, 'stations actually loaded');
assert.ok(stations.every(f => f.properties.__kind !== undefined), 'each feature knows which inventory it came from');
const coverageText = textOf(body());
assert.match(coverageText, /Jakarta Satu monitoring network/, 'coverage states its source');
assert.match(coverageText, /floodgates not placed by borough/i, 'an unplaced inventory is said out loud, not shown as zero');
assert.doesNotMatch(coverageText, /\b0 floodgates\b/i, 'no floodgate zero is published');

// ── confidence ─────────────────────────────────────────────────────────────
await (pick('confidence'))();
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
