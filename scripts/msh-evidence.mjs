#!/usr/bin/env node
/**
 * THE MSH EVIDENCE RECORD.
 *
 * The owner's law, §6: "Evidence required before declaring a pass. Capture
 * the real interface at 390, 1024, and 1440 px wide. Use 390 × 844 and
 * 1440 × 900 for the first-screen checks; record the height used at 1024 px.
 * For each tested viewport, record: chrome cost, task visibility, geometry
 * failures, hierarchy, and preservation."
 *
 * §6 also says: "Source scans and successful builds cannot prove a visual
 * pass. If rendering was unavailable, report unverified."
 *
 * So this measures the DEPLOYED site in a real browser, at the three
 * widths the law names, on every route — and writes the record as a
 * document. It is a receipt, not a claim: every number in it is read from
 * the rendered page, and the screenshots it takes are the pixels it
 * measured.
 *
 * Usage: node scripts/msh-evidence.mjs [base-url] [out-dir]
 */
import { chromium } from "/Users/nonarkara/Projects/dashboards/HCMC/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = (process.argv[2] || "https://jakarta.nonarkara.org").replace(/\/+$/, "");
const OUT = process.argv[3] || "docs/msh";

// The law's widths. 1024 has no height of its own in the law, so the height
// used is recorded here, in the record, as the law asks.
const VIEWPORTS = [
  { w: 390, h: 844, note: "the law's phone size" },
  { w: 1024, h: 900, note: "the intermediate width; height 900 used" },
  { w: 1440, h: 900, note: "the law's desktop size" },
];
const ROUTES = [
  { path: "/", name: "dashboard" },
  { path: "/atlas", name: "atlas" },
  { path: "/research", name: "research" },
];

mkdirSync(OUT, { recursive: true });

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

/**
 * A browser of its own, unless one is offered.
 *
 * A committed script cannot depend on somebody else's Chrome staying alive,
 * so this launches its own with a FRESH profile — a killed browser leaves a
 * dirty profile behind, and the next run would fail for the wrong reason —
 * and reads the port Chrome actually bound from DevToolsActivePort.
 */
async function openBrowser() {
  const shared = process.env.MSH_CDP;
  if (shared) {
    try {
      const b = await chromium.connectOverCDP(shared);
      return { browser: b, close: async () => b.close() };
    } catch {
      console.error(`  · no browser at ${shared}; launching one of its own`);
    }
  }
  const exe = CHROME_CANDIDATES.find((c) => existsSync(c));
  if (!exe) {
    console.error("\nFAIL — no Chrome binary found. The law says: if rendering was unavailable, report unverified.\n");
    process.exit(1);
  }
  const profile = mkdtempSync(path.join(tmpdir(), "msh-evidence-"));
  const child = spawn(
    exe,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--hide-scrollbars",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      `--user-data-dir=${profile}`,
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "ignore"] },
  );
  const portFile = path.join(profile, "DevToolsActivePort");
  let port = null;
  for (let i = 0; i < 60 && port === null; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const text = readFileSync(portFile, "utf8").split("\n");
      const n = Number(text[0]);
      if (Number.isFinite(n) && n > 0) port = n;
    } catch {
      /* not written yet */
    }
  }
  if (!port) {
    try { child.kill("SIGKILL"); } catch { /* already gone */ }
    rmSync(profile, { recursive: true, force: true });
    console.error("\nFAIL — the browser did not open a debugging port. The law says: report unverified.\n");
    process.exit(1);
  }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  return {
    browser,
    close: async () => {
      try { await browser.close(); } catch { /* already gone */ }
      try { child.kill("SIGKILL"); } catch { /* already gone */ }
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

let { browser, close } = await openBrowser();
let ctx = browser.contexts()[0] ?? (await browser.newContext());
let page = await ctx.newPage();

/** A browser that died mid-record is replaced, so one heavy page does not
 *  blind every viewport after it. */
async function ensureBrowser() {
  if (browser.isConnected()) return;
  console.error("  · the browser died; starting another");
  ({ browser, close } = await openBrowser());
  ctx = browser.contexts()[0] ?? (await browser.newContext());
  page = await ctx.newPage();
}

/** Everything the law asks for, read from the rendered page. */
async function measure() {
  return await page.evaluate(() => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const de = document.documentElement;
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const visible = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    // ---- chrome cost: top and bottom bands, and how much of the screen
    //
    // The definition is the instrument's, because the instrument is what the
    // gate and the baseline are measured with: a band is fixed, sticky, or
    // an in-flow page bar (a header outside <main>); a full-screen overlay
    // is a modal and not furniture; and the footprint is COMBINED, because a
    // reader loses the height of every band standing there, not just the
    // first one.
    const main = document.querySelector("main") || document.body;
    const pinned = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      const cpos = cs.position;
      const isFixed = cpos === "fixed";
      const isSticky = cpos === "sticky";
      const inMain = el === main || main.contains(el);
      const isBar = !inMain && (el.tagName === "HEADER" || el.getAttribute("role") === "banner");
      if (!isFixed && !isSticky && !isBar) continue;
      const r = el.getBoundingClientRect();
      if (isFixed && r.width >= vw * 0.9 && r.height >= vh * 0.9) continue; // a modal
      pinned.push({ el, r, cs, isFixed, isSticky });
    }
    const topBands = [];
    const bottomBands = [];
    for (const p of pinned) {
      const { r, cs } = p;
      if (p.isFixed) {
        if (r.top <= 1) topBands.push(p);
        if (r.bottom >= vh - 1) bottomBands.push(p);
        continue;
      }
      if (p.isSticky) {
        const stop = parseFloat(cs.top);
        const sbot = parseFloat(cs.bottom);
        if (!isNaN(stop) && stop <= 2 && r.top <= stop + 3) topBands.push(p);
        if (!isNaN(sbot) && r.bottom >= vh - sbot - 3) bottomBands.push(p);
        continue;
      }
      if (r.top <= 2) topBands.push(p);
    }
    const band = (list) => {
      if (!list.length) return { px: 0, stacked: 0, sels: [] };
      const top = Math.min(...list.map((p) => p.r.top));
      const bottom = Math.max(...list.map((p) => p.r.bottom));
      return {
        px: Math.round(bottom - top),
        stacked: list.length,
        sels: list.map((p) => p.el.tagName.toLowerCase() + (p.el.id ? "#" + p.el.id : "." + String(p.el.className || "").split(" ")[0])),
      };
    };
    const top = band(topBands);
    const bottom = band(bottomBands);

    // ---- task visibility: the first thing you can DO
    let firstAction = null;
    for (const el of document.querySelectorAll("a[href], button, input, select, textarea, [role='button']")) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;           // a hidden control
      if (r.right <= 0 || r.left >= vw) continue;          // parked off-screen
      if (r.top < 0 || r.top > vh) continue;
      firstAction = { y: Math.round(r.top), sel: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "." + String(el.className || "").split(" ")[0]), text: (el.textContent || el.value || "").trim().slice(0, 30) };
      break;
    }
    const h1 = document.querySelector("h1");
    const h1Box = h1 ? box(h1) : null;

    // ---- hierarchy: the intended first, second, third reading priorities
    let largest = 0, largestSel = null, peers = 0, h1Size = h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0;
    const total = document.body.innerText.length || 1;
    let peerChars = 0;
    for (const el of document.querySelectorAll("h1,h2,h3,p,span,strong,small,a,button,li,div")) {
      if (!visible(el)) continue;
      let own = "";
      for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
      own = own.replace(/\s+/g, " ").trim();
      if (!own) continue;
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      if (el.tagName !== "H1" && size > largest) { largest = size; largestSel = el.tagName.toLowerCase() + "." + String(el.className || "").split(" ")[0]; }
      if (el.tagName !== "H1" && (Number(cs.fontWeight) || 400) >= 600 && size >= 15 && size < h1Size) {
        // A loud ancestor already carries the voice; counting its children
        // again would count one decision many times. This is the
        // instrument's rule, so the two agree.
        let loudAncestor = false;
        for (let anc = el.parentElement; anc && anc !== document.body; anc = anc.parentElement) {
          const acs = getComputedStyle(anc);
          if ((Number(acs.fontWeight) || 400) >= 600 && parseFloat(acs.fontSize) >= 15 && parseFloat(acs.fontSize) < h1Size) { loudAncestor = true; break; }
        }
        if (!loudAncestor) { peers++; peerChars += own.length; }
      }
    }

    // ---- geometry failures
    const overflowX = de.scrollWidth > de.clientWidth + 1;
    const spill = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        const sel = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "." + String(el.className || "").split(" ")[0]);
        if (!spill.includes(sel)) spill.push(sel);
      }
    }

    // ---- preservation: the product is still there and still usable
    // A TARGET is a control the reader aims at: a button, a field, a
    // select. A link inside a paragraph is text, not a target, and counting
    // it would make a readable page look broken.
    const targets = [...document.querySelectorAll("button, input, select, textarea")].filter(visible);
    const small = targets.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height < 24 || r.width < 24;
    }).length;
    const landmarks = { main: !!document.querySelector("main"), h1: !!h1, nav: !!document.querySelector("nav"), canvas: document.querySelectorAll("canvas").length };

    return {
      vw, vh,
      chrome: {
        topPx: top.px, topPct: Math.round((top.px / vh) * 1000) / 10, topStacked: top.stacked, topSel: top.sels,
        bottomPx: bottom.px, bottomPct: Math.round((bottom.px / vh) * 1000) / 10, bottomStacked: bottom.stacked, bottomSel: bottom.sels,
      },
      task: { firstAction, h1: h1Box, h1Size },
      hierarchy: { h1: h1Size, largest: Math.round(largest * 10) / 10, largestSel, ratio: h1Size && largest ? Math.round((h1Size / largest) * 100) / 100 : null, peers, peerShare: Math.round((peerChars / total) * 10000) / 10000 },
      geometry: { overflowX, scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, spill: spill.slice(0, 6) },
      preservation: { interactive: targets.length, under24px: small, ...landmarks },
    };
  });
}

const rows = [];

/**
 * THE BUILD THIS RECORD IS ABOUT.
 *
 * A receipt that does not name the thing it measured cannot be checked
 * against anything. The deployed client declares its own build tag, so the
 * tag is READ FROM THE EDGE and written into the record. If it cannot be
 * read, the record says so — it never writes a tag it did not read.
 */
let buildTag = null;
try {
  const src = await (await fetch(`${BASE}/app.js`)).text();
  const m = /ATLAS_BUILD_TAG\s*=\s*"([^"]+)"/.exec(src);
  if (m) buildTag = m[1];
} catch {
  buildTag = null;
}

for (const route of ROUTES) {
  for (const v of VIEWPORTS) {
    // A viewport that cannot be rendered is reported as UNVERIFIED, which is
    // what the law asks for. It is never quietly dropped, and it never
    // aborts the record: the other viewports are still evidence.
    try {
      await ensureBrowser();
      await page.setViewportSize({ width: v.w, height: v.h });
      await page.goto(`${BASE}${route.path}`, { waitUntil: "load", timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(route.path === "/atlas" ? 7000 : 5000);
      const m = await measure();
      const shot = path.join(OUT, `${route.name}-${v.w}.png`);
      // The atlas is a live 3D map on software GL, and the screenshot waits
      // for the frame. It gets room rather than a lower quality.
      await page.screenshot({ path: shot, timeout: 180000 });
      rows.push({ route: route.name, path: route.path, ...v, ...m, shot, unverified: null });
      console.log(`  · ${route.name} @${v.w}×${v.h} — chrome ${m.chrome.topPx}px/${m.chrome.topPct}% top, first action ${m.task.firstAction ? m.task.firstAction.y + "px" : "none"}`);
    } catch (e) {
      const why = String(e.message || e).split("\n")[0];
      rows.push({ route: route.name, path: route.path, ...v, unverified: why });
      console.error(`  ✗ ${route.name} @${v.w}×${v.h} — UNVERIFIED: ${why}`);
    }
  }
}

const fmt = (n, u = "") => (n === null || n === undefined ? "—" : `${n}${u}`);
const lines = [];
lines.push("# MSH evidence — the deployed site");
lines.push("");
lines.push(
  buildTag
    ? `**Build:** \`${buildTag}\` — read from the deployed \`app.js\` at ${BASE}.`
    : `**Build:** UNVERIFIED — the build tag could not be read from the deployed \`app.js\` at ${BASE}.`,
);
lines.push(`**Method:** a real browser at the three widths the law names — 390 × 844, 1024 × **900** (the height used at 1024), 1440 × 900 — on every route.`);
lines.push(`**Screenshots:** \`${OUT}/\` — the pixels these numbers were read from.`);
lines.push("");
lines.push("The law's five questions, asked of each viewport.");
lines.push("");

for (const route of ROUTES) {
  lines.push(`## ${route.name} — \`${route.path}\``);
  lines.push("");
  lines.push("| Viewport | Chrome cost | Task visibility | Geometry failures | Hierarchy | Preservation |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of rows.filter((x) => x.route === route.name)) {
    if (r.unverified) {
      lines.push(`| ${r.w} × ${r.h}${r.note ? ` — ${r.note}` : ""} | **unverified** | **unverified** | **unverified** | **unverified** | **unverified** — ${r.unverified} |`);
      continue;
    }
    const chrome = `${fmt(r.chrome.topPx, "px")} top (${fmt(r.chrome.topPct, "%")}), ${fmt(r.chrome.bottomPx, "px")} bottom${r.chrome.topStacked > 1 ? `, ${r.chrome.topStacked} bands stacked` : ""}`;
    const task = r.task.firstAction
      ? `first action at ${r.task.firstAction.y}px — ${r.task.firstAction.y < r.vh ? "**in the first screen**" : "**below the fold**"}${r.task.h1 ? `; the title is at ${r.task.h1.y}px` : ""}`
      : "no action found on the page";
    const geom = r.geometry.overflowX
      ? `**scrolls sideways** (${r.geometry.scrollWidth} > ${r.geometry.clientWidth})`
      : r.geometry.spill.length
        ? `no sideways scroll; ${r.geometry.spill.length} element(s) past the edge: ${r.geometry.spill.join(", ")}`
        : "no sideways scroll, nothing past the edge";
    const hier = `title ${fmt(r.hierarchy.h1, "px")}, loudest ${fmt(r.hierarchy.largest, "px")}${r.hierarchy.largestSel ? ` (${r.hierarchy.largestSel})` : ""}, ratio ${fmt(r.hierarchy.ratio)}, ${r.hierarchy.peers} peer(s) at ${fmt(Math.round(r.hierarchy.peerShare * 1000) / 10, "%")} of the text`;
    const pres = `${r.preservation.interactive} controls, ${r.preservation.under24px} under 24px, ${r.preservation.canvas} canvas(es)${r.preservation.main ? ", main present" : ", **no main**"}${r.preservation.h1 ? ", title present" : ", **no title**"}`;
    lines.push(`| ${r.w} × ${r.h}${r.note ? ` — ${r.note}` : ""} | ${chrome} | ${task} | ${geom} | ${hier} | ${pres} |`);
  }
  lines.push("");
}

lines.push("## How to check this");
lines.push("");
lines.push("Every row is a measurement, and every measurement can be repeated:");
lines.push("");
lines.push("```");
lines.push(`node scripts/msh-evidence.mjs ${BASE} ${OUT}`);
lines.push("```");
lines.push("");
lines.push("The screenshots in `" + OUT + "/` are the pixels. The chrome, task, hierarchy and");
lines.push("preservation numbers are read from the same rendered page, at the same widths.");
lines.push("");

writeFileSync(path.join(OUT, "MSH-EVIDENCE.md"), lines.join("\n"));
console.log(`\n  · record written to ${path.join(OUT, "MSH-EVIDENCE.md")}`);

await page.close();
await close();
