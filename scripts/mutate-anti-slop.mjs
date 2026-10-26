#!/usr/bin/env node
import {copyMutationFixture,verifyMutationFixture,normalMutationFailure,fixtureRoot as REPO} from './mutation-fixture.mjs';
// Mutation harness for the anti-slop design guards. Each mutant reintroduces a
// defect that has actually shipped in this repo; the guard must kill it. A
// survivor means the guard measures nothing and must be rewritten.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';


const MUTANTS = [
  {
    name: 'research index drops a section again (the shipped defect)',
    file: 'public/research.html',
    from: '<a href="#h-height"><span lang="id">Tinggi</span><span lang="en">Heights</span></a>',
    to: '',
    expect: /every section is reachable from the contents nav|AssertionError/,
  },
  {
    name: 'contents nav links to a section that does not exist',
    file: 'public/research.html',
    from: '<a href="#h-height">',
    to: '<a href="#h-height-typo">',
    expect: /AssertionError/,
  },
  {
    name: 'a contents entry loses its English half',
    file: 'public/research.html',
    from: '<a href="#h-rules"><span lang="id">Aturan</span><span lang="en">Rules</span></a>',
    to: '<a href="#h-rules"><span lang="id">Aturan</span></a>',
    expect: /each contents entry carries both languages|AssertionError/,
  },
  {
    name: 'the atlas drops the research door entirely',
    file: 'public/atlas-layout.js',
    from: "tools.append(researchLink, drawer);",
    to: "tools.append(drawer);",
    expect: /the atlas offers a link out to the research page|AssertionError/,
  },
  {
    name: 'the research door is buried inside the collapsed drawer',
    file: 'public/atlas-layout.js',
    from: "tools.append(researchLink, drawer);",
    to: "drawer.append(researchLink);tools.append(drawer);",
    expect: /AssertionError/,
  },
  {
    name: 'the research door points somewhere else',
    file: 'public/atlas-layout.js',
    from: "researchLink.href = '/research';",
    to: "researchLink.href = '/?lang=id';",
    expect: /the research link points at the research page|AssertionError/,
  },
  {
    name: 'the research door loses its Indonesian name',
    file: 'public/translations.js',
    from: '"Research & method": "Riset & metode",',
    to: '',
    expect: /the research link is translated|AssertionError/,
  },
  {
    name: 'the page adopts a second name for the research page',
    file: 'public/atlas-layout.js',
    from: "researchLink.textContent = 'Research & method';",
    to: "researchLink.textContent = 'The science bit';",
    expect: /the research page has exactly one name|AssertionError/,
  },
  {
    name: "the review disposition receipt is deleted",
    file: 'docs/REVIEW-DISPOSITION-2026-10-19.md',
    delete: true,
    expect: /the review disposition receipt exists/,
  },
  {
    name: 'a finding is left unanswered',
    file: 'docs/REVIEW-DISPOSITION-2026-10-19.md',
    from: '| **Fixed** | The rain lens panel is 240×692',
    to: '|  | The rain lens panel is 240×692',
    expect: /no finding may be left unanswered/,
  },
  {
    name: 'the lede goes back to a measure that is 80 characters wide',
    file: 'public/research.html',
    from: '.lede{max-width:55ch;',
    to: '.lede{max-width:65ch;',
    expect: /the lede is still capped at 55ch/,
  },
];

let fixtureChecked=false;
let killed = 0;
for (const m of MUTANTS) {
  const dir = mkdtempSync(join(tmpdir(), 'slop-mut-'));
  // docs/ is copied for its markdown — the disposition receipt and the design
  // law are part of what the guard reads — but the 104 PNGs (36 MB) are not.
  copyMutationFixture(REPO,dir);
  if(!fixtureChecked){verifyMutationFixture(dir,'scripts/test-anti-slop-design.mjs');fixtureChecked=true;}
  const target = join(dir, m.file);
  if (m.delete) {
    try {
      rmSync(target);
    } catch {
      console.log(`SKIP  ${m.name} — ${m.file} could not be removed`);
      rmSync(dir, { recursive: true, force: true });
      continue;
    }
  } else {
    const original = readFileSync(target, 'utf8');
    if (!original.includes(m.from)) { console.log(`SKIP  ${m.name} — anchor not found in ${m.file}`); rmSync(dir, { recursive: true, force: true }); continue; }
    writeFileSync(target, original.replace(m.from, m.to));
  }
  let out = '';
  let failed = false;
  try {
    execFileSync('node', ['scripts/test-anti-slop-design.mjs'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { if(!normalMutationFailure(e))throw e; failed = true; out = (e.stdout || '') + (e.stderr || ''); }
  const killedIt = failed && (m.expect === /AssertionError/ || m.expect.test(out));
  console.log(`${killedIt ? 'KILL ' : 'SURV '} ${m.name}`);
  if (!killedIt && failed) console.log('        (failed, but not on the expected assertion)\n        ' + out.split('\n').filter(l => /Assertion|assert/i.test(l)).slice(0, 2).join('\n        '));
  if (killedIt) killed++;
  rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${killed}/${MUTANTS.length} killed`);
process.exit(killed === MUTANTS.length ? 0 : 1);
