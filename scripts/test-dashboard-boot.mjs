// The dashboard client must boot. A top-level ReferenceError aborts the whole
// script: on 3 Nov 2026 an undefined `dedupeMasthead` reached production and the
// page lost its clock, its source status and every data section. Syntax checks
// passed; nothing had ever RUN the file. This does: every browser object is a
// permissive stand-in, so only a name the code never defined can fail it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const stub = () => new Proxy(function () {}, {
  get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : k === Symbol.iterator ? function* () {} : k === 'length' ? 0 : stub(),
  apply: () => stub(),
  construct: () => stub(),
  has: () => true,
});
const BROWSER = ['window', 'self', 'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage',
  'fetch', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'matchMedia', 'getComputedStyle',
  'requestAnimationFrame', 'cancelAnimationFrame', 'CustomEvent', 'Event', 'AbortController', 'Image', 'Blob',
  'FormData', 'Headers', 'Request', 'Response', 'addEventListener', 'removeEventListener', 'dispatchEvent',
  'innerWidth', 'innerHeight', 'devicePixelRatio', 'performance', 'crypto', 'screen', 'HTMLElement', 'Element',
  'Node', 'DOMParser', 'XMLSerializer', 'CSS', 'queueMicrotask', 'structuredClone', 'alert', 'open', 'scrollTo',
  'visualViewport', 'BroadcastChannel', 'Worker', 'caches', 'indexedDB', 'Notification', 'EventSource', 'WebSocket'];
const globals = { console: { log() {}, warn() {}, error() {}, info() {} }, setTimeout: () => 0, clearTimeout() {},
  setInterval: () => 0, clearInterval() {} };
for (const name of BROWSER) globals[name] = stub();
const context = vm.createContext(globals);
const source = readFileSync(new URL('../public/dashboard.js', import.meta.url), 'utf8');
let failure = null;
try { vm.runInContext(source, context, { filename: 'dashboard.js' }); } catch (e) { failure = e; }
// A TypeError from a stand-in is the harness, not the client. An undefined name is the client.
const fatal = failure && failure.name === 'ReferenceError' ? failure : null;
assert.equal(fatal, null, `dashboard.js boots without an undefined name: ${fatal && fatal.message}`);

// The check must bite: the shipped defect, re-introduced, is refused.
let bite = null;
try { vm.runInContext(source + '\nnew MutationObserver(dedupeMasthead);', vm.createContext({ ...globals }), { filename: 'mutant.js' }); } catch (e) { bite = e; }
assert.equal(bite && bite.name, 'ReferenceError', 'the boot check refuses an undefined top-level name');
console.log('PASS dashboard boot: the client runs top to bottom, and an undefined name is refused');

// The controller also needs real nodes: permissive browser stand-ins cannot
// detect a repair that deletes its inputs or breaks a disclosure's tag.
const html=readFileSync(new URL('../public/dashboard.html',import.meta.url),'utf8');
function dashboardMarkup(markup){
 const required=['language','atlas-theme','city-navigation','source-status','source-status-line','source-status-overview','source-status-rows','refresh','map-heading','map-status','city-map','basemap','clear-overlay'];
 for(const id of required)assert.equal((markup.match(new RegExp(' id="'+id+'"','g'))||[]).length,1,'one required controller node: '+id);
 assert.equal((markup.match(/<header\b[^>]*class="masthead"/g)||[]).length,1,'one source-owned masthead');
 assert.match(markup,/<details id="city-navigation"/,'Menu is a native disclosure');
 assert.doesNotMatch(markup,/<span class="city-version"/,'build identity stays in the existing footer: a chip beside the wordmark wraps the phone masthead at 339px');
}
dashboardMarkup(html);
for(const id of ['language','source-status','map-status'])assert.throws(()=>dashboardMarkup(html.replace(' id="'+id+'"','')),/required controller node/,'deleted controller node must fail');
assert.throws(()=>dashboardMarkup(html.replace('<details id="city-navigation"','<nav id="city-navigation"')),/native disclosure/);
assert.throws(()=>dashboardMarkup(html.replace('<main>','<header class="masthead"></header><main>')),/source-owned masthead/,'a real duplicate is refused at its source, not deleted at runtime');
console.log('PASS dashboard DOM contract: single header, valid Menu and all controller/source/map controls retained; original removals falsified');
