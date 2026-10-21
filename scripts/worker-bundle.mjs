/**
 * Bundle the Worker into one importable module.
 *
 * The contract tests import `src/index.ts` by compiling it into a `data:`
 * URL module and importing that. A `data:` URL has no base URL, so a
 * relative import left inside it cannot be resolved: Node throws
 * ERR_UNSUPPORTED_RESOLVE_REQUEST, which names a Node internal rather than
 * the dependency that is missing. That is what happened the first time the
 * Worker gained a new dependency.
 *
 * So the bundle is built here, and it resolves the Worker's whole relative
 * import graph into module URLs:
 *
 * - a TypeScript module is transpiled and inlined as a `data:` URL;
 * - a plain JavaScript module with no relative imports keeps its file URL,
 *   so its bare imports (`fast-xml-parser`) still resolve from node_modules;
 * - a dependency that does not exist is refused BY NAME, here, at bundle
 *   time, rather than in the middle of a release.
 *
 * TypeScript is injected rather than imported so this file contains no bare
 * specifiers at all. That keeps it importable as a `data:` URL itself, which
 * is what lets the mutation harness test the bundler rather than trust it.
 */

import { readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

/** `from './x'`, `import './x'`, `import('./x')` — with the specifier captured. */
const RELATIVE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.\.?\/[^'"]*)\2/g;

/** Any import specifier that is not relative — a bare package name. */
const BARE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])((?!\.{1,2}\/)[^'"]*)\2/g;

function isFile(candidate) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/**
 * Find the file a relative specifier means.
 *
 * `./x.js` may be the compiled name of `./x.ts`, so the TypeScript
 * candidate is tried first; `./x` with no extension is tried as-is.
 */
function resolveModuleFile(dir, spec) {
  const base = path.resolve(dir, spec);
  const candidates = [];
  if (base.endsWith('.js')) candidates.push(base.slice(0, -3) + '.ts');
  candidates.push(base, base + '.ts', base + '.js');
  for (const candidate of candidates) {
    if (isFile(candidate)) return candidate;
  }
  return null;
}

/**
 * Build the module URL for one file, rewriting its relative imports.
 */
function buildModule(file, ts, cache, building) {
  const cached = cache.get(file);
  if (cached) return cached;
  if (building.has(file)) {
    throw new Error(
      `Runtime import cycle while bundling the Worker: ${file} is imported while it is still being built.`,
    );
  }
  building.add(file);

  const isTypeScript = file.endsWith('.ts');
  const raw = readFileSync(file, 'utf8');
  let code = isTypeScript
    ? ts.transpileModule(raw, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText
    : raw;

  const dir = path.dirname(file);
  // The bare-specifier check reads the code BEFORE the rewrite: afterwards
  // every resolved import is a `data:` URL, which would look like a bare
  // specifier and refuse the whole bundle.
  const bare = [...code.matchAll(new RegExp(BARE.source, 'g'))].map((m) => m[3]);
  let relativeCount = 0;
  code = code.replace(new RegExp(RELATIVE.source, 'g'), (_match, pre, quote, spec) => {
    relativeCount += 1;
    const target = resolveModuleFile(dir, spec);
    if (!target) {
      throw new Error(
        `${path.basename(file)} imports "${spec}", which has no module in ${dir}.`,
      );
    }
    return `${pre}${quote}${buildModule(target, ts, cache, building)}${quote}`;
  });

  // A module with no relative imports can keep its file URL, so its bare
  // imports still resolve from node_modules. Anything else must be inlined,
  // and an inlined module cannot resolve a bare specifier.
  const inline = isTypeScript || relativeCount > 0;
  if (inline && bare.length) {
    throw new Error(
      `${path.basename(file)} imports the bare specifier(s) ${bare
        .map((b) => `"${b}"`)
        .join(', ')}. A module inlined into the Worker bundle cannot resolve a bare specifier.`,
    );
  }

  const url = inline
    ? 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
    : pathToFileURL(file).href;
  building.delete(file);
  cache.set(file, url);
  return url;
}

/**
 * Bundle the Worker (or any module in `srcDir`) into a `data:` URL.
 *
 * @param {string|undefined} source  Module source. Defaults to `srcDir/index.ts`.
 * @param {{ts: any, srcDir: string}} options
 */
export function bundleWorker(source, options) {
  const ts = options && options.ts;
  const srcDir = options && options.srcDir;
  if (!ts) {
    throw new Error('bundleWorker needs the TypeScript compiler (`ts`) to transpile .ts modules.');
  }
  if (!srcDir) {
    throw new Error('bundleWorker needs `srcDir` — the directory relative imports resolve from.');
  }

  const text = source ?? readFileSync(path.join(srcDir, 'index.ts'), 'utf8');
  let code = ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const cache = new Map();
  const building = new Set();
  code = code.replace(new RegExp(RELATIVE.source, 'g'), (_match, pre, quote, spec) => {
    const file = resolveModuleFile(srcDir, spec);
    if (!file) {
      throw new Error(`The Worker imports "${spec}", which has no module in ${srcDir}.`);
    }
    return `${pre}${quote}${buildModule(file, ts, cache, building)}${quote}`;
  });

  // Nothing relative may survive: a `data:` URL module cannot resolve one.
  const leftover = code.match(new RegExp(RELATIVE.source, 'g'));
  if (leftover) {
    throw new Error(
      `The bundled Worker still contains ${leftover.length} unresolved relative import(s).`,
    );
  }

  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
}

/** The readable text behind a `data:text/javascript;base64,…` module URL. */
export function decodeModuleUrl(url) {
  const marker = 'base64,';
  const index = url.indexOf(marker);
  if (index < 0) return url;
  return Buffer.from(url.slice(index + marker.length), 'base64').toString('utf8');
}
