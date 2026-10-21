import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/rate-limit.ts', import.meta.url), 'utf8');

/**
 * Run the guard against a version of the module. The same assertions must
 * pass on the shipped source and FAIL on every mutant, or the guard is
 * decoration.
 */
async function run(text, label) {
  const compiled = ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const url = 'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64');
  const { checkRateLimit } = await import(url);

  const req = (ip) =>
    new Request('https://jakarta.nonarkara.org/api/atlas/environment', {
      headers: { 'cf-connecting-ip': ip },
    });
  const opts = { limit: 3, windowSeconds: 60, scope: 'api' };

  // Under the limit, a reader is served.
  for (let i = 0; i < 3; i++) {
    const v = await checkRateLimit(req('1.2.3.4'), undefined, opts);
    assert.equal(v.allowed, true, `${label}: request ${i + 1} of 3 is served`);
  }
  // Over it, the reader is told when to come back.
  const over = await checkRateLimit(req('1.2.3.4'), undefined, opts);
  assert.equal(over.allowed, false, `${label}: the fourth request is refused`);
  assert.ok(over.retryAfter > 0, `${label}: a refusal says when to come back`);
  assert.ok(over.retryAfter <= 60, `${label}: the retry hint is inside the window`);
  assert.equal(over.mode, 'isolate', `${label}: the fallback mechanism is named`);

  // One address cannot spend another address's limit.
  const other = await checkRateLimit(req('5.6.7.8'), undefined, opts);
  assert.equal(other.allowed, true, `${label}: another address is unaffected`);

  // The native binding, when present, decides.
  let consulted = 0;
  const native = {
    limit: async () => {
      consulted += 1;
      return { success: false };
    },
  };
  const nativeVerdict = await checkRateLimit(req('9.9.9.9'), { RATE_LIMITER: native }, opts);
  assert.equal(nativeVerdict.allowed, false, `${label}: the native binding decides`);
  assert.equal(nativeVerdict.mode, 'native', `${label}: the native mechanism is named`);
  assert.equal(consulted, 1, `${label}: the native binding was actually consulted`);

  // A fault in the limiter is not an outage in the publisher.
  const faulty = {
    limit: async () => {
      throw new Error('limiter unavailable');
    },
  };
  const served = await checkRateLimit(req('8.8.8.8'), { RATE_LIMITER: faulty }, opts);
  assert.equal(served.allowed, true, `${label}: a fault in the limiter does not block the data`);

  // The window frees up.
  const now = Date.now();
  const realNow = Date.now;
  Date.now = () => now + 61_000;
  try {
    const after = await checkRateLimit(req('1.2.3.4'), undefined, opts);
    assert.equal(after.allowed, true, `${label}: the window frees up`);
  } finally {
    Date.now = realNow;
  }
}

await run(source, 'shipped');

const MUTANTS = [
  [
    'the limit stops limiting',
    source.replace('existing.count > options.limit', 'existing.count > options.limit * 1000'),
  ],
  [
    'the native binding is ignored',
    source.replace('if (env && env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === "function")', 'if (false)'),
  ],
  [
    'a fault in the limiter blocks the data',
    source.replace(
      '      return { allowed: true, retryAfter: 0, mode: "native" };\n    }\n  }',
      '      return { allowed: false, retryAfter: 60, mode: "native" };\n    }\n  }',
    ),
  ],
  [
    'the counter is never incremented',
    source.replace('  existing.count += 1;', ''),
  ],
];

let survived = 0;
for (const [name, mutant] of MUTANTS) {
  if (mutant === source) {
    console.error(`  ✗ ${name} — the mutation did not apply. The guard is not testing what it claims.`);
    survived += 1;
    continue;
  }
  try {
    await run(mutant, name);
    console.error(`  ✗ ${name} — the guard stayed green. It is decoration.`);
    survived += 1;
  } catch {
    console.log(`  · killed: ${name}`);
  }
}
if (survived) {
  console.error(`\nFAIL — ${survived} rate-limit mutant(s) survived.\n`);
  process.exit(1);
}

console.log('PASS rate limit: native binding preferred, in-isolate fallback, a limiter fault never blocks the publisher, and every mutant is killed');
