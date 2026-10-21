#!/usr/bin/env node
// Rendered geometry audit for the atlas, at real phone sizes.
//
//   node scripts/geometry-audit.mjs [url] [outDir]
//
// Exit 0 = every check passed. 1 = a defect. 2 = a panel did not populate (an
// upstream outage or rate limit), so nothing was proved; that is never a pass.
// 3 = Playwright is not available.
//
// Why it exists: the type checker, the 38-check rendered audit, the spatial gate
// and 37 API smokes all passed while, on a 390px phone, the lens panel sat on top
// of the card that names a layer's source (every lens), the air panel covered the
// wind compass its own CSS says it must never cover, "Layers +" lost its "+"
// under "City watch" at 360px, one 8px nudge put "Data & sources" on its
// neighbour, and the whole page was wider than a 360px screen. Each was visible
// in one screenshot; nothing rendered the phone.
//
// What it proves: overlapping blocks, row alignment, sideways overflow, and touch-target size
// inside the lens panel and on the map controls, measured on rendered pixels.
// What it does not: whether anything looks good.
//
// Named deviations, not checked because they are the owner's ruling (compact
// chrome, "labels carry the action"): the masthead, the lens strip, and the
// Layers / Quick jump / Around here / City watch / Research / Data & sources
// buttons stay at 22-30px. Everything else a thumb touches is held to 44px.
//
// Needs Playwright, which this repo does not depend on:
//   npm i --no-save playwright     or     PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs
// It targets the deployed site on purpose: the Worker's own egress and edge
// cache serve the data, so a run does not spend your IP's Open-Meteo allowance.
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const url = (process.argv[2] ?? 'https://jakarta.nonarkara.org').replace(/\/$/, '');
const outDir = process.argv[3] ?? 'docs/geometry';
mkdirSync(outDir, { recursive: true });

let chromium;
try { ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')); }
catch { console.error('geometry-audit needs Playwright: npm i --no-save playwright, or set PLAYWRIGHT_MODULE'); process.exit(3); }
function cachedShell() {
  const root = join(homedir(), 'Library', 'Caches', 'ms-playwright');
  try {
    for (const d of readdirSync(root).filter(x => x.startsWith('chromium_headless_shell-')).sort().reverse()) {
      const p = join(root, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
      try { statSync(p); return p; } catch { /* older cache */ }
    }
  } catch { /* none: Playwright resolves its own */ }
  return undefined;
}

// 390 and 375 are the common iPhones, 360 the most common Android, 320 the
// smallest anyone still carries; 1440 is the desktop the chrome was drawn at.
const VIEWPORTS = [[390, 844], [375, 667], [360, 640], [320, 568], [1440, 900]];
const LENSES = ['city', 'air', 'rain', 'haze'];
const FLOWS = { air: 'wind10', rain: 'syn850', haze: 'haze850' };
const failures = [], unverified = [];
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXEC || cachedShell(), headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });

for (const [W, H] of VIEWPORTS) {
  const phone = W <= 700;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: phone, isMobile: phone, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  for (const lens of LENSES) {
    const tag = `${W}x${H} ${lens}`;
    await page.goto(`${url}/atlas?lens=${lens}&lang=en`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => { const d = document.querySelector('#atlas-lens-evidence'); if (d && !d.open) d.querySelector('summary')?.click(); });
    // A panel that never filled proves nothing. Wait for it, and for the flow.
    // The city lens is a sentence; the others carry data and are much longer.
    const filled = await page.waitForFunction(min => (document.querySelector('#atlas-lens-body')?.innerText || '').length > min, lens === 'city' ? 40 : 160, { timeout: 25000 }).then(() => true, () => false);
    const flow = FLOWS[lens];
    const flowing = !flow || await page.waitForFunction(f => document.querySelector('.flow-canvas')?.dataset.flow === f, flow, { timeout: 25000 }).then(() => true, () => false);
    await page.waitForTimeout(800);
    if (!filled || !flowing) unverified.push(`${tag}: ${!filled ? 'panel did not populate' : `flow "${flow}" did not start`}`);

    const r = await page.evaluate(({ phone }) => {
      const vis = e => e.getBoundingClientRect().width > 0 && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true });
      const name = e => (e.id || e.getAttribute('aria-label') || e.textContent || e.className).toString().trim().replace(/\s+/g, ' ').slice(0, 30);
      const out = { overlap: [], small: [], wide: [], edges: [] };
      const vv = visualViewport.width;
      // The page must be exactly as wide as the screen: not 362px on a 360px phone.
      if (document.documentElement.scrollWidth > vv + 1) out.wide.push(`page is ${document.documentElement.scrollWidth}px on a ${Math.round(vv)}px screen`);
      if (innerWidth > vv + 1) out.wide.push(`layout viewport ${innerWidth}px is wider than the ${Math.round(vv)}px screen`);
      const blocks = [...document.querySelectorAll('body *')].filter(e => {
        if (!vis(e) || e.closest('.maplibregl-canvas-container,.maplibregl-marker,.flow-canvas') || e.matches('canvas,.maplibregl-map,.maplibregl-control-container')) return false;
        const tool = e.matches('.atlas-page-tools summary,.atlas-page-tools a,.atlas-layers > details > summary,.atlas-layers > summary,.atlas-quick summary');
        const cs = getComputedStyle(e), b = e.getBoundingClientRect();
        if (!tool && !/absolute|fixed/.test(cs.position)) return false;
        if (e.matches('[class*=maplibregl-ctrl-]:not(.maplibregl-ctrl-group):not(.maplibregl-ctrl-attrib)') || cs.pointerEvents === 'none') return false;
        return (tool || b.width * b.height > 1500) && b.width < innerWidth * 0.995;
      });
      const leaves = blocks.filter(e => !blocks.some(o => o !== e && e.contains(o)));
      for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
        const a = leaves[i], c = leaves[j]; if (a.contains(c) || c.contains(a)) continue;
        const ra = a.getBoundingClientRect(), rc = c.getBoundingClientRect();
        const ox = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left), oy = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top);
        if (ox > 2 && oy > 2) out.overlap.push(`${name(a)} x ${name(c)} (${Math.round(ox)}x${Math.round(oy)}px)`);
      }
      // Buttons on one row share their top and bottom edges (the planar-alignment law).
      // "Data & sources" hung 8px below its neighbours for months because a leftover
      // `top:8px` still nudged it after it stopped being absolutely placed.
      const row = [...document.querySelectorAll('.atlas-page-tools summary, .atlas-page-tools a')].filter(vis).map(e => [e, e.getBoundingClientRect()]);
      for (let i = 0; i < row.length; i++) for (let j = i + 1; j < row.length; j++) {
        const [a, ra] = row[i], [c, rc] = row[j];
        if (Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top) < 0.5 * Math.min(ra.height, rc.height)) continue; // different rows
        if (Math.abs(ra.top - rc.top) > 1.5 || Math.abs(ra.bottom - rc.bottom) > 1.5) out.edges.push(`${name(a)} (${Math.round(ra.top)}..${Math.round(ra.bottom)}) vs ${name(c)} (${Math.round(rc.top)}..${Math.round(rc.bottom)})`);
      }
      if (phone) for (const e of document.querySelectorAll('.maplibregl-ctrl-group button, #atlas-lens-body button, #atlas-lens-body summary, #atlas-lens-body select, #atlas-lens-body input[type="range"]')) {
        if (!vis(e) || e.closest('.maplibregl-ctrl-attrib')) continue;
        const b = e.getBoundingClientRect();
        if (b.width < 43.5 || b.height < 43.5) out.small.push(`${name(e)} ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      return out;
    }, { phone });
    const found = [...r.wide.map(x => `sideways overflow: ${x}`), ...r.overlap.map(x => `overlap: ${x}`), ...r.edges.map(x => `edges do not meet on one row: ${x}`), ...[...new Set(r.small)].slice(0, 8).map(x => `touch target under 44px: ${x}`)];
    for (const f of found) { failures.push(`${tag}: ${f}`); console.log(`  FAIL ${tag}: ${f}`); }
    await page.screenshot({ path: join(outDir, `${W}x${H}-${lens}.png`) });
  }
  console.log(`  ${W}x${H} done`);
  await ctx.close();
}
await browser.close();

for (const u of unverified) console.log(`  UNVERIFIED ${u}`);
if (failures.length) { console.log(`\nGEOMETRY AUDIT FAILED: ${failures.length} problem${failures.length === 1 ? '' : 's'} on ${url}`); process.exit(1); }
if (unverified.length) { console.log(`\nGEOMETRY AUDIT UNVERIFIED: ${unverified.length} panel${unverified.length === 1 ? '' : 's'} had no data, so nothing was proved`); process.exit(2); }
console.log(`\nGEOMETRY AUDIT PASS: ${url} · ${VIEWPORTS.length} viewports x ${LENSES.length} lenses, no overlap, no sideways overflow, touch targets held`);
