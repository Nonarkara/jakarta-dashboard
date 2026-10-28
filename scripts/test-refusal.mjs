#!/usr/bin/env node
// One rule for a refused request, and the proof that every client obeys it.
//
// The failure this exists to prevent: the API refuses a request — HTTP 429,
// "too many requests" — and the client reports a broken or missing source.
// The water lens answered "0 current levels · 58 without a usable level / 58
// gauges" for a request the server never measured. That is a claim about the
// city's water, made from a refusal.
//
// A refusal is a distinct state: not an outage, not a zero, not an all-clear.
// The guard proves three things:
//   1. the shared reader reads a refusal correctly and keeps its window;
//   2. the lenses RENDER a refusal as a refusal and print no claim about the
//      subject while the request was refused;
//   3. every client that reads an /api/ response goes through that reader —
//      so the next client someone writes is right by default.

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  REFUSAL_STATUS, readJson, readRefusal, refusalSeconds, isRefusalError,
  refusalMessage, refusalLabel, RefusalError,
} from '../public/refusal.js';
import {createController} from '../public/water-traffic.js';
import {createAirTimeline} from '../public/air-timeline.js';
import {createSynoptic} from '../public/synoptic.js';
import {createWindField} from '../public/wind-field.js';

const en = (text) => text;
const id = (_text, translation) => translation;
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

// ── 1. The shared reader ──────────────────────────────────────────────────
assert.equal(REFUSAL_STATUS, 429, 'the refusal status is the one the server answers with');

const refused = (body, headers) => new Response(JSON.stringify(body), {
  status: 429, headers: {'content-type': 'application/json', ...(headers || {})},
});

await assert.rejects(() => readJson(refused({error: 'Too many requests', retryAfterSeconds: 47}, {'retry-after': '47'})),
  (error) => {
    assert.ok(isRefusalError(error), 'a refused request is a refusal, not a broken source');
    assert.equal(error.retryAfterSeconds, 47, 'the retry window survives the read');
    assert.equal(error.name, 'RefusalError');
    return true;
  });

await assert.rejects(() => readJson(refused({error: 'Too many requests'}, {'retry-after': '30'})),
  (error) => { assert.equal(error.retryAfterSeconds, 30, 'the retry-after header carries the window'); return true; });

await assert.rejects(() => readJson(refused({error: 'Too many requests', retryAfterSeconds: 12})),
  (error) => { assert.equal(error.retryAfterSeconds, 12, "the body's retryAfterSeconds carries the window"); return true; });

await assert.rejects(() => readJson(refused({error: 'Too many requests'})),
  (error) => { assert.ok(isRefusalError(error), 'a refusal without a window is still a refusal'); assert.equal(error.retryAfterSeconds, null); return true; });

await assert.rejects(() => readJson(Response.json({error: 'not found'}, {status: 404})),
  (error) => { assert.equal(isRefusalError(error), false, 'a missing source is not a refusal'); assert.match(error.message, /source 404/); return true; });

assert.deepEqual(await readJson(Response.json({available: true})), {available: true}, 'a good response is still a payload');
assert.equal(readRefusal(Response.json({}, {status: 200})), null, 'a good response is not a refusal');
assert.deepEqual(readRefusal(refused({retryAfterSeconds: 9}), {retryAfterSeconds: 9}), {refused: true, retryAfterSeconds: 9});
assert.deepEqual(readRefusal(refused({}), {retryAfterSeconds: 9}), {refused: true, retryAfterSeconds: 9});
assert.equal(refusalSeconds(refused({}, {'retry-after': '5'}), null), 5, 'the header carries the window');
assert.equal(refusalSeconds(refused({}, {}), {retryAfterSeconds: 8}), 8, 'the body carries the window');
assert.equal(refusalSeconds(refused({}, {}), {}), null, 'a refusal with no window names no number');
assert.equal(isRefusalError(new Error('source 429')), false, 'a status in a message is not a refusal');
assert.equal(isRefusalError(null), false);
assert.ok(isRefusalError(new RefusalError(3)), 'the refusal error identifies itself');
assert.equal(isRefusalError({refused: true}), true, 'a refusal is recognisable across module instances');

const message = refusalMessage(47, en);
assert.match(message, /47/, 'the copy names the retry window');
assert.match(message, /rate limited/i, 'the copy names the cause');
assert.match(message, /No new reading was received/, 'copy states the response without inventing upstream availability');
assert.doesNotMatch(message,/nothing is missing|same reading|Nothing was measured/i);
assert.ok(message.length<120,'a failure reason fits a compact reading row');
assert.doesNotMatch(refusalMessage(null, en), /\d/, 'a refusal without a window names no number');
assert.notEqual(refusalMessage(47, id), message, 'the refusal copy is complete in both languages');
assert.match(refusalMessage(47, id), /47/, 'the Indonesian copy names the same window');
assert.match(refusalLabel(47, en), /47/);
assert.match(refusalLabel(47, id), /47/);
assert.doesNotMatch(refusalLabel(null, en), /\d/);

// ── 2. The lenses render a refusal as a refusal ──────────────────────────
const water = JSON.parse(read('public/data/jakarta-v1/waterways.geojson'));

function node(tag = 'div') {
  const self = {
    tagName: tag, children: [], textContent: '', value: '', id: '',
    append(...nodes) { self.children.push(...nodes); for (const n of nodes) if (n && typeof n === 'object') n.parentElement = self; },
    replaceChildren(...nodes) { self.children = []; self.append(...nodes); },
    setAttribute(key, value) { self[key] = value; },
    getAttribute(key) { return self[key]; },
    addEventListener() {}, scrollIntoView() {},
    remove() { if (self.parentElement) self.parentElement.children = self.parentElement.children.filter((c) => c !== self); },
    querySelector(selector) {
      const wanted = String(selector).replace(':scope > ', '').replace('#', '');
      const walk = (n) => {
        for (const child of n.children || []) {
          if (child.id === wanted || (wanted.startsWith('.') && child.className===wanted.slice(1))) return child;
          const hit = walk(child);
          if (hit) return hit;
        }
        return null;
      };
      return walk(self);
    },
  };
  return self;
}
const textOf = (n) => (n.textContent || '') + ' ' + (n.children || []).map(textOf).join(' ');
const testMap = {
  addSource() {}, addLayer() {}, getLayer() { return null; }, getSource() { return null; },
  on() {}, off() {}, flyTo() {}, getZoom() { return 10; }, setLayoutProperty() {},
};

const savedDocument = globalThis.document;
const savedOption = globalThis.Option;
const savedFetch = globalThis.fetch;
globalThis.document = {
  createElement: node,
  getElementById: () => node(),
  querySelector: () => null,
  addEventListener() {}, removeEventListener() {},
};
globalThis.Option = class { constructor(text, value) { this.textContent = text; this.value = value; } };

// The water lens: a refused hydrology request must not become a claim about
// the city's water, and must not fall through to the static reference.
{
  const asked = [];
  globalThis.fetch = async (path) => {
    const url = String(path);
    asked.push(url);
    if (url.includes('waterways.geojson')) return Response.json(water);
    if (url.includes('/api/atlas/hydrology')) {
      return new Response(JSON.stringify({error: 'Too many requests', retryAfterSeconds: 47}), {
        status: 429, headers: {'content-type': 'application/json', 'retry-after': '47'},
      });
    }
    return Response.json({}, {status: 503});
  };
  const body = node();
  const ui = createController(testMap, {text: en, active: () => 'waterways', buildTag: 'test'});
  await ui.show('waterways', body);
  const out = textOf(body);
  assert.match(out, /rate limited/i, 'a refused hydrology request is stated as a refusal');
  assert.match(out, /47/, 'the refusal names the retry window');
  assert.doesNotMatch(out, /current levels/, 'no count of current levels is printed for a refused request');
  assert.doesNotMatch(out, /without a usable level/, 'no count of unusable levels is printed for a refused request');
  assert.doesNotMatch(out, /kept as dated evidence/, 'no dated-evidence count is printed for a refused request');
  assert.ok(!asked.some((url) => url.includes('hydrology-reference')),
    'a refusal does not fall through to the static reference stations');
  ui.clear();
}

// The air lens: a refused model request must not be reported as a model that
// failed validation.
{
  globalThis.fetch = async (path) => {
    if (String(path).includes('air-timeline')) {
      return new Response(JSON.stringify({error: 'Too many requests', retryAfterSeconds: 47}), {
        status: 429, headers: {'content-type': 'application/json', 'retry-after': '47'},
      });
    }
    return Response.json({}, {status: 503});
  };
  const body = node();
  const ui = createAirTimeline(testMap, {text: en, active: () => 'air', buildTag: 'test'});
  ui.show(body);
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
  const out = textOf(body);
  assert.match(out, /rate limited/i, 'a refused model request is stated as a refusal');
  assert.match(out, /47/, 'the refusal names the retry window');
  assert.doesNotMatch(out, /unavailable or failed validation/, 'a refusal is not reported as an invalid model');
  assert.doesNotMatch(out, /Loading the model timeline/, 'the loading state is replaced by the refusal');
  ui.clear();
}

// Real controllers must terminate a refused load and a later ordinary outage.
for(const [name,create,lens] of [['pressure',createSynoptic,'rain'],['wind',createWindField,'air']]){
  let status=429;
  globalThis.fetch=async()=>status===429?refused({retryAfterSeconds:47}):Response.json({available:false},{status:503});
  const body=node();
  const ui=create(testMap,{text:en,active:()=>lens,buildTag:'test'});
  ui.show(body);
  for(let i=0;i<30;i++)await new Promise(r=>setImmediate(r));
  assert.match(textOf(body),/rate limited/i,name+' states429');
  assert.doesNotMatch(textOf(body),/Loading the (pressure|wind) model/,name+' finishes loading');
  status=503;body.replaceChildren();ui.show(body);
  for(let i=0;i<30;i++)await new Promise(r=>setImmediate(r));
  assert.doesNotMatch(textOf(body),/rate limited|Loading the (pressure|wind) model/i,name+' does not retain429 or loading on503');
  assert.match(textOf(body),/unavailable|no usable field/i,name+' states ordinary outage');
  ui.clear();
}

globalThis.document = savedDocument;
globalThis.Option = savedOption;
globalThis.fetch = savedFetch;

// ── 3. Every client goes through the shared reader ────────────────────────
const CLIENTS = [
  'public/app.js', 'public/dashboard.js', 'public/water-traffic.js',
  'public/air-timeline.js', 'public/green-space.js', 'public/synoptic.js',
  'public/wind-field.js', 'public/haze-transport.js', 'public/research.js',
  'public/polder-budget.js',
];
// No response is read with an inline conditional. A response that is not OK
// is either a refusal — which carries its window and must be said out loud —
// or a missing file, and both are named. A bare `? :` or `if (!r.ok)` turns a
// refusal into a silent null, which is the defect this guard exists to stop.
const SWALLOWS = [
  {re: /\.ok\s*\?\s*[^;]{0,80}\.json\(\)\s*:\s*null/g, what: 'reads a refused response as null'},
  {re: /\.ok\s*\?\s*[^;]{0,80}\.json\(\)\s*:\s*\{\s*available:\s*false\s*\}/g, what: 'reads a refused response as an unavailable source'},
  {re: /if\s*\(\s*!\s*\w+\.ok\s*\)\s*return null/g, what: 'drops a refused response'},
  {re: /if\s*\(\s*!\s*\w+\.ok\s*\)\s*throw new Error\(\s*['"]source /g, what: 'reports a refusal as a broken source'},
];

for (const file of CLIENTS) {
  const source = read(file);
  assert.match(source, /refusal\.js/, file + ' reads the shared refusal rule');
  assert.match(source, /isRefusalError|RefusalError/, file + ' can tell a refusal from a broken source');
  assert.match(source, /refusalMessage/, file + ' states a refusal in the reader\'s language');
  for (const rule of SWALLOWS) {
    rule.re.lastIndex = 0;
    let match;
    while ((match = rule.re.exec(source)) !== null) {
      const line = source.slice(0, match.index).split('\n').length;
      assert.fail(file + ' ' + rule.what + ' (line ' + line + ')');
    }
  }
}

console.log('PASS refusal: one reader, the retry window kept, the water and air lenses state a refusal instead of a claim, and every client goes through the shared rule');

const future=new Date(Date.now()+60000).toUTCString();
const dateWindow=refusalSeconds(refused({}, {'retry-after':future}),null);
assert.ok(dateWindow>=59&&dateWindow<=60,'HTTP-date retry window');
assert.equal(refusalSeconds(refused({}),{retryAfterSeconds:true}),null,'boolean is not a duration');
assert.equal(refusalSeconds(refused({}),{retryAfterSeconds:.2}),1,'do not round a positive wait down to zero');
