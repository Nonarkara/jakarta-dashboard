#!/usr/bin/env node
// Mutation harness for the lens-evidence guards.
//
// Each mutant reintroduces a defect that has actually shipped in this repo.
// The guard must kill it; a survivor means the guard measures nothing and has
// to be rewritten.
//
//   1. the water lens stops opening its own evidence — the state the
//      water-recovery receipt publishes, measured on the live site;
//   2. the legend goes back to where it shipped: appended after the coastal
//      and land-cover sections, six elements below the count it explains;
//   3. the legend holds a line of space while the count is still in flight;
//   4. the legend fills but never appears.
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = '/Users/nonarkara/Projects/dashboards/Jakarta-dashboard';

const OPEN_LINE = "    openLensEvidenceOnDesktop();\n";

const MUTANTS = [
  {
    name: 'the water lens stops opening its own evidence (the shipped defect)',
    file: 'public/app.js',
    // Anchored AFTER the water branch: the same open call stands in the rain,
    // haze, air and flood-monitoring branches, and a blind first-match
    // replacement would have gutted the wrong one — and the guard would have
    // passed. That is how this mutant survived its first run.
    edits: [{ after: "} else if (['waterways','traffic'].includes(lens)) {", from: OPEN_LINE, to: '' }],
    expect: /the water lens opens its own evidence|AssertionError/,
  },
  {
    name: 'the legend goes back to its shipped place, below four unrelated sections',
    file: 'public/water-traffic.js',
    edits: [
      { from: 'body.append(waterSummary,kinds,waterDescription);', to: 'body.append(waterSummary,waterDescription);' },
      {
        from: "    context.landCover(section(body,'Land cover · WorldCover 2021','Tutupan lahan · WorldCover 2021'));\n",
        to: "    context.landCover(section(body,'Land cover · WorldCover 2021','Tutupan lahan · WorldCover 2021'));\n    body.append(kinds);\n",
      },
    ],
    expect: /the legend sits directly under the count it explains|AssertionError/,
  },
  {
    name: 'the legend holds a line of space while the count has not arrived',
    file: 'public/water-traffic.js',
    edits: [{ from: '    kinds.hidden=true;\n', to: '' }],
    expect: /the legend holds no line of space while the count has not arrived|AssertionError/,
  },
  {
    name: 'the legend fills but never appears',
    file: 'public/water-traffic.js',
    edits: [{ from: '        kinds.hidden=false;\n', to: '' }],
    expect: /the legend appears once the count has arrived|AssertionError/,
  },
  {
    name: 'the panel control floor goes back to 44px (the shipped defect)',
    file: 'public/style.css',
    edits: [{
      from: '#atlas-lens-body button { display:block; width:100%; text-align:left; min-height:32px; padding:4px 0; margin-bottom:4px; }',
      to: '#atlas-lens-body button { display:block; width:100%; text-align:left; min-height:44px; margin-bottom:4px; }',
    }],
    expect: /the panel button floor is not 44px|AssertionError/,
  },
  {
    name: 'the traffic lens leaves the sweep (the shipped blindness)',
    file: 'scripts/geometry-audit.mjs',
    edits: [{ from: "'traffic', ", to: '' }],
    expect: /the geometry audit sweeps the traffic lens|AssertionError/,
  },
  {
    name: 'the audit stops opening the disclosures, so the controls stay unseen',
    file: 'scripts/geometry-audit.mjs',
    edits: [{ from: "      for (const d of document.querySelectorAll('#atlas-lens-body details')) d.open = true;\n", to: '' }],
    expect: /the geometry audit opens the panel disclosures|AssertionError/,
  },
];

let killed = 0;
for (const m of MUTANTS) {
  const dir = mkdtempSync(join(tmpdir(), 'lens-mut-'));
  cpSync(REPO, dir, {
    recursive: true,
    filter: s => !s.includes('/.git') && !s.includes('node_modules') && !/\.(png|jpe?g|webp|gif)$/i.test(s),
  });
  const target = join(dir, m.file);
  let original = readFileSync(target, 'utf8');
  let ok = true;
  for (const e of m.edits) {
    let at = 0;
    if (e.after !== undefined) {
      at = original.indexOf(e.after);
      if (at < 0) { console.log(`SKIP  ${m.name} — anchor not found in ${m.file}`); ok = false; break; }
      at += e.after.length;
    }
    const hit = original.indexOf(e.from, at);
    if (hit < 0) { console.log(`SKIP  ${m.name} — anchor not found in ${m.file}`); ok = false; break; }
    original = original.slice(0, hit) + e.to + original.slice(hit + e.from.length);
  }
  if (!ok) { rmSync(dir, { recursive: true, force: true }); continue; }
  writeFileSync(target, original);
  let out = '';
  let failed = false;
  try {
    execFileSync('node', ['scripts/test-lens-evidence.mjs'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { failed = true; out = (e.stdout || '') + (e.stderr || ''); }
  const killedIt = failed && (m.expect === /AssertionError/ || m.expect.test(out));
  console.log(`${killedIt ? 'KILL ' : 'SURV '} ${m.name}`);
  if (!killedIt && failed) {
    console.log('        (failed, but not on the expected assertion)\n        ' +
      out.split('\n').filter(l => /Assertion|assert/i.test(l)).slice(0, 2).join('\n        '));
  }
  if (killedIt) killed++;
  rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${killed}/${MUTANTS.length} killed`);
process.exit(killed === MUTANTS.length ? 0 : 1);
