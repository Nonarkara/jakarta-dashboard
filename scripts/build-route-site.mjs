#!/usr/bin/env node
/**
 * Build the directory the spatial gate measures.
 *
 * The site ships as a Cloudflare Worker whose ASSETS binding holds `public/`.
 * The Worker does NOT serve `public/` as a plain static tree — it rewrites the
 * pathname first:
 *
 *   /research      -> /research.html
 *   /atlas         -> /index.html
 *   / , /index.html-> /dashboard.html
 *
 * (src/index.ts, routeRequest). So a plain static serve of `public/` measures
 * the wrong page at `/` and 404s at `/atlas` — the gate would be measuring a
 * site that does not exist.
 *
 * This script writes the tree the Worker actually serves:
 *
 *   <out>/index.html    <- public/dashboard.html   (served at /)
 *   <out>/atlas.html    <- public/index.html       (served at /atlas)
 *   <out>/research.html <- public/research.html    (served at /research)
 *
 * Every other file is copied verbatim. All three pages reference their assets
 * by root-absolute path ("/jakarta-design.css", "/research.js"), so the alias
 * changes which page is served at which URL and nothing else — the bytes the
 * gate measures are the bytes the edge serves.
 *
 * Usage: node scripts/build-route-site.mjs [out-dir]
 */
import { cpSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "out", "route-site"));

if (!existsSync(PUBLIC)) {
  console.error(`\nFAIL — there is no public/ directory at ${PUBLIC}.\n`);
  process.exit(1);
}

// The Worker's route table, as (route -> file in public/).
const ROUTES = {
  "index.html": "dashboard.html",
  "atlas.html": "index.html",
  "research.html": "research.html",
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

cpSync(PUBLIC, OUT, { recursive: true });

// `public/index.html` IS the atlas. The Worker serves it at /atlas and serves
// the dashboard at /, so the two files swap places in the built tree.
const atlas = path.join(OUT, "index.html");
const atlasCopy = path.join(OUT, "atlas.html");
copyFileSync(atlas, atlasCopy);
copyFileSync(path.join(OUT, "dashboard.html"), atlas);

// ---------------------------------------------------------------- open drawer
//
// The atlas keeps its data panel in a collapsed <details>. A measure of the
// closed page cannot see inside it — and the panel is where the environment
// controls live, which is exactly where an accidental wrap once hid.
//
// So the build also writes the same page with the drawer opened, served at
// /atlas-open. It is a MEASUREMENT VARIANT, not a second page: the bytes are
// the shipped bytes plus one line that opens a disclosure the reader opens
// anyway. The gate measures both states, because a layout reviewed only in
// the state it happens to open in is half a review.
const DRAWER_OPENER = `<script>(function(){var t=setInterval(function(){var d=document.querySelector('.atlas-embedded-drawer');if(d){d.open=true;clearInterval(t);}},8);})();</script>`;
const atlasHtml = readFileSync(path.join(OUT, "atlas.html"), "utf8");
writeFileSync(path.join(OUT, "atlas-open.html"), atlasHtml.replace("</body>", DRAWER_OPENER + "\n</body>"));

// ---------------------------------------------------------------- breakpoints
//
// The instrument reads the project's own breakpoints out of
// `<site>/_next/static/css/*.css` and measures the width just below each one,
// the breakpoint itself, and the width just above it. This site is static, not
// a Next.js build, so that folder would not exist — and a gate that cannot
// see where the layout changes is a gate that cannot see the defect it was
// written to catch.
//
// So the build writes the stylesheets there, and also lifts the inline
// `<style>` blocks out of the three pages (the research page's own CSS lives
// in the document, where no file-level scan would find it). Nothing references
// these copies; they exist so the gate can read the cliff positions.
const CSS_DIR = path.join(OUT, "_next", "static", "css");
mkdirSync(CSS_DIR, { recursive: true });

const stylesheets = readdirSync(PUBLIC).filter((f) => f.endsWith(".css"));
for (const f of stylesheets) copyFileSync(path.join(PUBLIC, f), path.join(CSS_DIR, f));

let inline = "";
for (const page of Object.values(ROUTES)) {
  const html = readFileSync(path.join(PUBLIC, page), "utf8");
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) inline += m[1] + "\n";
}
writeFileSync(path.join(CSS_DIR, "inline-from-pages.css"), inline);

// ---------------------------------------------------------------- the falsifier
//
// The falsifier injects one real defect per mode into a COPY of the built
// site and requires the gate to catch each. Its "spatially expensive
// information" fixture puts a 2400px block at the top of the page and
// expects the first thing the reader can DO to move down. That can only be
// seen on a page that HAS a first action — and the dashboard's main holds
// only an iframe of the atlas, so its first action is nothing at all.
//
// So the falsifier gets its own copy of the build with the atlas at the root:
// the atlas is the product's page, and its map controls are the first action.
//
// THE COPY MEASURES THE ATLAS THE WAY /atlas SERVES IT.
//
// The atlas decides whether it is embedded by asking whether it has a parent
// window, and an embedded atlas clips its own root
// (`html.atlas-embedded-root { overflow: hidden }`) so the dashboard's iframe
// cannot scroll. The instrument measures inside an iframe — always — so a copy
// that leaves the detection alone is measured in the EMBEDDED state, which is
// a state /atlas never serves.
//
// That difference is not cosmetic. It was measured, not argued about:
//
//   embedded   (root clipped)   a 4000px block injected into the page leaves
//                              documentElement.scrollWidth at 390 — the root
//                              clips it, the page does not scroll sideways, and
//                              the instrument's "the page scrolls sideways"
//                              rule can never fire on this page.
//   standalone (as /atlas)     the same block leaves scrollWidth at 4000, the
//                              page scrolls sideways, and the rule fires.
//
// So in the embedded state the rule is structurally dead, and the falsifier
// reports a dead rule where the page is merely clipped. The copy therefore
// makes the atlas believe it is a top-level page, which is the state the
// product serves at /atlas — a real state, not a doctored one.
const FALSIFY_DIR = path.join(path.dirname(OUT), "route-site-falsify");
rmSync(FALSIFY_DIR, { recursive: true, force: true });
cpSync(OUT, FALSIFY_DIR, { recursive: true });
copyFileSync(path.join(FALSIFY_DIR, "atlas.html"), path.join(FALSIFY_DIR, "index.html"));

// The override goes BEFORE the atlas's own layout script, so the atlas never
// sees a parent window. It is scoped to the copy: the shipped bytes are
// untouched.
const STANDALONE_OVERRIDE = `<script id="__sl_standalone__">
/* The measurement copy serves the atlas the way /atlas serves it: as a
   top-level page with a scrollable root. The instrument measures inside an
   iframe, so without this the copy would only ever be measured in the
   embedded state, where the atlas clips its own root and one of the
   instrument's rules can never fire. */
try { Object.defineProperty(window, "parent", { get: function () { return window; }, configurable: true }); } catch (e) {}
</script>`;

function makeStandalone(html) {
  const m = /<script[^>]*src=["'][^"']*atlas-layout\.js[^"']*["'][^>]*><\/script>/i.exec(html);
  if (m) return html.slice(0, m.index) + STANDALONE_OVERRIDE + "\n" + html.slice(m.index);
  const b = /<body[^>]*>/i.exec(html);
  if (b) return html.slice(0, b.index + b[0].length) + "\n" + STANDALONE_OVERRIDE + "\n" + html.slice(b.index + b[0].length);
  return STANDALONE_OVERRIDE + "\n" + html;
}

for (const page of ["index.html", "atlas.html", "atlas-open.html"]) {
  const p = path.join(FALSIFY_DIR, page);
  if (existsSync(p)) writeFileSync(p, makeStandalone(readFileSync(p, "utf8")));
}

// THE COPY SERVES THE PAGES THE PRODUCT SERVES.
//
// The instrument finds the routes to measure by walking the tree for
// index.html files. The Worker serves /atlas, /research and / from FLAT files
// (atlas.html, research.html, dashboard.html), so a copy of that tree exposes
// exactly one route — the atlas — and the instrument's sweep, and every rule
// about the receipt that runs over a whole sweep, would be a rule about one
// page.
//
// So the copy carries the product's pages as the directories a static host
// would serve them from. Same bytes, same pages, and the sweep now measures
// what the product serves.
const COPY_ROUTES = {
  "atlas": "atlas.html",
  "atlas-open": "atlas-open.html",
  "research": "research.html",
  "dashboard": "dashboard.html",
};
for (const [route, page] of Object.entries(COPY_ROUTES)) {
  const src = path.join(FALSIFY_DIR, page);
  if (!existsSync(src)) continue;
  const dir = path.join(FALSIFY_DIR, route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), makeStandalone(readFileSync(src, "utf8")));
}

let bytes = 0;
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else bytes += statSync(p).size;
  }
}
walk(OUT);

console.log(`  · route site built at ${OUT}`);
console.log(`  · routes: / -> index.html (dashboard), /atlas -> atlas.html, /research -> research.html`);
console.log(`  · breakpoint source: ${stylesheets.length} stylesheet(s) + inline <style> from 3 pages`);
console.log(`  · falsifier copy at ${FALSIFY_DIR} (the atlas at the root and as a top-level page, so the first action exists and the root does not clip)`);
console.log(`  · ${(bytes / 1024 / 1024).toFixed(1)} MB`);
