#!/usr/bin/env node
// The source status: one line per source, and the proof that it cannot lie.
//
// The failure this exists to prevent is the one that shipped. A thin bar was
// added above the masthead that counted DOM elements with text and called the
// result "live feeds"; it was hard-coded Indonesian in a bilingual page; it
// ticked a clock every second inside an aria-live region; it duplicated the
// clock the footer already had; and it stood in a band the spatial
// instrument could not see, so the receipt was re-baselined to "0px of top
// chrome" and the gate went green on a page with chrome.
//
// The source status replaces that bar with the answer a morning check
// actually needs: for each source the page reads at runtime — the publisher,
// the tier the publisher stamped, the time the publisher stamped, how old
// that is, and whether it is inside the freshness rule the product already
// applies to it.
//
// The guard proves:
//   1. the band that could not be measured is gone, with its inline script,
//      its duplicate clock and its untranslatable string;
//   2. the status view and the panels read the SAME freshness limits, so the
//      view cannot disagree with the panels it describes;
//   3. a refused source is a refusal — not a zero, not a silence, not a
//      stale reading;
//   4. a source that did not answer is named as such, and a source that
//      answered with old data is called stale rather than silent;
//   5. every source the page fetches has a line, and no source is invented.

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html = read('public/dashboard.html');
const css = read('public/jakarta-design.css');
const js = read('public/dashboard.js');

// ── 1. The band that could not be measured is gone ────────────────────────
for (const gone of ['top-bar', 'top-clock', 'top-vibes', 'menunggu data']) {
  assert.ok(!html.includes(gone), `the page no longer carries "${gone}"`);
  assert.ok(!js.includes(gone), `the client no longer carries "${gone}"`);
  assert.ok(!css.includes(gone), `the stylesheet no longer carries "${gone}"`);
}
// One honest use of "live feed" survives, and it is not a claim about this
// page: the monthly ISPU batch note says the reference is NOT a live feed.
// What is gone is the bar's claim that N feeds were live.
for (const [name, text] of [['page', html], ['client', js]]) {
  const claims = [...text.matchAll(/.{0,14}umpan langsung/g)].map((m) => m[0]);
  assert.ok(
    claims.every((s) => /(Bukan|bukan) umpan langsung/.test(s)),
    `the only "live feed" statement left in the ${name} is the honest one about the monthly batch`,
  );
}
// The inline script counted DOM text and called it a live feed. An inline
// script in the page is the whole reason the bar could not be translated or
// tested; the page carries none.
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)];
assert.equal(inlineScripts.length, 0, 'the page carries no inline script: a script with no src cannot be translated or tested');
// Time now lives once, inside the masthead header — the single top band
// the spatial instrument can see and count — not a <div> blind spot, and
// the footer no longer carries a second clock for the same time.
assert.ok(/<header class="masthead">/.test(html), 'the masthead header is the single top band');
assert.ok(html.includes('masthead-clock'), 'the live clock is inside the masthead header');
assert.ok(!html.includes('id="clock"'), 'the footer no longer carries a duplicate clock');
assert.ok(html.includes('data-tz="Asia/Kolkata"'), 'India time is shown');
assert.ok(html.includes('data-tz="Asia/Jakarta"'), 'Jakarta local time is shown');
assert.ok(html.includes('data-tz="Pacific/Auckland"'), 'New Zealand time is shown');
// A clock that ticks every second inside an aria-live region announces
// itself every second. The status announces through role="status", and only
// when the state actually changes.
assert.ok(!/id="source-status-live"[^>]*aria-live/.test(html), 'the source status announces through a status region, not through a timer');
assert.ok(!html.includes('setInterval'), 'the page carries no timer that could announce on a schedule');
assert.ok(html.includes('role="status"'), 'the live region is a status region');
assert.ok(html.includes('id="source-status-line"'), 'the source status has a line that states the verdict');
assert.ok(html.includes('id="source-status-rows"'), 'the source status has a row for each source');
assert.ok(html.includes('id="source-status-live"'), 'the source status has a live region for readers who cannot see it');
assert.ok(html.includes('role="status"'), 'the live region is a status region');
assert.ok(/class="visually-hidden" id="source-status-live"/.test(html), 'the live region is not something the reader has to look at');
assert.ok(html.includes('data-en="Each source"'), 'the disclosure label is translated like everything else on the page');

// ── 2. The status view and the panels read the same limits ────────────────
const blockStart = js.indexOf('const SOURCE_RULES = {');
const blockEnd = js.indexOf('function clockZones(){');
assert.ok(blockStart > 0 && blockEnd > blockStart, 'the source status lives in a place the test can name');
const block = js.slice(blockStart, blockEnd);

// The air panel and the status view must use the same number, and the
// alerts panel likewise. A status view with its own limits is a second
// opinion, and a second opinion is not evidence.
assert.ok(js.includes('stale(p.observedAt,SOURCE_RULES.air.maxAgeMs)'), 'the air panel reads the shared limit');
assert.ok(js.includes('stale(a.sent,SOURCE_RULES.alerts.maxAgeMs,now)'), 'the alerts panel reads the shared limit');
assert.ok(!/stale\(p\.observedAt,\s*\d/.test(js), 'the air panel does not carry a limit of its own');
assert.ok(!/stale\(a\.sent,\s*\d/.test(js), 'the alerts panel does not carry a limit of its own');

// ── 3. The behaviour, in a sandbox ────────────────────────────────────────
const AIR_FRESH_MS = 3 * 3600000;
const ALERTS_FRESH_MS = 12 * 3600000;

function load(payloads, refusals = new Map()) {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, {textContent: '', innerHTML: '', classList: {toggle() {}}, dataset: {}, querySelector:()=>({setAttribute(){}})});
    return elements.get(id);
  };
  const context = {
    $, lang: 'en', feedRefusals: refusals, scheduleTemporalDeadline(){},
    sourceCheckedAt: Date.now()-300000, sourceChecking:false,
    weatherData: payloads.weather ?? null,
    airData: payloads.air ?? null,
    alertsData: payloads.alerts ?? null,
    quakeData: payloads.quake ?? null,
    floodData: payloads.flood ?? null,
    t: (id, en) => context.lang === 'id' ? id : en,
    esc: (v) => String(v ?? ''),
    date: (v) => (v && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : 'Time unavailable'),
    stale: (v, age, now=Date.now()) => !v || !Number.isFinite(Date.parse(v)) || now-Date.parse(v)>age || Date.parse(v)>now+300000,
  };
  vm.createContext(context);
  vm.runInContext(block, context);
  return {context, $};
}

const NOW = Date.now();
const hourStart = new Date(Math.floor(NOW / 3600000) * 3600000).toISOString();
const hourAgo = new Date(NOW - 3600000).toISOString();
const fourHoursAgo = new Date(NOW - 4 * 3600000).toISOString();
const thirtyMinutesAgo = new Date(NOW - 30 * 60000).toISOString();

const good = {
  weather: {points: [{available:true,issuedAt: new Date(NOW - 6 * 3600000).toISOString(), forecast: [{validAt: new Date(NOW+3600000).toISOString()}]}]},
  air: [{observedAt: hourAgo, aqi: 58}],
  alerts: {available: true, publishedAt: thirtyMinutesAgo, alerts: [{sent: thirtyMinutesAgo}]},
  quake: {available: true, event: {observedAt: new Date(NOW - 2 * 3600000).toISOString(), magnitude: 4.1}},
  flood: {available: true, reportCount: 3, fetchedAt: thirtyMinutesAgo},
};

// Every source the page fetches has a line, and no source is invented.
{
  const {context} = load(good);
  const rows = context.sourceStatusRows(NOW);
  assert.equal(rows.length, 5, 'one line per source the page reads at runtime');
  assert.deepEqual([...rows.map((r) => r.id)].sort(), ['air', 'alerts', 'flood', 'quake', 'weather']);
  assert.ok(rows.every((r) => r.state === 'ok'), 'a source that answered is reported as answered');
  assert.ok(rows.every((r) => r.age !== null && Number.isFinite(r.age)), 'every row carries the age of what it says');
}

// The freshness limits are the product's own, and the view uses them.
{
  const {context} = load(good);
  const [air] = context.sourceStatusRows(NOW).filter((r) => r.id === 'air');
  assert.equal(air.verdict, 'fresh', 'a model sample inside three hours is fresh');
  assert.equal(air.rule, 'air', 'the row names the limit it was measured against');

  const staleAir = load({...good, air: [{observedAt: fourHoursAgo, aqi: 58}]});
  const staleRow = staleAir.context.sourceStatusRows(NOW).filter((r) => r.id === 'air')[0];
  assert.equal(staleRow.verdict, 'stale', 'a model sample past three hours is stale, and is not called silent');
  assert.equal(staleRow.state, 'ok', 'a stale reading is still an answer');
}

// The forecast's own test is its validity, not an invented threshold.
{
  const {context} = load(good);
  const weather = context.sourceStatusRows(NOW).filter((r) => r.id === 'weather')[0];
  assert.equal(weather.verdict, 'upcoming', 'a forecast that covers the hour being read is current');
  const expired = load({...good, weather: {points: [{available:true,issuedAt: new Date(NOW - 6 * 3600000).toISOString(), forecast: [{validAt: new Date(NOW - 5 * 3600000).toISOString()}]}]}});
  const expiredRow = expired.context.sourceStatusRows(NOW).filter((r) => r.id === 'weather')[0];
  assert.equal(expiredRow.verdict, 'expired', 'a forecast that no longer covers this hour has expired');
}

// A refusal is a refusal. It is not a zero, not a silence, and it does not
// become a stale reading.
{
  const {context} = load({...good, air: null}, new Map([['/api/atlas/air-quality', 47]]));
  const air = context.sourceStatusRows(NOW).filter((r) => r.id === 'air')[0];
  assert.equal(air.state, 'refused', 'a refused source says so');
  assert.notEqual(air.state, 'none', 'a refusal is not a source that failed to answer');
  assert.equal(air.verdict, null, 'a refused source has no freshness verdict — nothing was measured');
  assert.equal(air.retry, 47, 'the retry window survives to the status view');
}

// A source that did not answer is named, not counted as zero and not called
// stale.
{
  const {context} = load({...good, quake: null});
  const quake = context.sourceStatusRows(NOW).filter((r) => r.id === 'quake')[0];
  assert.equal(quake.state, 'none', 'a source that did not answer says so');
  assert.equal(quake.verdict, null, 'a source that did not answer has no verdict');
  assert.equal(quake.age, null, 'a source that did not answer has no age to report');
}

// The summary is the morning answer, and it counts only what happened.
{
  const {context, $} = load({...good, air: null}, new Map([['/api/atlas/air-quality', 47]]));
  context.renderSourceStatus();
  const line = $('source-status-overview').textContent;
  assert.match(line, /Data 4\/5/, 'the summary counts the sources that answered');
  assert.match(line, /1 refused/, 'the summary names the refusal');
  assert.match(line, /checked/, 'the summary says when the check happened');
  assert.ok(!/0 sources/.test(line), 'the summary never reports a refusal as zero');
}

// The status view speaks both languages: the page's own strings carry their
// translation, and the strings the client writes come from the t() helper.
{
  assert.ok(
    /class="source-status-more"[^>]*data-en="Each source"[^>]*>Per sumber</.test(html),
    'the disclosure label is written in Indonesian and carries its English',
  );
  const english = load(good);
  english.context.renderSourceStatus();
  const englishRows = english.$('source-status-rows').innerHTML;
  const indonesian = load(good);
  indonesian.context.lang = 'id';
  indonesian.context.renderSourceStatus();
  const indonesianRows = indonesian.$('source-status-rows').innerHTML;
  assert.notEqual(englishRows, indonesianRows, 'the rows are written in the language the reader chose');
  assert.match(englishRows, /fresh/, 'the English row says what it means');
  assert.match(indonesianRows, /segar/, 'the Indonesian row says the same thing in Indonesian');
  assert.ok(!/undefined|NaN|\[object/.test(englishRows + indonesianRows), 'no placeholder leaks into the rows');
}

// ── 4. The receipt can no longer be laundered ─────────────────────────────
// The chrome census exists because the instrument cannot see a band that is
// not a <header>. This asserts the census is wired into the release, so the
// receipt is always checked against the page it describes.
const pkg = JSON.parse(read('package.json'));
assert.ok(pkg.scripts['audit:chrome'], 'the chrome census is a gate, not a script somebody remembers to run');
const census = read('scripts/chrome-census.mjs');
assert.ok(census.includes('--falsify'), 'the census can be asked to prove it still fails');
assert.ok(read('scripts/deploy-live.sh').includes('audit:chrome'), 'the release runs the census before it ships');

console.log('source status: one line per source, one rule for both pages.');

// The underlying availability/records matter, not a truthy response object.
for(const [id,payload] of [['weather',{points:[]}],['air',[]],['alerts',{available:false,alerts:[]}],['quake',{available:false,event:null}],['flood',{available:false,reportCount:0}]]){
 const state=load({...good,[id]:payload}).context.sourceStatusRows(NOW).find(r=>r.id===id);
 assert.equal(state.state,'unavailable',id+' outage/empty data is not a usable answer');
}
assert.equal(load({...good,flood:{...good.flood,reportCount:0}}).context.sourceStatusRows(NOW).find(r=>r.id==='flood').state,'ok','genuine zero reports remain data');
const mixed=load({...good,air:[{aqi:10,observedAt:hourAgo},{aqi:90,observedAt:fourHoursAgo}]}).context.sourceStatusRows(NOW).find(r=>r.id==='air');
assert.equal(mixed.verdict,'mixed','a new location cannot mask an old one');assert.equal(mixed.stamp,fourHoursAgo,'oldest sample is named explicitly');
const between=load({...good,weather:{points:[{available:true,forecast:[{validAt:hourAgo},{validAt:new Date(NOW+3600000).toISOString()}]}]}}).context.sourceStatusRows(NOW).find(r=>r.id==='weather');
assert.equal(between.verdict,'upcoming','between samples, describe the next actual forecast rather than invent an interval');
assert.ok(between.age<0,'a future forecast has a lead time, not an age of zero');
{
 const {context,$}=load(good);let writes=0;const live=$('source-status-live');let value='';
 Object.defineProperty(live,'textContent',{get:()=>value,set:v=>{writes++;value=v}});
 context.renderSourceStatus();const checked=$('source-status-overview').textContent;
 context.renderSourceStatus();context.renderSourceStatus();
 assert.equal(writes,1,'unchanged assessments do not mutate the live region');assert.equal($('source-status-overview').textContent,checked,'a render is not a new request');
 context.airData=null;context.renderSourceStatus();assert.equal(writes,2,'a meaningful availability change is announced');
}
{
 const {context}=load(good);
 assert.match(context.zoneClock('Australia/Sydney',Date.UTC(2026,5,1)).zone,/AEST|GMT\+10/);
 assert.match(context.zoneClock('Pacific/Auckland',Date.UTC(2026,5,1)).zone,/NZST|GMT\+12/);
 assert.match(context.zoneClock('Australia/Sydney',Date.UTC(2026,11,1)).zone,/AEDT|GMT\+11/);
 assert.match(context.zoneClock('Pacific/Auckland',Date.UTC(2026,11,1)).zone,/NZDT|GMT\+13/);
}
const clockBlock=js.slice(js.indexOf('function clockZones(){'),js.indexOf('let temporalSignature'));
assert.doesNotMatch(clockBlock,/renderSourceStatus|source-status/,'clock ticks cannot write a source assessment');
assert.match(js,/setInterval\(refreshTemporalStatus,60000\)/,'source ageing has its own minute assessment');
assert.match(html,/Device clock|Jam perangkat|jam perangkat/,'clock provenance is explicit');
console.log('PASS availability vs zero, mixed sample ages, upcoming slots, stable announcements and winter/summer zones');

{const {context,$}=load({});context.sourceChecking=true;context.sourceCheckedAt=null;context.renderSourceStatus();assert.match($('source-status-line').textContent,/…/);assert.ok(context.sourceStatusRows(NOW).every(r=>r.state==='loading'),'pending requests are not failed sources');}
