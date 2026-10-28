#!/usr/bin/env node
import {copyMutationFixture, verifyMutationFixture, normalMutationFailure, fixtureRoot as REPO} from './mutation-fixture.mjs';
// Mutation harness for the refusal guards.
//
// Each mutant reintroduces a defect that has actually shipped on this site: a
// refused request reported as a broken source, as an outage, or as a zero.
// The guard must kill it; a survivor means the guard measures nothing.
//
//   1. the shared reader stops throwing on a refusal — the shipped defect;
//   2. the retry window is dropped from the header;
//   3. a refusal stops being recognisable;
//   4. the copy stops naming the window;
//   5. the copy stops naming the cause;
//   6. the water lens falls through to the static reference — the shipped
//      false claim about the city's water;
//   7. the air lens reports a refusal as an invalid model;
//   8. the atlas client stops using the shared reader;
//   9. a client stops importing the shared rule at all.
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const MUTANTS = [
  {
    name: 'the shared reader stops throwing on a refusal (the shipped defect)',
    file: 'public/refusal.js',
    edits: [{from: '  if (response.status === REFUSAL_STATUS) {', to: '  if (false) {'}],
    expect: /AssertionError/,
  },
  {
    name: 'the retry window is dropped from the header',
    file: 'public/refusal.js',
    edits: [{from: "  const raw = response?.headers?.get?.('retry-after');", to: '  const raw = null;'}],
    expect: /AssertionError/,
  },
  {
    name: 'a refusal stops being recognisable',
    file: 'public/refusal.js',
    edits: [{
      from: "  if (!error) return false;\n  if (error instanceof RefusalError) return true;\n  return error.refused === true || error.name === 'RefusalError';",
      to: '  return false;',
    }],
    expect: /AssertionError/,
  },
  {
    name: 'the copy stops naming the window',
    file: 'public/refusal.js',
    edits: [{
      from: 'Server retry interval: ${n} seconds.',
      to: 'Retry shortly.',
    }],
    expect: /AssertionError/,
  },
  {
    name: 'the copy stops naming the cause',
    file: 'public/refusal.js',
    edits: [{
      from: 'Request rate limited. Server retry interval: ${n} seconds.',
      to: 'Request failed. Server retry interval: ${n} seconds.',
    }],
    expect: /AssertionError/,
  },
  {
    name: 'the water lens falls through to the static reference (the shipped false claim)',
    file: 'public/water-traffic.js',
    edits: [{
      from: "    if(refusal){if(token!==epoch)return;measure.replaceChildren();measure.append(el('p',refusalMessage(refusal.retryAfterSeconds,t),'note'));return;}\n",
      to: '',
    }],
    expect: /AssertionError/,
  },
  {
    name: 'the air lens reports a refusal as an invalid model',
    file: 'public/air-timeline.js',
    edits: [{
      from: "    if (refusal) {\n      section.append(el('p', refusalMessage(refusal.retryAfterSeconds, t), 'note'));\n      const retry=el('button',t('Retry model timeline','Coba lagi linimasa model'));retry.type='button';retry.addEventListener('click',()=>show(body));section.append(retry);\n      body.append(section); return;\n    }\n",
      to: '',
    }],
    expect: /AssertionError/,
  },
  {
    name: 'the atlas client stops using the shared reader',
    file: 'public/app.js',
    edits: [{
      from: '      const data = mod ? await mod.readJson(r) : await fallbackRead(r);',
      to: '      const data = r.ok ? await r.json() : null;',
    }],
    expect: /AssertionError/,
  },
  {
    name: 'a client stops importing the shared rule',
    file: 'public/green-space.js',
    edits: [{from: "import {readJson,isRefusalError,refusalMessage} from './refusal.js';\n", to: ''}],
    expect: /AssertionError/,
  },
  {
    name: 'pressure drops the refused request state',
    file: 'public/synoptic.js',
    edits: [{from: '    if (state.httpRefusal) {',to: '    if (false) {'}],
    expect: /AssertionError/,
  },
  {
    name: 'wind leaves an ordinary failed request loading',
    file: 'public/wind-field.js',
    edits: [{from: "wind = null; air = null; refusal = httpRefusal ? null : 'unavailable';",to: 'wind = null; air = null; refusal = null;'}],
    expect: /AssertionError/,
  },
];

let fixtureChecked = false;
let killed = 0, skipped = 0;
for (const m of MUTANTS) {
  const dir = mkdtempSync(join(tmpdir(), 'refusal-mut-'));
  copyMutationFixture(REPO, dir);
  if (!fixtureChecked) { verifyMutationFixture(dir, 'scripts/test-refusal.mjs'); fixtureChecked = true; }
  const target = join(dir, m.file);
  let original = readFileSync(target, 'utf8');
  let ok = true;
  for (const e of m.edits) {
    if (!original.includes(e.from)) { console.log(`SKIP  ${m.name} — anchor not found in ${m.file}`); ok = false; break; }
    original = original.replace(e.from, e.to);
  }
  if (!ok) {
    // A mutant whose anchor has gone stale is not a survivor and not a pass.
    // It is an unverified guard, and the harness must say so out loud.
    console.log(`SKIP  ${m.name} — anchor not found in ${m.file}`);
    skipped++;
    rmSync(dir, {recursive: true, force: true});
    continue;
  }
  writeFileSync(target, original);
  let out = '';
  let failed = false;
  try {
    execFileSync('node', ['scripts/test-refusal.mjs'], {cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000});
  } catch (e) { if (!normalMutationFailure(e)) throw e; failed = true; out = (e.stdout || '') + (e.stderr || ''); }
  const killedIt = failed && m.expect.test(out);
  console.log(`${killedIt ? 'KILL ' : 'SURV '} ${m.name}`);
  if (!killedIt && failed) {
    console.log('        (failed, but not on the expected assertion)\n        ' +
      out.split('\n').filter((l) => /Assertion|assert/i.test(l)).slice(0, 2).join('\n        '));
  }
  if (killedIt) killed++;
  rmSync(dir, {recursive: true, force: true});
}
console.log(`\n${killed}/${MUTANTS.length} killed${skipped ? `, ${skipped} skipped` : ''}`);
process.exit(killed === MUTANTS.length ? 0 : 1);
