#!/usr/bin/env node
/**
 * THE SPATIAL GATE.
 *
 * Builds the site the way the Worker serves it, measures its geometry against
 * design/spatial-baseline.json, and fails when a page grew a hole nobody
 * wrote a reason for.
 *
 * Why it does not just call the instrument directly
 * -------------------------------------------------
 * The instrument's own `--dir` server is a plain static server. This site is
 * not a plain static site: the Worker rewrites the pathname before the asset
 * lookup (src/index.ts), so `/` is dashboard.html, `/atlas` is index.html and
 * `/research` is research.html. Serving `public/` as a tree would measure the
 * wrong page at `/`, 404 at `/atlas`, and — because the atlas client is a
 * deferred script the browser must finish before it reports the page loaded —
 * would sometimes measure the atlas before its client had run, which is a
 * skeleton rather than the product.
 *
 * So the gate serves the build through a Worker-faithful server
 * (scripts/serve-route-site.mjs) and measures it through the instrument's
 * `--base` mode. The measurement is the build's own bytes; only the routing
 * is ours.
 *
 * The width sweep is derived from the project's own CSS, exactly as the
 * instrument derives it: the width just below each declared breakpoint, the
 * breakpoint itself, and the width just above it. A breakpoint that appears
 * or disappears changes the sweep, and a width the baseline has never seen
 * fails the gate until somebody reads the diff and re-baselines.
 *
 * Usage:
 *   node scripts/spatial-gate.mjs            # the gate
 *   node scripts/spatial-gate.mjs --update   # re-record the baseline
 *   node scripts/spatial-gate.mjs --falsify  # prove the gate can still fail
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(ROOT, "out", "route-site");
const FALSIFY_BUILD = path.join(ROOT, "out", "route-site-falsify");
const BASELINE = path.join(ROOT, "design", "spatial-baseline.json");
const CHECK = path.join(ROOT, "scripts", "spatial", "spatial-check.mjs");
const FALSIFY = path.join(ROOT, "scripts", "spatial", "spatial-falsify.mjs");
const ROUTES = "/,/atlas,/atlas-open,/research";

const argv = process.argv.slice(2);
const UPDATE = argv.includes("--update");
const FALSIFY_ONLY = argv.includes("--falsify");

/** The widths the project committed to, plus every breakpoint's three widths. */
function sweep() {
  const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : null;
  const widths = new Set(
    base && Array.isArray(base.widths) && base.widths.length
      ? base.widths.map(Number)
      : [360, 480, 768, 1024, 1440, 1920],
  );
  const cssDir = path.join(BUILD, "_next", "static", "css");
  let files = [];
  try {
    files = readdirSync(cssDir).filter((f) => f.endsWith(".css"));
  } catch {
    files = [];
  }
  for (const f of files) {
    const text = readFileSync(path.join(cssDir, f), "utf8");
    for (const m of text.matchAll(/@media[^{]*?\((?:min|max)-width:\s*([\d.]+)(px|rem|em)\)/g)) {
      const n = parseFloat(m[1]);
      if (!Number.isFinite(n) || n <= 0) continue;
      const bp = Math.round(m[2] === "px" ? n : n * 16);
      for (const w of [bp - 1, bp, bp + 1]) if (w > 0) widths.add(w);
    }
  }
  return [...widths].sort((a, b) => a - b);
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts });
  return res.status === null ? 1 : res.status;
}

console.log("· building the route site");
const built = run(process.execPath, [path.join(ROOT, "scripts", "build-route-site.mjs")]);
if (built !== 0) process.exit(built);

if (FALSIFY_ONLY) {
  console.log("\n· falsifying the gate — every mode must fail at least once");
  process.exit(run(process.execPath, [FALSIFY, FALSIFY_BUILD]));
}

const widths = sweep();
console.log(`· sweeping ${widths.length} widths across ${ROUTES.split(",").length} routes`);

// The server has to be up before the instrument connects to it, and down
// after, so it is started here and stopped in the finally block.
const { spawn } = await import("node:child_process");
const server = spawn(process.execPath, [path.join(ROOT, "scripts", "serve-route-site.mjs"), BUILD, "0"], {
  cwd: ROOT,
  stdio: ["ignore", "pipe", "inherit"],
});
let port = null;
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("the route server did not start")), 15000);
  server.stdout.on("data", (d) => {
    const m = /http:\/\/127\.0\.0\.1:(\d+)/.exec(String(d));
    if (m) {
      port = Number(m[1]);
      clearTimeout(timer);
      resolve();
    }
  });
});

let code = 1;
try {
  const args = [
    CHECK,
    "--base", `http://127.0.0.1:${port}`,
    "--baseline", BASELINE,
    "--routes", ROUTES,
    "--widths", widths.join(","),
  ];
  if (UPDATE) args.push("--update");
  code = run(process.execPath, args);
} finally {
  server.kill();
}
process.exit(code);
