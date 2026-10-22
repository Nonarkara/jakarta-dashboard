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
import { existsSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { staleReasons, staleReasonMessage } from "./spatial-reasons.mjs";

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
  // BOTH kinds of cliff. A media query changes the layout when the VIEWPORT
  // changes; a container query changes it when the CONTAINER changes, and
  // that happens at a viewport width nobody can read off the stylesheet. A
  // sweep that only knows media queries walks straight past a container cliff
  // and never sees the layout on either side of it — which is exactly how the
  // data drawer's own 520px query would have gone unmeasured.
  for (const f of files) {
    const text = readFileSync(path.join(cssDir, f), "utf8");
    for (const m of text.matchAll(/@(?:media|container)[^{]*?\((?:min|max)-width:\s*([\d.]+)(px|rem|em)\)/g)) {
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

/**
 * RUN THE INSTRUMENT, AND COME BACK WHEN IT HAS SAID WHAT IT FOUND.
 *
 * The instrument races its browser against a 45-minute watchdog, and it
 * never clears that watchdog's timer when the browser wins the race. So a
 * PASSING measurement prints its verdict and then sits there for 45 minutes
 * with a live timer holding the event loop open: the gate hangs on success
 * and exits at once on failure. (The owner's instrument is the owner's; the
 * project cannot edit a vendored file without breaking the hash that says
 * what was measured. So the gate reads the verdict and closes the child.)
 *
 * The instrument's own success line is the signal, and it is only reached
 * when there were no failures to report: the failure path prints them and
 * exits. The output is still streamed, because a gate that hides what it
 * found is a gate nobody can trust.
 */
function runInstrument(args) {
  return new Promise((resolve) => {
    const VERDICT = "every hole, orphan, scattered pair and wrap is either fixed or written down";
    const DEADLINE_MS = 60 * 60 * 1000;
    const started = Date.now();
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const take = (chunk, stream) => {
      out += chunk;
      stream.write(chunk);
    };
    child.stdout.on("data", (d) => take(d, process.stdout));
    child.stderr.on("data", (d) => take(d, process.stderr));
    let settled = false;
    const finish = (code, note) => {
      if (settled) return;
      settled = true;
      if (note) console.log(note);
      resolve(code);
    };
    child.on("close", (code) => finish(code === null ? 1 : code));
    const watch = setInterval(() => {
      if (settled) return;
      if (out.includes(VERDICT)) {
        clearInterval(watch);
        try {
          child.kill("SIGKILL");
        } catch {
          /* already gone */
        }
        finish(out.includes("FAIL —") ? 1 : 0, "  · the instrument has given its verdict; the gate closed its browser");
        return;
      }
      if (Date.now() - started > DEADLINE_MS) {
        clearInterval(watch);
        try {
          child.kill("SIGKILL");
        } catch {
          /* already gone */
        }
        finish(1, "  · the instrument did not finish within an hour");
      }
    }, 250);
  });
}

console.log("· building the route site");
const built = run(process.execPath, [path.join(ROOT, "scripts", "build-route-site.mjs")]);
if (built !== 0) process.exit(built);

// The vendored instrument must be exactly what the receipt was measured
// with. A hand-edited instrument is a gate measuring something other than
// what the baseline says — so the hashes are checked before anything runs.
{
  const { createHash } = await import("node:crypto");
  const manifest = readFileSync(path.join(ROOT, "scripts", "spatial", "INSTRUMENT-SHA256.txt"), "utf8");
  let bad = 0;
  for (const line of manifest.split("\n")) {
    const m = /^([0-9a-f]{64})\s+(\S+)$/.exec(line.trim());
    if (!m) continue;
    const file = path.join(ROOT, "scripts", "spatial", m[2]);
    const got = createHash("sha256").update(readFileSync(file)).digest("hex");
    if (got !== m[1]) {
      console.error(`  ✗ the vendored ${m[2]} is not the instrument the receipt was measured with`);
      console.error(`      recorded ${m[1]}`);
      console.error(`      on disk  ${got}`);
      bad++;
    }
  }
  if (bad) {
    console.error("\nFAIL — the vendored instrument does not match its own receipt. Copy it from the skill package again, update scripts/spatial/INSTRUMENT-SHA256.txt, and re-baseline.\n");
    process.exit(1);
  }
  console.log("  · the vendored instrument matches its recorded hash");
}

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
const MEASUREMENTS = path.join(ROOT, ".spatial-measurements.json");
try {
  const args = [
    CHECK,
    "--base", `http://127.0.0.1:${port}`,
    "--baseline", BASELINE,
    "--routes", ROUTES,
    "--widths", widths.join(","),
    "--json", MEASUREMENTS,
  ];
  if (UPDATE) args.push("--update");
  code = await runInstrument(args);
} finally {
  server.kill();
}

// A REASON MUST HAVE SOMETHING UNDER IT.
//
// The instrument checks this rule itself, but only on a sweep that was not
// narrowed by route — and this gate has to name its routes, because it
// measures a fourth one the build's own table does not carry. Narrowing
// switches the instrument's stale-reason check off, so the rule is enforced
// here, against the measurements of a complete sweep.
//
// Deleting a stale reason stays a thing a person does by hand. This only
// names it.
//
// The check runs even when the instrument failed, because the instrument's
// own failures are about the PAGE and this one is about the RECEIPT. A run
// that reported only the first of the two would send the reader to fix the
// page and leave the stale reason in place to excuse the next one.
let reasonFailure = null;
if (existsSync(MEASUREMENTS)) {
  try {
    const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
    const { measurements } = JSON.parse(readFileSync(MEASUREMENTS, "utf8"));
    const r = staleReasons(baseline, measurements || []);
    if (r.judged && r.stale.length) {
      reasonFailure = staleReasonMessage(r.stale);
    } else if (r.judged) {
      console.log("  · every reason in the baseline still has a decision under it");
    } else {
      console.log(`  · the reasons were not judged: ${r.why.join("; ")}`);
    }
  } catch (e) {
    reasonFailure = `the gate could not read its own measurements: ${e.message}`;
  }
}
try {
  unlinkSync(MEASUREMENTS);
} catch {
  /* nothing to clean up */
}
if (reasonFailure) {
  console.error(`\nFAIL — ${reasonFailure}\n`);
  code = 1;
}
process.exit(code);
