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
