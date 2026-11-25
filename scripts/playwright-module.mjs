// Playwright, resolved once.
//
// Four browser gates used to name an absolute path into a sibling checkout's
// node_modules. That works on the machine that wrote them and nowhere else:
// CI has no such checkout, so the chrome census could not run in CI at all,
// and a fresh clone could not run the browser gates either.
//
// Playwright is a devDependency of this repository now, and this file is the
// only place that decides where it comes from. playwright-core is enough:
// the gates drive the Chrome that is already installed on the machine, so
// nothing needs to download a browser.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CANDIDATES = [
  process.env.PLAYWRIGHT_MODULE,
  process.env.PLAYWRIGHT_PATH,
  'playwright',
  'playwright-core',
  // The sibling checkout, last: a convenience on the machine that has it,
  // never a requirement.
  '/Users/nonarkara/Projects/dashboards/HCMC/node_modules/playwright/index.mjs',
].filter(Boolean);

/**
 * The chromium object, from wherever Playwright turns out to live.
 * Throws with every place it looked, so a missing install says where it
 * looked instead of "cannot find module".
 */
export async function loadChromium() {
  const tried = [];
  for (const candidate of CANDIDATES) {
    const specifier = candidate.startsWith('/') || candidate.startsWith('.') ? candidate : candidate;
    try {
      const module = await import(specifier);
      if (module?.chromium) return module.chromium;
      tried.push(`${candidate} — loaded, but it exports no chromium`);
    } catch (error) {
      tried.push(`${candidate} — ${String(error?.message || error).split('\n')[0]}`);
    }
  }
  throw new Error(
    'no Playwright found. Looked in:\n  ' + tried.join('\n  ') +
    '\nInstall it with: npm i --save-dev playwright-core' +
    '\n(or point PLAYWRIGHT_MODULE at an existing install)',
  );
}

/** True when this repository's own install is the one that would be used. */
export function usesLocalInstall() {
  try {
    return existsSync(path.join(ROOT, 'node_modules', 'playwright-core', 'package.json')) ||
      existsSync(path.join(ROOT, 'node_modules', 'playwright', 'package.json'));
  } catch {
    return false;
  }
}
