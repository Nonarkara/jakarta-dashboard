// Throwaway MSH audit probe — measures what the shipped instruments miss.
// Auditor: independent run, 2 Nov 2026. Writes JSON to stdout-adjacent files.
// Playwright comes from the HCMC checkout; do not npm install.
import { chromium } from "/Users/nonarkara/Projects/dashboards/HCMC/node_modules/playwright/index.mjs";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const BASE = "https://jakarta.nonarkara.org";
const OUT = path.dirname(new URL(import.meta.url).pathname) + "/probe";
mkdirSync(OUT, { recursive: true });

const CHROME = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(p => p && existsSync(p));
if (!CHROME) { console.error("FAIL — no Chrome binary"); process.exit(1); }

const WIDTHS = [390, 1024, 1440];
// Live routes only — /atlas-open is a measurement fixture (build-route-site.mjs)
// and 404s on the deployed site; the live waterways deep link is the lens param.
const ROUTES = [
  { path: "/", name: "dashboard" },
  { path: "/atlas", name: "atlas" },
  { path: "/atlas?lens=waterways", name: "atlas-waterways", wait: 12000 },
  { path: "/research", name: "research" },
];

// page-level probe: overflow, tap targets, first-screen composition
const PAGE_PROBE = () => {
  const de = document.documentElement, vw = de.clientWidth;
  const out = { vw, vh: de.clientHeight, pageScrollX: de.scrollWidth - de.clientWidth, spill: [], taps: { total: 0, under24: 0, under32: 0 }, firstScreen: {} };
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || el.closest("dialog:not([open])")) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.right > vw + 1 && r.width < de.scrollWidth) {
      const sel = el.tagName.toLowerCase() + (el.id ? "#" + el.id : el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "");
      const hit = out.spill.find(s => s.sel === sel);
      if (hit) hit.maxRight = Math.max(hit.maxRight, Math.round(r.right));
      else out.spill.push({ sel, maxRight: Math.round(r.right), w: Math.round(r.width) });
    }
    if (el.matches("button, a[href], input, select, summary, [role='button']")) {
      out.taps.total++;
      if (r.height < 24) out.taps.under24++;
      else if (r.height < 32) out.taps.under32++;
    }
  }
  out.spill = out.spill.slice(0, 12);
  // first screen: what the reader sees above the fold
  const fold = de.clientHeight;
  const blocks = [];
  for (const el of document.querySelectorAll("main > *, main section, main > details, header")) {
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= fold) continue;
    const label = el.tagName.toLowerCase() + (el.id ? "#" + el.id : el.className && typeof el.className === "string" ? "." + String(el.className).split(" ")[0] : "");
    blocks.push({ sel: label, top: Math.round(r.top), bottom: Math.round(Math.min(r.bottom, fold)), coversPct: Math.round(Math.min(r.bottom, fold) > r.top ? ((Math.min(r.bottom, fold) - r.top) / fold) * 100 : 0) });
  }
  out.firstScreen.blocks = blocks;
  return out;
};

// iframe interior probe (dashboard only): the named blind spot
const FRAME_PROBE = async (frame) => {
  const res = {};
  try {
    res.frame = await frame.evaluate(() => {
      const de = document.documentElement;
      const out = { vw: de.clientWidth, pageScrollX: de.scrollWidth - de.clientWidth };
      // lens row: content vs visible
      const lenses = document.querySelector(".atlas-lenses, nav.atlas-lenses");
      if (lenses) {
        const btns = [...lenses.querySelectorAll("button, a")];
        const vis = btns.filter(b => { const r = b.getBoundingClientRect(); return r.left >= -1 && r.right <= de.clientWidth + 1; });
        const sliced = btns.filter(b => { const r = b.getBoundingClientRect(); return r.left < de.clientWidth && r.right > de.clientWidth + 1; });
        out.lenses = { scrollWidth: lenses.scrollWidth, clientWidth: lenses.clientWidth, hiddenPct: Math.round((1 - lenses.clientWidth / Math.max(1, lenses.scrollWidth)) * 100), doors: btns.length, fullyVisible: vis.length, sliced: sliced.length, slicedNames: sliced.map(b => (b.textContent || "").trim().slice(0, 24)) };
      }
      // map canvas share of the frame
      const canvas = document.querySelector("canvas.maplibregl-canvas");
      if (canvas) { const r = canvas.getBoundingClientRect(); out.canvas = { w: Math.round(r.width), h: Math.round(r.height), sharePct: Math.round((r.width / de.clientWidth) * 100) }; }
      // floating page tools: do they overlap the lens row or each other?
      const tools = document.querySelector(".atlas-page-tools");
      const layers = document.querySelector(".atlas-layers");
      const overlap = (a, b) => { if (!a || !b) return null; const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)); };
      if (tools) { const r = tools.getBoundingClientRect(); out.pageTools = { top: Math.round(r.top), h: Math.round(r.height), right: Math.round(r.right) }; out.overlapToolsVsLenses = overlap(tools, lenses); }
      if (layers) { const r = layers.getBoundingClientRect(); out.layers = { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) }; out.overlapLayersVsTools = overlap(layers, tools); }
      const story = document.querySelector(".atlas-lens-story");
      if (story) { const r = story.getBoundingClientRect(); out.lensStory = { visible: r.width > 0 && r.height > 0, h: Math.round(r.height) }; }
      return out;
    });
  } catch (e) { res.frameError = String(e.message || e).slice(0, 200); }
  return res;
};

async function gotoRetry(page, url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }); return; }
    catch (e) { if (i === attempts) throw e; await page.waitForTimeout(5000).catch(() => {}); }
  }
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const results = {};
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    results[route.name] = {};
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: w <= 480 ? 844 : w >= 1200 ? 900 : 1000 });
      await gotoRetry(page, BASE + route.path);
      await page.waitForFunction(() => document.readyState !== "loading", undefined, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(route === "/" ? 9000 : 7000); // atlas map settle
      const probe = await page.evaluate(PAGE_PROBE);
      if (route === "/") {
        const frame = page.frameLocator("#city-map");
        // frameLocator has no evaluate; use the frame element's contentFrame()
        const el = await page.$("#city-map");
        const inner = await el.contentFrame();
        if (inner) probe.frameInterior = await FRAME_PROBE(inner);
      }
      // theme spot-checks on the dashboard
      if (route === "/" && w === 390) {
        for (const theme of ["light", "contrast"]) {
          await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
          await page.waitForTimeout(400);
          const shot = path.join(OUT, `dashboard-${theme}-${w}.png`);
          await page.screenshot({ path: shot, timeout: 60000 });
        }
        await page.evaluate(() => { delete document.documentElement.dataset.theme; });
        await page.waitForTimeout(300);
      }
      const shot = path.join(OUT, `${route.name}-${w}.png`);
      await page.screenshot({ path: shot, timeout: 120000 }).catch(e => { probe.shotError = String(e.message || e).slice(0, 120); });
      results[route.name][w] = probe;
    }
  }
} finally { await browser.close().catch(() => {}); }
writeFileSync(path.join(OUT, "probe-results.json"), JSON.stringify(results, null, 2));
console.log("PROBE DONE");
