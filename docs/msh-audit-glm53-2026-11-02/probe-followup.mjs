// Focused follow-up: dashboard iframe interior + honest tap-target breakdown.
import { chromium } from "/Users/nonarkara/Projects/dashboards/HCMC/node_modules/playwright/index.mjs";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const BASE = "https://jakarta.nonarkara.org";
const OUT = path.dirname(new URL(import.meta.url).pathname) + "/probe";
mkdirSync(OUT, { recursive: true });
const CHROME = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(p => p && existsSync(p));

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const out = { iframe: {}, taps: {} };
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // 1. dashboard iframe interior at 390
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(9000);
  const el = await page.$("#city-map");
  const inner = el && (await el.contentFrame());
  if (inner) {
    out.iframe = await inner.evaluate(() => {
      const de = document.documentElement;
      const res = { vw: de.clientWidth, pageScrollX: de.scrollWidth - de.clientWidth };
      const lenses = document.querySelector(".atlas-lenses, nav.atlas-lenses");
      if (lenses) {
        const btns = [...lenses.querySelectorAll("button, a")];
        const vis = btns.filter(b => { const r = b.getBoundingClientRect(); return r.left >= -1 && r.right <= de.clientWidth + 1; });
        const sliced = btns.filter(b => { const r = b.getBoundingClientRect(); return r.left < de.clientWidth && r.right > de.clientWidth + 1; });
        res.lenses = { scrollWidth: lenses.scrollWidth, clientWidth: lenses.clientWidth, hiddenPct: Math.round((1 - lenses.clientWidth / Math.max(1, lenses.scrollWidth)) * 100), doors: btns.length, fullyVisible: vis.length, sliced: sliced.length, slicedNames: sliced.map(b => (b.textContent || "").trim().slice(0, 30)), scrollbarVisible: lenses.scrollWidth > lenses.clientWidth };
      }
      const canvas = document.querySelector("canvas.maplibregl-canvas");
      if (canvas) { const r = canvas.getBoundingClientRect(); res.canvas = { w: Math.round(r.width), h: Math.round(r.height), shareOfFramePct: Math.round((r.width / de.clientWidth) * 100) }; }
      const overlap = (a, b) => { if (!a || !b) return null; const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.max(0, Math.round(Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top))); };
      const tools = document.querySelector(".atlas-page-tools");
      if (tools) { const r = tools.getBoundingClientRect(); res.pageTools = { top: Math.round(r.top), h: Math.round(r.height) }; res.overlapToolsVsLenses = overlap(tools, lenses); }
      const layers = document.querySelector(".atlas-layers");
      if (layers) { const r = layers.getBoundingClientRect(); res.layers = { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) }; res.overlapLayersVsTools = overlap(layers, tools); }
      const watch = document.querySelector(".atlas-watch");
      if (watch) { const r = watch.getBoundingClientRect(); res.watch = { top: Math.round(r.top), h: Math.round(r.height) }; res.overlapWatchVsLenses = overlap(watch, lenses); }
      return res;
    });
  }

  // 2. honest tap-target breakdown on research + atlas-waterways at 390
  for (const [name, p] of [["research", "/research"], ["atlas-waterways", "/atlas?lens=waterways"]]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(name === "atlas-waterways" ? 12000 : 6000);
    out.taps[name] = await page.evaluate(() => {
      const rows = [];
      for (const el of document.querySelectorAll("button, input, select, textarea, a[href], summary")) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        // inline text link: an <a> whose parent flow is prose (p, li, td, dd) and is not a standalone block
        const isControl = el.matches("button, input, select, textarea");
        const inProse = !isControl && !!el.closest("p, li, td, dd");
        if (r.height < 32) rows.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").split(" ")[0] || null, h: Math.round(r.height), text: (el.textContent || el.value || "").trim().slice(0, 28), isControl, inProse });
      }
      return { under32: rows.length, controlsUnder32: rows.filter(r => r.isControl).length, inlineLinksUnder32: rows.filter(r => !r.isControl && r.inProse).length, summary: rows.filter(r => !r.isControl && !r.inProse), controls: rows.filter(r => r.isControl) };
    });
  }
} finally { await browser.close().catch(() => {}); }
writeFileSync(path.join(OUT, "probe-followup.json"), JSON.stringify(out, null, 2));
console.log("FOLLOWUP DONE");
