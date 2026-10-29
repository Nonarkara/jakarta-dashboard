#!/usr/bin/env node
/**
 * THE CHROME CENSUS.
 *
 * A gate that cannot see a thing protects nothing.
 *
 * The spatial instrument measures chrome — the furniture at the top of the
 * screen — as the height of the bands it knows how to name: a fixed band, a
 * sticky band pinned at the top, or an in-flow page bar (a <header> outside
 * <main>) standing at the top of the document. That list is the instrument's
 * own definition, and the instrument is the owner's: vendored byte-identically
 * and pinned by hash, so this project cannot widen it.
 *
 * Which means the instrument has a blind spot, and the blind spot is a plain
 * <div>. A band painted above the <header> pushes the header off top:0 — so
 * the header stops being a band, the div was never a band, and the instrument
 * reports ZERO top chrome on a page that has chrome.
 *
 * That is not a hypothetical. It is what shipped. A thin top bar was added
 * above the city masthead; the instrument's reading fell from 23px to 0px;
 * the receipt was re-baselined to 0px; and the gate went green. The receipt
 * described a page with no furniture on a page with furniture, and the
 * re-baseline — a record of a decision — recorded a blind spot instead. The
 * number looked like an improvement because 0 is smaller than 23.
 *
 * So this census measures the chrome a second way, independently, and makes
 * the two measurements answer for each other:
 *
 *   the receipt — what design/spatial-baseline.json says the chrome is
 *   the census  — what is actually painted above the page's content
 *
 * If they disagree, the receipt is wrong, and the receipt is what every later
 * reader is shown. A page that grew a band nobody wrote a reason for is a
 * hole; a receipt that does not describe the page is a worse one, because it
 * looks like an answer.
 *
 * The census asks the page, not the stylesheet: what is painted, from the top
 * edge of the viewport, before the content begins? A band the instrument
 * cannot see still takes the reader's pixels, and the census says so.
 *
 * Usage:
 *   node scripts/chrome-census.mjs            # the census, against the receipt
 *   node scripts/chrome-census.mjs --falsify  # prove the census can still fail
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(ROOT, "out", "route-site");
const FALSIFY_BUILD = path.join(ROOT, "out", "route-site-census-falsify");
const BASELINE = path.join(ROOT, "design", "spatial-baseline.json");
const ROUTES = ["/", "/atlas", "/atlas-open", "/research"];

const argv = process.argv.slice(2);
const FALSIFY = argv.includes("--falsify");
const ONLY = argv.find((a) => a.startsWith("--route="))?.slice("--route=".length);

// ── the browser ────────────────────────────────────────────────────────────
//
// The same binary the instrument measures with, launched the same way, so a
// number read here and a number read there are the same kind of number.
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((c) => existsSync(c));
if (!CHROME) {
  console.error(
    "\nFAIL — the census could not measure.\n" +
      "  No Chrome binary found. Tried:\n" +
      CHROME_CANDIDATES.map((c) => "    " + c + "\n") +
      "  Set CHROME_PATH=/path/to/chrome.\n",
  );
  process.exit(1);
}

const { chromium } = await import("/Users/nonarkara/Projects/dashboards/HCMC/node_modules/playwright/index.mjs");

/**
 * The census, as it runs inside the page.
 *
 * It is deliberately independent of the instrument's band rules. It does not
 * ask "what is chrome?" — it asks "what is painted at the top of the
 * screen?", and takes the answer from the geometry of the elements that are
 * actually there.
 *
 *   top     — how far down the viewport the furniture reaches
 *   blocks  — how many separate blocks of furniture reach that far
 *   sels    — what those blocks are, so a failure names its cause
 */
const CENSUS = () => {
  const doc = document;
  const win = window;
  const vh = win.innerHeight || doc.documentElement.clientHeight || 0;
  const vw = win.innerWidth || doc.documentElement.clientWidth || 0;
  const main = doc.querySelector("main");

  const label = (el) => {
    if (!el) return "?";
    if (el.id) return "#" + el.id;
    const tag = el.tagName.toLowerCase();
    if (el.classList && el.classList.length) return tag + "." + el.classList[0];
    return tag;
  };

  const inMain = (el) => !!main && (el === main || main.contains(el));
  const inDialog = (el) => !!(el.closest && el.closest('[role="dialog"],[aria-modal="true"],dialog'));

  const nodes = doc.body ? doc.body.querySelectorAll("*") : [];
  const blocks = [];
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    if (el === doc.body || el === doc.documentElement) continue;
    const cs = win.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    // A box that is laid out but not painted — the content of a closed
    // <details>, for instance — takes no pixels from the reader. Counting it
    // would be the census's own version of the instrument's mistake.
    if (typeof el.checkVisibility === "function") {
      if (!el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) continue;
    }
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const fixed = cs.position === "fixed";
    const sticky = cs.position === "sticky";
    const inFlow = cs.position === "static" || cs.position === "relative";
    // A full-screen overlay is a modal the reader opened, not furniture
    // standing at the edge of a page.
    if (fixed && r.width >= vw * 0.9 && r.height >= vh * 0.9) continue;
    if (inDialog(el)) continue;
    // Content is content. The one exception is furniture that LIES ON the
    // content — a fixed or sticky band inside the page's own flow — because
    // that takes the reader's pixels just as much.
    if (inMain(el) && !(fixed || sticky) && r.top > 1) continue;
    // Furniture is either a block in the flow, which pushes the content
    // down, or something pinned to the top edge, which lies over it. A
    // positioned block floating in the middle of the page is an overlay the
    // reader opened — the closed menu drawers are exactly that — and it is
    // not furniture.
    if (!inFlow && !(fixed || sticky) && r.top > 2) continue;
    blocks.push({ el, sel: label(el), top: r.top, bottom: r.bottom, fixed, sticky, inFlow });
  }

  // The furniture is the region from the top edge of the viewport down to the
  // lowest edge of anything standing there. Stacked bands count together,
  // because a reader loses the height of all of them.
  const spans = blocks
    .filter((b) => b.bottom > 0 && b.top < vh)
    .map((b) => ({ top: Math.max(0, b.top), bottom: Math.min(vh, b.bottom), b }));
  spans.sort((a, z) => a.top - z.top);
  let chrome = 0;
  for (const s of spans) {
    if (s.top > chrome + 0.5) break; // a gap: the furniture ends here
    if (s.bottom > chrome) chrome = s.bottom;
  }
  chrome = Math.round(chrome);

  // The BLOCKS are the outermost furniture pieces — a bar and the things
  // inside it are one band, not five.
  const inRun = blocks.filter((b) => b.bottom > 0 && b.top < chrome + 0.5);
  const outer = inRun.filter((b) => !inRun.some((o) => o !== b && o.el.contains(b.el)));
  const sels = outer.map((b) => b.sel);

  return {
    vh,
    chrome,
    blocks: outer.length,
    sels,
    details: outer.map((b) => b.sel + " [" + Math.round(b.top) + "→" + Math.round(b.bottom) + "]"),
  };
};

/**
 * The readiness the instrument uses, in the instrument's own terms.
 *
 * The load event fires when every subresource has arrived, so one stalled
 * request is enough to make it never fire — and a sweep then waits on a
 * browser that is perfectly alive. So the page is waited for by POLLING for
 * a document that has parsed, and the measurement settles on a geometry that
 * has stopped changing.
 */
async function measureCensus(page, url, w, h) {
  await page.setViewportSize({ width: Math.max(w, 320), height: Math.max(h, 400) });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  // Wait for the document to have parsed and its fonts to be ready.
  await page.waitForFunction(
    () => document.readyState !== "loading" && !!document.querySelector("main, body"),
    undefined,
    { timeout: 30000 },
  );
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  // Settle: the FURNITURE has to have stopped changing. The whole page never
  // stops changing — the map animates — so the watch is on the furniture
  // alone, which is what the census is about.
  let last = null;
  let stable = 0;
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    const c = await page.evaluate(CENSUS);
    const sig = c.chrome + "|" + c.blocks + "|" + c.details.join(";");
    if (sig === last) {
      stable++;
      if (stable >= 3) break;
    } else {
      stable = 0;
      last = sig;
    }
    await page.waitForTimeout(50);
  }
  return await page.evaluate(CENSUS);
}

function heightFor(w) {
  if (w <= 480) return 844;
  if (w >= 1200) return 900;
  return 1000;
}

/**
 * The falsifier.
 *
 * A gate that has never failed protects nothing. So the census is run against
 * a build with a band planted above the masthead — the exact shape of the
 * regression that shipped — and it has to catch it. If the census passes that
 * build, the census is not measuring what it claims to measure, and it says
 * so rather than going green.
 */
async function falsify() {
  console.log("\n· falsifying the census — a planted band must be caught");
  const build = await prepareBuild(FALSIFY_BUILD);
  const planted = plantBand(build);
  if (!planted) {
    console.error("\nFAIL — the falsifier could not plant its defect.\n");
    process.exit(1);
  }
  const caught = await census(build, { falsify: true });
  console.log(
    caught
      ? "  · the census caught the planted band"
      : "  · the census did NOT catch the planted band — the census is not measuring what it claims",
  );
  rmSync(FALSIFY_BUILD, { recursive: true, force: true });
  process.exit(caught ? 0 : 1);
}

async function prepareBuild(dir) {
  rmSync(dir, { recursive: true, force: true });
  const res = spawnSync(process.execPath, [path.join(ROOT, "scripts", "build-route-site.mjs"), dir], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (res.status !== 0) {
    console.error("\nFAIL — the census could not build the site it measures.\n");
    process.exit(1);
  }
  return dir;
}

/** Plant the shape that shipped: a plain div band above the masthead. */
function plantBand(build) {
  const file = path.join(build, "index.html");
  if (!existsSync(file)) return false;
  const html = readFileSync(file, "utf8");
  const at = html.indexOf('<header class="masthead"');
  if (at < 0) return false;
  const band = '<div class="top-bar" style="height:24px;background:#123"></div>';
  writeFileSync(file, html.slice(0, at) + band + html.slice(at));
  return true;
}

/**
 * The census, run over the build, compared against the receipt.
 */
async function census(build, options = {}) {
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  const widths = baseline.measuredWidths || baseline.widths || [];
  const routes = ONLY ? [ONLY] : ROUTES;
  const failures = [];
  let measured = 0;

  const server = spawn(process.execPath, [path.join(ROOT, "scripts", "serve-route-site.mjs"), build, "0"], {
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

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
    ],
  });

  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    for (const route of routes) {
      for (const w of widths) {
        const url = `http://127.0.0.1:${port}${route}`;
        let c;
        try {
          c = await measureCensus(page, url, w, heightFor(w));
        } catch (e) {
          failures.push(`${route} @${w}px — the census could not measure the page: ${e.message}`);
          continue;
        }
        measured++;
        const receipt = baseline.routes?.[route]?.[String(w)]?.chrome;
        if (!receipt) {
          // The receipt has no numbers for this width. That is the spatial
          // gate's business to notice, not a lie to be caught here.
          continue;
        }
        const saidTop = Number(receipt.top || 0);
        const saidBands = Number(receipt.stacked || 0);
        // A receipt that claims no top chrome on a page that has some is the
        // exact failure this gate exists for.
        if (Math.abs(c.chrome - saidTop) > 2) {
          failures.push(
            `${route} @${w}px — the receipt says ${saidTop}px of top chrome; the page has ${c.chrome}px ` +
              `(${c.blocks} block(s): ${c.details.join(" | ") || "none"}). ` +
              (c.chrome > saidTop
                ? "The receipt describes a page with less furniture than the page has. The instrument cannot see it; the reader can."
                : "The receipt describes furniture the page no longer has."),
          );
        } else if (c.blocks !== saidBands) {
          failures.push(
            `${route} @${w}px — the receipt says ${saidBands} band(s) of chrome; the page has ${c.blocks} ` +
              `(${c.details.join(" | ") || "none"}).`,
          );
        }
      }
      process.stdout.write(`  · ${route} done\n`);
    }
  } finally {
    await browser.close().catch(() => {});
    server.kill();
  }

  if (options.falsify) {
    // The falsifier asks a different question: did the census see MORE
    // furniture than the receipt on the planted build?
    const plantedChrome = failures.length > 0;
    console.log(`  · ${measured} measurement(s) on the planted build`);
    return plantedChrome;
  }

  console.log(`\n· the census measured ${measured} page(s) and compared them with the receipt`);
  if (failures.length) {
    console.error(`\nFAIL — the receipt and the page disagree in ${failures.length} place(s):\n`);
    for (const f of failures.slice(0, 24)) console.error("  ✗ " + f);
    if (failures.length > 24) console.error(`  · … and ${failures.length - 24} more`);
    console.error("");
    process.exit(1);
  }
  console.log("  · the receipt describes the page: every measurement of top chrome agrees with it\n");
  return true;
}

if (FALSIFY) {
  await falsify();
} else {
  const build = await prepareBuild(BUILD);
  await census(build);
}
