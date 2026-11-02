import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
// The page-level assembly (the tools row, the data drawer, the lens popup) is
// no longer in the deferred client: it is in public/atlas-layout.js, which runs
// BEFORE the client, so the reader's DOM is the DOM that was painted. The
// contract below is about that assembly, so the harness has to run it — in the
// same order the browser does.
const layout = readFileSync(new URL('../public/atlas-layout.js', import.meta.url), 'utf8');
const files = name => JSON.parse(readFileSync(new URL('../public/' + name, import.meta.url), 'utf8'));
const current = new Date().toISOString();
const feeds = {
  '/jakarta-areas.json': files('jakarta-areas.json'),
  '/jakarta-landmarks.geojson': files('jakarta-landmarks.geojson'),
  '/jakarta-rail.geojson': { type: 'FeatureCollection', features: [] },
  '/api/atlas/air-quality': [{ label: 'Central <Jakarta>', label_id: 'Jakarta Pusat', aqi: 0, pm25: 0, lng: 106.83, lat: -6.18, observedAt: current, provenance: { tier: 'model-estimate', source: 'Open-Meteo / CAMS' } }],
};
function element() {
  return { dataset: {}, hidden: false, style: {}, textContent: '', innerHTML: '', listeners: {}, attrs: {}, children: [],
    classList: { toggle() {}, add() {}, remove() {} },
    scrollIntoView() {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, cb) { this.listeners[k] = cb; }, appendChild(el) { this.children.push(el); }, append(...nodes) { this.children.push(...nodes); } };
}
class FakeMap {
  constructor(options) { this.style = { _loaded: true }; this.sources = { ...options.style.sources }; this.layers = Object.fromEntries(options.style.layers.map(l => [l.id, { ...l, layout: {} }])); this.handlers = []; this.states = []; }
  getPitch() { return 60; } getBearing() { return -18; } setMaxPitch(value) { this.maxPitch = value; }
  dragRotate = { enable() {}, disable() {} }; easeTo(options) { this.camera = options; }
  getZoom(){return 14;} areTilesLoaded(){return true;} getFilter(id){return this.layers[id]?.filter;} setFilter(id,value){this.layers[id].filter=value;}
  resize() {} addControl() {} setLight() {} moveLayer() {} stop() {}
  addSource(id, source) { this.sources[id] = { ...source, setData(data) { this.data = data; } }; }
  addLayer(layer) { this.layers[layer.id] = { ...layer, layout: { ...layer.layout } }; }
  removeLayer(id) { delete this.layers[id]; } removeSource(id) { delete this.sources[id]; }
  getLayer(id) { return this.layers[id]; } getSource(id) { return this.sources[id]; }
  getLayoutProperty(id, prop) { return this.layers[id]?.layout?.[prop]; }
  setPaintProperty(id, prop, value) { this.layers[id].paint[prop] = value; }
  setLayoutProperty(id, prop, value) { this.layers[id].layout[prop] = value; }
  getStyle() { return { sources: this.sources, layers: Object.values(this.layers) }; }
  isStyleLoaded() { return true; } loaded() { return true; }
  on(...args) { this.handlers.push(args); } once() {}
  setFeatureState(target, state) { this.states.push({ target, state }); }
  getCanvas() { return { style: {} }; } queryRenderedFeatures() { return []; }
  jumpTo() { this.jumped = true; } flyTo(options) { this.flew = true; this.flight = options; }
}
async function scenario(mode) {
  const elements = new Map(), listeners = {}, messages = [];
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const toggles = ['jkt-buildings', 'rail-stations', 'jkt-landmarks-3d', 'aqi-points'].map(id => { const el = element(); el.dataset.layerToggle = id; return el; });
  const parent = { postMessage: payload => messages.push(payload) };
  const window = { location: { origin: 'https://atlas.test', href: 'https://atlas.test', search: '' }, parent,
    matchMedia: () => ({ matches: true }), addEventListener: (event, cb) => { listeners[event] = cb; } };
  if (mode !== 'missing-libraries') {
    window.maplibregl = { Map: mode === 'webgl-failure' ? class { constructor() { throw new Error('No WebGL'); } } : FakeMap, addProtocol() {}, NavigationControl: class {}, ScaleControl: class {} };
    window.pmtiles = { Protocol: class {} };
  }
  const context = vm.createContext({ window, document: { documentElement: { ...element(), dataset: { theme: "dark" } }, referrer: '', body: element(), getElementById: get,
    createElement: element, querySelectorAll: selector => selector === '[data-layer-toggle]' ? toggles : [], querySelector: selector => ['.atlas-map-wrap','.atlas-menu-body','#atlas-environment','#atlas-data','.atlas-footer'].includes(selector) ? get(selector) : null, addEventListener() {} },
    console: { error() {}, warn() {} }, history: { replaceState() {} }, URL, URLSearchParams, AbortSignal,
    fetch: async path => Response.json(feeds[path]), requestAnimationFrame: cb => cb(),
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  });
  vm.runInContext(layout, context);
  vm.runInContext(app, context);
  // The drawer no longer has to be a DIRECT child of the map wrap: it now sits
  // in the page-tools row beside the research door. The invariant this guard
  // protects is that the embedded evidence lives inside an explicit drawer
  // rather than dumped below the map — so look for it inside that row first,
  // and fall back to the direct child for a build that has no tools row.
  const wrap = get('.atlas-map-wrap');
  const tools = wrap.children.find(el => el.className === 'atlas-page-tools');
  assert.ok(tools, 'page-level controls live inside the map wrap, not beside it');
  const drawer = (tools ? tools.children : wrap.children).find(el => el.className === 'atlas-embedded-drawer')
    ?? wrap.children.find(el => el.className === 'atlas-embedded-drawer');
  assert.ok(drawer, 'embedded evidence stays inside an explicit drawer, not below the map');
  assert.equal(drawer.children[1].children.length, 4, 'tools, environment, data and attribution are retained');
  const door = tools.children.find(el => el.className === 'atlas-research-link');
  assert.ok(door, 'the atlas offers the research page from the same row as the drawer');
  assert.equal(door.href, '/research', 'and that door points at the research page');

  for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve));
  if (mode !== 'missing-libraries' && mode !== 'webgl-failure') {
    vm.runInContext('setMapView("2d")', context);
    assert.equal(vm.runInContext('mapInstance.getLayoutProperty("jkt-buildings", "visibility")', context),'none');
    assert.equal(vm.runInContext('mapInstance.getLayoutProperty("jkt-landmarks-3d", "visibility")', context),'none');
    vm.runInContext('setLayerVisible("jkt-buildings", true)', context);
    assert.equal(vm.runInContext('mapInstance.getLayoutProperty("jkt-buildings", "visibility")', context),'none','layer toggle cannot reintroduce boxes in 2D');
    vm.runInContext('setBasemap("osm"); setMapView("3d")', context);
    assert.equal(vm.runInContext('mapInstance.getLayoutProperty("osm-streets", "visibility")', context),'visible');
    assert.equal(vm.runInContext('mapInstance.getLayoutProperty("jkt-buildings", "visibility")', context),'visible');
    vm.runInContext('setBasemap("esri")', context);
    vm.runInContext('setMapView("2d"); watchData={places:[{id:"pusat",lat:-6.18,lng:106.83,air:{usAqi:165}}],notices:[]}; focusWatch("air")', context);
    assert.equal(vm.runInContext('currentView',context),'2d','watch topics preserve the chosen 2D mode');
    assert.equal(vm.runInContext('mapInstance.flight.pitch',context),0);
    vm.runInContext('setMapView("3d")',context);

    assert.equal(vm.runInContext('mapInstance.getLayoutProperty("osm-streets", "visibility")', context),'none');
  }
  context.localeChanges = [];
  vm.runInContext('window.AtlasLanguage = {set: value => localeChanges.push(value), translate: text => text, language: () => "en"}',context);
  listeners.message({origin:'https://jakarta.nonarkara.org',source:parent,data:{type:'atlas:setLanguage',language:'id'}});
  listeners.message({origin:'https://evil.test',source:parent,data:{type:'atlas:setLanguage',language:'en'}});
  listeners.message({origin:'https://jakarta.nonarkara.org',source:{},data:{type:'atlas:setLanguage',language:'en'}});
  listeners.message({origin:'https://jakarta.nonarkara.org',source:parent,data:{type:'atlas:setLanguage',language:'vi'}});
  assert.deepEqual(context.localeChanges,['id'],'language commands accept only the trusted parent and supported languages, even without WebGL');
  assert.match(get('atlas-aqi-rows').innerHTML, /0 AQI/, 'zero AQI is shown, not dropped');
  assert.match(get('atlas-aqi-rows').innerHTML, /Central &lt;Jakarta&gt;/);
  assert.match(get('atlas-aqi-rows').innerHTML, /modeled/);
  assert.match(get('atlas-reference-list').innerHTML, /Monumen Nasional/);
  if (mode !== 'normal') assert.match(get('atlas-map-status').textContent, /unavailable/);
  else {
    const map = vm.runInContext('mapInstance', context);
    assert.ok(map.getLayer('jkt-buildings')); assert.ok(map.getLayer('jkt-landmarks-3d'));
    assert.equal(map.getSource('jkt-aqi-src').data.features.length, 1);
    assert.ok(map.getLayer('rail-line') && map.getLayer('rail-stations'), 'rail loads from the OSM file');
    vm.runInContext('setLayerVisible("rail-stations", false)', context);
    for (const id of ['rail-stations', 'rail-stations-label']) assert.equal(map.getLayoutProperty(id, 'visibility'), 'none');
    assert.equal(toggles[1].attrs['aria-pressed'], 'false');
    const handler = map.handlers.find(args => args[0] === 'click' && args[1] === 'jkt-buildings')[2];
    handler({ features: [{ id: 7, properties: { h: 10, hs: 'estimated' } }], lngLat: { lng: 106.83, lat: -6.18 } });
    assert.equal(map.states.at(-1).target.sourceLayer, 'buildings');
    assert.match(get('atlas-inspect-props').innerHTML, /unknown/);
    assert.match(get('atlas-inspect-props').innerHTML, /no measurement/);
    const ready = messages.find(m => m.event === 'ready');
    assert.ok(ready?.buildingsPresent);
    const visibility = map.getLayoutProperty('jkt-buildings', 'visibility');
    listeners.message({ origin: 'https://atlas.test', source: {}, data: { type: 'atlas:toggleLayer', layerId: 'jkt-buildings', visible: false } });
    assert.equal(map.getLayoutProperty('jkt-buildings', 'visibility'), visibility, 'only the parent may command the map');
    vm.runInContext('flyToArea("sudirman-thamrin")', context);
    assert.equal(map.jumped, true, 'reduced motion uses jumpTo');
    get('atlas-environment-layer').value = 'radar';
    get('atlas-radar-frame').value = '0'; get('atlas-radar-coverage').checked = true;
    get('atlas-environment-opacity').value = '75';
    context.environmentFixture = { products: [], radar: { available: true, maxzoom:7, source:'RainViewer radar composite', tier:'radar-observation', coverageTiles:['https://tilecache.rainviewer.com/coverage/{z}/{x}/{y}'], frames:[{observedAt:current,tiles:['https://tilecache.rainviewer.com/radar/{z}/{x}/{y}']}]} };
    vm.runInContext('environmentData = environmentFixture',context);
    await vm.runInContext('applyEnvironmentOverlay()',context);
    assert.equal(map.getSource('environment-overlay').maxzoom,7);
    const retainedOverlay = map.getSource('environment-overlay');
    vm.runInContext('setMapView("2d"); setBasemap("osm"); setMapView("3d")',context);
    assert.equal(map.getSource('environment-overlay'),retainedOverlay,'mode and basemap switches must retain the selected data source');
    assert.equal(get('atlas-environment-layer').value,'radar');

    assert.ok(map.getLayer('radar-coverage'));
    assert.match(get('atlas-environment-evidence').innerHTML,/radar-observation/);
    vm.runInContext('var exportResult; downloadEvidence = (filename, data) => { exportResult = { filename, data }; };',context);
    get('atlas-environment-export').listeners.click();
    assert.equal(JSON.parse(context.exportResult.data).selectedProduct.date,current);
    context.rainFixture = { source:'Open-Meteo weather models',tier:'model-estimate-and-forecast',fetchedAt:current,points:[{id:'sample',name:'Area A',name_id:'Wilayah "A", hujan',lat:-6.18,lng:106.83,precipitationMm:0,intervalSeconds:900,next24hMm:null,forecastFromUtc:current,forecastToUtc:current,validAt:current}] };
    vm.runInContext('rainfallData = rainFixture; window.AtlasLanguage = { language: () => "id", translate: text => text };',context);
    get('atlas-rainfall-export').listeners.click();
    assert.equal(context.exportResult.filename,'jakarta-rainfall.csv');
    assert.ok(context.exportResult.data.startsWith('\uFEFF'));
    assert.match(context.exportResult.data,/forecast_from_utc/);
    assert.ok(context.exportResult.data.includes('Lokasi [location]'));
    assert.ok(context.exportResult.data.includes('"Wilayah ""A"", hujan"'));
    assert.ok(context.exportResult.data.includes('"0","900",""'));
    delete window.AtlasLanguage;
    get('atlas-environment-layer').value = 'none';
    await vm.runInContext('applyEnvironmentOverlay()',context);
    assert.equal(map.getSource('environment-overlay'),undefined);
  }
}
for (const mode of ['normal', 'missing-libraries', 'webgl-failure']) await scenario(mode);
// The map runs on this origin alone. An office network that blocks a public
// CDN (many government networks do) must not lose the map, so no page loads
// a script from another host, and the CSP does not permit one.
for (const page of ['index.html', 'dashboard.html', 'research.html']) {
  let html = '';
  try { html = readFileSync(new URL('../public/' + page, import.meta.url), 'utf8'); } catch { continue; }
  const foreign = [...html.matchAll(/<script[^>]*\ssrc=["'](https?:)?\/\/[^"']+/gi)].map(m => m[0]);
  assert.deepEqual(foreign, [], `${page} loads no script from another host`);
}
const worker = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const scriptSrc = /script-src ([^;"]+)/.exec(worker)?.[1] || '';
assert.equal(scriptSrc.trim(), "'self'", 'the CSP permits scripts from this origin only');

console.log('PASS client contract: map bootstrap, grouped layers, rail, provenance text, zero values, escaping, WebGL/CDN fallback, feature selection, bridge and reduced motion');
