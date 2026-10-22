#!/usr/bin/env node
// Mutation harness for the stale-reason guard.
//
// The guard says: a reason in the spatial baseline must have a measured
// decision under it. If the decision is gone, the reason excuses nothing —
// and it would excuse the next thing that looks like the one it described,
// without anybody re-reading it.
//
// Each mutant below breaks that rule in a way that would let a stale reason
// through, or that would make the guard cry wolf on a narrowed sweep. The
// test must kill every one. A survivor means the guard measures nothing.
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

const MUTANTS = [
  {
    name: 'the rule never finds a stale reason',
    file: 'scripts/spatial-reasons.mjs',
    from: '  const stale = Object.keys(reasons).filter((k) => !keys.has(k));',
    to: '  const stale = [];',
    expect: /the reason with nothing under it must be named/,
  },
  {
    name: 'the rule judges a narrowed sweep',
    file: 'scripts/spatial-reasons.mjs',
    from: '  if (missing.length) {',
    to: '  if (false) {',
    expect: /a narrowed sweep cannot judge a reason/,
  },
  {
    name: 'the rule compares the selector but not the kind',
    file: 'scripts/spatial-reasons.mjs',
    from: '  return `${finding.kind}|${finding.sel}`;',
    to: '  return `${finding.sel}`;',
    expect: /a reason with a decision under it must not be named stale/,
  },
  {
    name: 'the gate stops consulting the rule',
    file: 'scripts/spatial-gate.mjs',
    from: '    const r = staleReasons(baseline, measurements || []);',
    to: '    const r = { judged: false, stale: [], why: ["mutated"] };',
    expect: /the gate must call the stale-reason rule/,
  },
];

let killed = 0;
for (const m of MUTANTS) {
  const dir = mkdtempSync(join(tmpdir(), 'spatial-reasons-mut-'));
  cpSync(REPO, dir, {
    recursive: true,
    filter: (s) =>
      !s.includes('/.git') &&
      !s.includes('node_modules') &&
      !s.includes('/out') &&
      !/\.(png|jpe?g|webp|gif|geojson|geojson\.gz)$/i.test(s),
  });
  const target = join(dir, m.file);
  const original = readFileSync(target, 'utf8');
  if (!original.includes(m.from)) {
    console.log(`SKIP  ${m.name} — anchor not found in ${m.file}`);
    rmSync(dir, { recursive: true, force: true });
    continue;
  }
  writeFileSync(target, original.replace(m.from, m.to));

  let out = '';
  let failed = false;
  try {
    execFileSync('node', ['scripts/test-spatial-reasons.mjs'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    failed = true;
    out = (e.stdout || '') + (e.stderr || '');
  }
  const killedIt = failed && m.expect.test(out);
  console.log(`${killedIt ? 'KILL ' : 'SURV '} ${m.name}`);
  if (!killedIt && failed) {
    console.log('        (failed, but not on the expected assertion)\n        ' + out.split('\n').filter((l) => /Assertion|assert/i.test(l)).slice(0, 2).join('\n        '));
  }
  if (killedIt) killed++;
  rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${killed}/${MUTANTS.length} killed`);
process.exit(killed === MUTANTS.length ? 0 : 1);
