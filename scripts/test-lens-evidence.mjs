// The lens must deliver its own evidence.
//
// A lens whose product is a number — the mapped-feature count and its legend,
// the gauge inventory, the polder budget — carries that number in the panel,
// not on the map. Folded shut behind "Explore evidence", the waterways lens
// showed hydrography and nothing else, including on the deep link the
// water-recovery receipt publishes. And inside the panel the legend was an
// orphan: appended after the coastal and land-cover sections, six elements
// below the count it explained, where it belonged to neither — and, because
// the count arrives on its own, an empty paragraph holding a line of space for
// the whole load.
//
// Two contracts, both mutation-verified by scripts/mutate-lens-evidence.mjs:
//   A. the app opens the evidence for the lens whose product is the panel;
//   B. the legend is the count's own breakdown: directly under it, and never
//      a line of nothing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createController } from '../public/water-traffic.js';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

// ── A. The lens opens its own evidence ──────────────────────────────────────
const branchStart = app.indexOf("} else if (['waterways','traffic'].includes(lens)) {");
assert.ok(branchStart > -1, 'the atlas has a waterways/traffic lens branch');
const branchEnd = app.indexOf("} else if (lens === 'arrival') {", branchStart);
assert.ok(branchEnd > branchStart, 'the waterways/traffic branch is bounded');
const branch = app.slice(branchStart, branchEnd);
assert.match(branch, /^\s*openLensEvidenceOnDesktop\(\);$/m,
  'the water lens opens its own evidence on a desktop screen, so a deep link lands on the lens and not on a sealed panel');
// The helper every panel lens shares: desktop opens, a phone stays folded.
const helper = app.slice(app.indexOf('function openLensEvidenceOnDesktop() {'), app.indexOf('async function showWaterScenario('));
assert.match(helper, /if \(window\.matchMedia\('\(max-width: 700px\)'\)\.matches\) return;\s*const ev = document\.getElementById\('atlas-lens-evidence'\); if \(ev\) ev\.open = true;/,
  'the water lens opens its own evidence on a desktop screen, and only there: the shared helper folds on a phone');
assert.ok(!/max-width: 700px[\s\S]{0,120}max-width: 700px/.test(branch),
  'the water lens opens its evidence once, not twice');

// ── C. The floor every panel control stands on, and the sweep that rules ────
// A panel control is its label plus padding. The floor was 44px, and every
// house style since has been a carve-out from it — so a control nobody
// remembered to carve out was a 44px slab round a 16px line. The traffic
// panel's three action buttons were exactly that.
const css = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
const floor = /#atlas-lens-body button \{([^}]*)\}/.exec(css);
assert.ok(floor, 'the panel stylesheet declares the floor for panel buttons');
assert.ok(!/min-height:\s*44px/.test(floor[1]),
  'the panel button floor is not 44px: a 44px control is a slab round a 16px line, and every house style has been a carve-out from it');
assert.match(floor[1], /min-height:\s*32px/,
  'the panel button floor is 32px: label plus padding');
assert.match(floor[1], /padding:\s*4px 0/,
  'the panel button carries its own padding instead of a fixed height');

// The sweep must reach every lens, including the one with the most controls
// in it, and it must measure BEHIND a disclosure: a control in a collapsed
// section is not on screen, so it is not measured, so it is not ruled on.
const audit = readFileSync(new URL('../scripts/geometry-audit.mjs', import.meta.url), 'utf8');
const swept = /const LENSES = \[([^\]]*)\]/.exec(audit);
assert.ok(swept, 'the geometry audit names the lenses it sweeps');
for (const lens of ['city', 'waterways', 'traffic', 'exposure', 'green', 'arrival', 'confidence', 'air', 'rain', 'haze', 'coverage']) {
  assert.ok(swept[1].includes(`'${lens}'`), `the geometry audit sweeps the ${lens} lens`);
}
assert.match(audit, /querySelectorAll\('#atlas-lens-body details'\)\) d\.open = true/,
  'the geometry audit opens the panel disclosures before measuring the controls: a control in a collapsed section is not on screen, so it is not measured');
assert.match(audit, /panel never stopped changing/,
  'the geometry audit waits for the panel to stop changing rather than to cross a character count');

// ── B. The legend is the count's own breakdown ───────────────────────────────
class Node {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.events = {}; this.attributes = {}; this.value = ''; this._text = ''; this.hidden = false; }
  set textContent(s) { this._text = String(s); this.children = []; }
  get textContent() { return this._text + this.children.map(n => n.textContent).join(' '); }
  append(...nodes) { for (const n of nodes) { n.parentElement = this; this.children.push(n); } }
  replaceChildren(...nodes) { this._text = ''; this.children = []; this.append(...nodes); }
  setAttribute(k, v) { this.attributes[k] = v; }
  addEventListener(e, fn) { this.events[e] = fn; }
  click() { this.events.click?.(); }
}
const saved = { document: globalThis.document, Option: globalThis.Option, fetch: globalThis.fetch };
globalThis.document = {
  createElement: tag => new Node(tag),
  createTextNode: s => { const n = new Node('text'); n.textContent = s; return n; },
  getElementById: () => ({ open: false }),
  addEventListener() {}, removeEventListener() {},
};
globalThis.Option = class extends Node { constructor(text, value) { super('option'); this.textContent = text; this.value = value; } };
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setImmediate(r)); };

function mapFixture() {
  const layers = new Map(), sources = new Map(), listeners = [];
  return {
    layers, sources, listeners, cameras: [],
    getLayer: id => layers.get(id), getSource: id => sources.get(id),
    getStyle: () => ({ layers: [...layers.values()] }),
    addSource: (id, s) => { assert.ok(!sources.has(id)); sources.set(id, s); },
    addLayer: (l, before) => {
      assert.ok(!layers.has(l.id));
      const entries = [...layers.entries()], at = before ? entries.findIndex(([id]) => id === before) : entries.length;
      assert.ok(at >= 0); entries.splice(at, 0, [l.id, { ...l, before }]);
      layers.clear(); for (const [id, layer] of entries) layers.set(id, layer);
    },
    removeLayer: id => layers.delete(id), removeSource: id => sources.delete(id),
    on: (...args) => listeners.push(args),
    off: (...args) => { const i = listeners.findIndex(a => a.every((v, j) => v === args[j])); if (i >= 0) listeners.splice(i, 1); },
    flyTo(options) { this.cameras.push(options); },
  };
}

const waterways = JSON.parse(readFileSync(new URL('../public/data/jakarta-v1/waterways.geojson', import.meta.url)));
const summaryOf = body => body.children.find(n => n.attributes.role === 'status');
const legendOf = body => body.children.find(n => n.className === 'note water-legend');

try {
  // While the mapped reference is still in flight the legend must hold no
  // line at all: an empty paragraph is a row of nothing.
  let resolveWater;
  globalThis.fetch = path => String(path).includes('waterways.geojson')
    ? new Promise(r => { resolveWater = r; })
    : Promise.resolve(String(path).includes('hydrology')
      ? Response.json({ stations: [], predictions: [], available: false })
      : new Response('', { status: 503 }));
  const map = mapFixture(), body = new Node();
  const ui = createController(map, { text: en => en, active: () => 'waterways', buildTag: 'test' });
  const showing = ui.show('waterways', body);
  await flush();

  const summary = summaryOf(body);
  assert.ok(summary, 'the panel states how many mapped features there are');
  assert.ok(legendOf(body), 'the panel carries the legend of those features');
  assert.equal(summary.parentElement, body, 'the summary is a direct child of the panel body');
  assert.equal(body.children.indexOf(legendOf(body)), body.children.indexOf(summary) + 1,
    'the legend sits directly under the count it explains, not six elements below it');
  assert.equal(legendOf(body).hidden, true, 'the legend holds no line of space while the count has not arrived');
  assert.equal(legendOf(body).textContent.trim(), '', 'the legend says nothing before it has something to say');

  resolveWater(Response.json(waterways));
  await flush();
  const filled = legendOf(body);
  assert.equal(filled.hidden, false, 'the legend appears once the count has arrived');
  assert.match(filled.textContent, /By kind/, 'the legend says what it is');
  assert.match(filled.textContent, /3,885|River|Sungai/, 'the legend carries the per-kind breakdown');
  assert.equal(body.children.indexOf(filled), body.children.indexOf(summary) + 1,
    'the legend is still the count’s own breakdown after the count arrives');
  await showing;
  ui.clear();

  // When the mapped reference fails, the legend is empty AND invisible — not
  // a hole in the panel.
  globalThis.fetch = async path => String(path).includes('waterways.geojson')
    ? new Response('', { status: 503 })
    : (String(path).includes('hydrology')
      ? Response.json({ stations: [], predictions: [], available: false })
      : new Response('', { status: 503 }));
  const badMap = mapFixture(), badBody = new Node();
  const bad = createController(badMap, { text: en => en, active: () => 'waterways', buildTag: 'test' });
  await bad.show('waterways', badBody);
  await flush();
  assert.ok(legendOf(badBody), 'the legend survives a failed mapped reference');
  assert.equal(legendOf(badBody).hidden, true, 'a failed mapped reference leaves the legend holding no line');
  assert.equal(legendOf(badBody).textContent.trim(), '', 'a failed mapped reference leaves the legend saying nothing');
  bad.clear();

  console.log('PASS lens evidence: the water lens opens its own evidence, and the legend is the count’s own breakdown — adjacent, labelled, and never an empty line');
} finally {
  Object.assign(globalThis, saved);
}
