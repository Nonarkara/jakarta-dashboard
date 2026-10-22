#!/usr/bin/env node
// The stale-reason rule, tested against fixtures.
//
// A reason in the spatial baseline justifies a decision. If the decision is
// gone, the reason is stale: it excuses nothing, and it would excuse the
// next thing that looks like the one it described. The rule exists so that
// cannot happen silently.
//
// The rule is enforced in THIS project because the owner's instrument turns
// its own stale-reason check off whenever the sweep is narrowed by route,
// and this gate must name its routes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  decisionKey,
  measuredDecisions,
  sweepIsComplete,
  staleReasons,
  staleReasonMessage,
} from './spatial-reasons.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

const baseline = {
  measuredWidths: [360, 1440],
  routes: { '/': {}, '/atlas': {} },
  reasons: {
    'dead|aside.atlas-layers': 'the space under the rail is the map',
    'dead|section#atlas-watch': 'the city watch door floats over the map',
  },
};

const measurement = (route, w, findings) => ({ route, w, findings });
const dead = (sel) => ({ kind: 'dead', sel, metric: 100, detail: 'x' });

// 1. A complete sweep, one reason with nothing under it.
{
  const measurements = [
    measurement('/', 360, []),
    measurement('/', 1440, []),
    measurement('/atlas', 360, [dead('aside.atlas-layers')]),
    measurement('/atlas', 1440, [dead('aside.atlas-layers')]),
  ];
  const r = staleReasons(baseline, measurements);
  assert.equal(r.judged, true, 'a complete sweep must judge the reasons');
  assert.ok(
    r.stale.includes('dead|section#atlas-watch'),
    `the reason with nothing under it must be named (got ${JSON.stringify(r.stale)})`,
  );
  assert.ok(
    !r.stale.includes('dead|aside.atlas-layers'),
    'a reason with a decision under it must not be named stale',
  );
  assert.match(staleReasonMessage(r.stale), /delete each one/i, 'the message must say what to do about it');
  console.log('PASS stale reason: a reason with nothing under it is named');
}

// 2. A complete sweep where every reason still has a decision under it.
{
  const measurements = [
    measurement('/', 360, []),
    measurement('/', 1440, []),
    measurement('/atlas', 360, [dead('aside.atlas-layers'), dead('section#atlas-watch')]),
    measurement('/atlas', 1440, [dead('aside.atlas-layers'), dead('section#atlas-watch')]),
  ];
  const r = staleReasons(baseline, measurements);
  assert.equal(r.judged, true);
  assert.deepEqual(r.stale, [], 'a live reason is not stale');
  console.log('PASS stale reason: a reason with a decision under it is kept');
}

// 3. A NARROWED sweep must not call a reason stale. The instrument's own
//    rule: a decision can be alive at 721px and absent at 360px.
{
  const measurements = [
    measurement('/atlas', 360, [dead('aside.atlas-layers')]),
  ];
  const r = staleReasons(baseline, measurements);
  assert.equal(r.judged, false, 'a narrowed sweep cannot judge a reason');
  assert.deepEqual(r.stale, [], 'a narrowed sweep must not invent a defect');
  assert.match(r.why.join(' '), /not measured/i, 'the reason it could not judge must be said');
  console.log('PASS stale reason: a narrowed sweep judges nothing and says so');
}

// 4. A sweep that missed one recorded width is not a complete sweep.
{
  const measurements = [
    measurement('/', 360, []),
    measurement('/atlas', 360, [dead('aside.atlas-layers')]),
    measurement('/atlas', 1440, [dead('aside.atlas-layers')]),
  ];
  const r = sweepIsComplete(baseline, measurements);
  assert.equal(r.complete, false, 'a missing width means the sweep is not complete');
  assert.match(r.why.join(' '), /\/ @1440px/, 'the missing route-width must be named');
  console.log('PASS stale reason: a sweep missing a recorded width is not complete');
}

// 5. The KIND is part of the decision. A hole and a wrap are different
//    failures and one reason does not excuse the other.
{
  const measurements = [
    measurement('/', 360, []),
    measurement('/', 1440, []),
    measurement('/atlas', 360, [{ kind: 'wrap', sel: 'section#atlas-watch', metric: 1, detail: 'x' }]),
    measurement('/atlas', 1440, [{ kind: 'wrap', sel: 'section#atlas-watch', metric: 1, detail: 'x' }]),
  ];
  const r = staleReasons(baseline, measurements);
  assert.ok(r.stale.includes('dead|section#atlas-watch'), 'a wrap does not excuse a dead-space reason');
  console.log('PASS stale reason: the kind is part of the decision');
}

// 6. Overflow is a property of the page, not a decision to justify.
{
  const b = { measuredWidths: [360], routes: { '/': {} }, reasons: { 'overflow|body': 'x' } };
  const measurements = [measurement('/', 360, [{ kind: 'overflow', sel: 'body', metric: 1, detail: 'x' }])];
  const r = staleReasons(b, measurements);
  assert.deepEqual(r.stale, ['overflow|body'], 'an overflow is not a decision the baseline carries a reason for');
  console.log('PASS stale reason: overflow is not a decision');
}

// 7. The decision key is kind and selector together.
assert.equal(decisionKey({ kind: 'dead', sel: 'aside.atlas-layers' }), 'dead|aside.atlas-layers');
assert.equal(measuredDecisions([measurement('/', 360, [dead('x'), { kind: 'overflow', sel: 'body' }])]).size, 1);
console.log('PASS stale reason: the decision key is kind and selector');

// 8. The gate must actually use the rule. A rule nothing calls is a
//    document, not a guard.
{
  const gate = readFileSync(join(ROOT, 'scripts', 'spatial-gate.mjs'), 'utf8');
  assert.match(gate, /spatial-reasons\.mjs/, 'the gate must load the stale-reason rule');
  assert.match(gate, /staleReasons\(/, 'the gate must call the stale-reason rule');
  console.log('PASS stale reason: the gate calls the rule');
}

console.log('\nPASS spatial reasons: a reason with nothing under it is named, and a narrowed sweep judges nothing');
