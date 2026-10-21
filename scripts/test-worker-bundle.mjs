/**
 * The Worker bundler is a guard, so it is guarded.
 *
 * The contract tests import the Worker as a `data:` URL module, and a
 * `data:` URL cannot resolve a relative import. The first time the Worker
 * gained a dependency (`./rate-limit.js`), the release failed inside
 * `npm test` with ERR_UNSUPPORTED_RESOLVE_REQUEST — a Node internal name,
 * not the dependency that was missing.
 *
 * `scripts/worker-bundle.mjs` now resolves the import graph itself and
 * refuses to produce a bundle with a dangling import. That is only worth
 * something if the refusals actually fire, so this test asserts each one,
 * and then mutates the bundler to prove the assertions go red when the
 * refusal is removed.
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SRC_DIR = fileURLToPath(new URL('../src/', import.meta.url));
const BUNDLER_PATH = new URL('./worker-bundle.mjs', import.meta.url);
const bundlerSource = readFileSync(BUNDLER_PATH, 'utf8');

/** Load the bundler, optionally mutated, as a `data:` URL module. */
async function loadBundler(source) {
  const url = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
  return await import(url);
}

/**
 * Assert that `fn` refuses, and that the refusal names the cause.
 *
 * The message is checked rather than the thrown error, so a failure prints
 * the reason instead of the whole bundled module.
 */
function assertRefusal(fn, pattern, label) {
  let error = null;
  try {
    fn();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, `${label}: expected a refusal, got none`);
  assert.match(String(error.message), pattern, `${label}: the refusal must name the cause`);
}

/**
 * Everything the bundler must do. A mutant that breaks any of these must
 * make this function throw.
 */
async function check(bundle, label) {
  // 1. The shipped Worker bundles, and the bundle actually runs.
  const url = bundle.bundleWorker(undefined, { ts, srcDir: SRC_DIR });
  assert.ok(url.startsWith('data:text/javascript;base64,'), `${label}: the Worker is bundled as a data URL`);
  const worker = (await import(url)).default;
  assert.equal(typeof worker.fetch, 'function', `${label}: the bundled Worker answers fetch`);

  // 2. Nothing relative survives in the bundle.
  const decoded = bundle.decodeModuleUrl(url);
  assert.doesNotMatch(decoded, /from\s*['"]\.\.?\//, `${label}: no relative import survives the bundle`);
  assert.doesNotMatch(decoded, /import\s*\(\s*['"]\.\.?\//, `${label}: no dynamic relative import survives the bundle`);

  // 3. A dependency that does not exist is refused, by name.
  //    The import must be a side-effect import: TypeScript elides an
  //    imported name it cannot prove is used, and an elided import is not
  //    in the bundle to be refused.
  assertRefusal(
    () => bundle.bundleWorker('import "./no-such-module.js";', { ts, srcDir: SRC_DIR }),
    /no-such-module/,
    `${label}: a missing dependency is refused by name`,
  );

  // 4. A module that is inlined cannot carry a bare specifier, and the
  //    bundler says which one rather than letting it fail at import time.
  const fixture = mkdtempSync(path.join(tmpdir(), 'jktx-bundle-'));
  try {
    mkdirSync(path.join(fixture, 'nested'), { recursive: true });
    writeFileSync(
      path.join(fixture, 'index.ts'),
      'import { helper } from "./nested/helper.js";\nexport default { helper };\n',
    );
    writeFileSync(
      path.join(fixture, 'nested', 'helper.ts'),
      'import { thing } from "some-package";\nexport const helper = thing;\n',
    );
    assertRefusal(
      () => bundle.bundleWorker(undefined, { ts, srcDir: fixture }),
      /some-package/,
      `${label}: a bare specifier in an inlined module is refused by name`,
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }

  // 5. The bundle resolves a nested relative import rather than dropping it.
  //    Two levels deep, so the rewrite inside a nested module is exercised
  //    and not only the one at the top of the graph.
  const nested = mkdtempSync(path.join(tmpdir(), 'jktx-bundle-'));
  try {
    mkdirSync(path.join(nested, 'nested'), { recursive: true });
    writeFileSync(
      path.join(nested, 'index.ts'),
      'import { a } from "./nested/a.js";\nexport default { a };\n',
    );
    writeFileSync(
      path.join(nested, 'nested', 'a.ts'),
      'import { b } from "./b.js";\nexport const a = b;\n',
    );
    writeFileSync(path.join(nested, 'nested', 'b.ts'), 'export const b = 42;\n');
    const nestedUrl = bundle.bundleWorker(undefined, { ts, srcDir: nested });
    const mod = await import(nestedUrl);
    assert.equal(mod.default.a, 42, `${label}: a nested relative import is resolved, not dropped`);
  } finally {
    rmSync(nested, { recursive: true, force: true });
  }
}

const shipped = await loadBundler(bundlerSource);
await check(shipped, 'shipped');
console.log('  · the shipped bundler bundles the Worker, refuses a missing dependency by name, and resolves nested imports');

const MUTANTS = [
  [
    'a missing dependency is ignored',
    bundlerSource.replace(
      '      throw new Error(`The Worker imports "${spec}", which has no module in ${srcDir}.`);',
      '      return `${pre}${quote}${spec}${quote}`;',
    ),
  ],
  [
    'a bare specifier in an inlined module is ignored',
    bundlerSource.replace('  if (inline && bare.length) {', '  if (false) {'),
  ],
  [
    'a nested relative import is dropped',
    bundlerSource.replace(
      '    return `${pre}${quote}${buildModule(target, ts, cache, building)}${quote}`;',
      '    return `${pre}${quote}${spec}${quote}`;',
    ),
  ],
];

let survived = 0;
for (const [name, mutant] of MUTANTS) {
  if (mutant === bundlerSource) {
    console.error(`  ✗ ${name} — the mutation did not apply. The guard is not testing what it claims.`);
    survived += 1;
    continue;
  }
  try {
    const bundle = await loadBundler(mutant);
    await check(bundle, name);
    console.error(`  ✗ ${name} — the guard stayed green. It is decoration.`);
    survived += 1;
  } catch {
    console.log(`  · killed: ${name}`);
  }
}
if (survived) {
  console.error(`\nFAIL — ${survived} Worker-bundle mutant(s) survived.\n`);
  process.exit(1);
}

console.log('PASS worker bundle: the import graph is resolved by the bundler, a missing dependency is refused by name, and every mutant is killed');
