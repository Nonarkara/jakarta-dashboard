#!/usr/bin/env node
/** Follow-up probe 2: edge-parked button, research table scrollability, chip wrap zoom,
 *  lens-row spacing, light/contrast themes. GLM-5.3-Flash audit, 2026-11-02. */
import { chromium } from "/Users/nonarkara/Projects/dashboards/HCMC/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = "https://jakarta.nonarkara.org";
const OUT = process.argv[2] || ".";
mkdirSync(OUT, { recursive: true });

const CHROME = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync);
const profile = mkdtempSync(path.join(tmpdir(), "msh-probe2-"));
const child = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run",
  "--disable-extensions", "--hide-scrollbars", "--use-gl=angle", "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"],
  { stdio: ["ignore", "ignore", "ignore"] });
const portFile = path.join(profile, "DevToolsActivePort");
let port = null;
for (let i = 0; i < 60 && !port; i++) { await new Promise(r => setTimeout(r, 500)); try { port = Number(readFileSync(portFile, "utf8").split("\n")[0]) || null; } catch {} }
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const ctx = browser.contexts()[0] ?? (await browser.newContext());
const page = await ctx.newPage();
const out = {};

// ---------- 1. atlas @390: which button is past the edge?
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/atlas`, { waitUntil: "load" }).catch(() => {});
await page.waitForTimeout(7000);
out.atlasEdgeButtons = await page.evaluate(() => {
  const vw = innerWidth;
  const found = [];
  for (const el of document.querySelectorAll("button, a, summary")) {
    if (!el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      const cs = getComputedStyle(el);
      found.push({ sel: el.tagName.toLowerCase() + "." + String(el.className || "").split(" ").filter(Boolean).join("."), text: (el.textContent || "").trim().slice(0, 40), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), pos: cs.position, ariaLabel: el.getAttribute("aria-label") });
    }
  }
  return found;
});

// lens row spacing at 390
out.atlasLensRow = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")].filter(b => {
    const r = b.getBoundingClientRect(); return b.checkVisibility() && r.top >= 20 && r.top <= 60 && r.height > 0 && r.width > 0;
  }).map(b => ({ text: (b.textContent || "").trim().slice(0, 20), left: Math.round(b.getBoundingClientRect().left), right: Math.round(b.getBoundingClientRect().right), h: Math.round(b.getBoundingClientRect().height) }));
  const gaps = [];
  for (let i = 1; i < btns.length; i++) gaps.push(btns[i].left - btns[i - 1].right);
  return { count: btns.length, buttons: btns, gaps };
});

// ---------- 2. research @390: table past the edge — clipped or scrollable?
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/research`, { waitUntil: "load" }).catch(() => {});
await page.waitForTimeout(4000);
out.researchTable = await page.evaluate(() => {
  const table = document.querySelector("table");
  if (!table) return { present: false };
  const tr = table.getBoundingClientRect();
  // walk up to the scroll container
  let scroller = table.parentElement, sc = null;
  while (scroller && scroller !== document.body) {
    const cs = getComputedStyle(scroller);
    if (cs.overflowX === "auto" || cs.overflowX === "scroll" || cs.overflowX === "hidden") { sc = { sel: scroller.tagName.toLowerCase() + "." + String(scroller.className || "").split(" ").filter(Boolean)[0], overflowX: cs.overflowX, clientW: scroller.clientWidth, scrollW: scroller.scrollWidth, box: scroller.getBoundingClientRect() }; break; }
    scroller = scroller.parentElement;
  }
  return { present: true, tableW: Math.round(tr.width), tableRight: Math.round(tr.right), vw: innerWidth, scroller: sc ? { ...sc, boxTop: Math.round(sc.box.top), boxH: Math.round(sc.box.height) } : null, canScroll: sc ? sc.scrollW > sc.clientW + 1 : false };
});

// ---------- 3. dashboard @390: the bottom chip row ("Lompat cepat") wrap + zoom shot
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`, { waitUntil: "load" }).catch(() => {});
await page.waitForTimeout(6000);
out.chipRow = await page.evaluate(() => {
  const chips = [...document.querySelectorAll("button, summary, a")].filter(el => {
    const r = el.getBoundingClientRect(); return r.top > 700 && r.height > 0 && r.width > 0 && el.checkVisibility();
  }).map(el => {
    const r = el.getBoundingClientRect();
    const range = document.createRange(); let textW = 0;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) { range.selectNodeContents(n); textW += range.getBoundingClientRect().width; }
    const cs = getComputedStyle(el);
    return { sel: el.tagName.toLowerCase() + "." + String(el.className || "").split(" ").filter(Boolean)[0], text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40), boxW: Math.round(r.width), boxH: Math.round(r.height), textW: Math.round(textW), whiteSpace: cs.whiteSpace, fontSize: cs.fontSize, lineHeight: cs.lineHeight };
  });
  return chips;
});
await page.screenshot({ path: path.join(OUT, "zoom-chiprow-390.png"), clip: { x: 0, y: 770, width: 390, height: 74 }, timeout: 60000 });
await page.screenshot({ path: path.join(OUT, "zoom-masthead-390.png"), clip: { x: 0, y: 0, width: 390, height: 60 }, timeout: 60000 });

// ---------- 4. light + high-contrast themes on the dashboard (390 and 1440)
for (const [w, h] of [[390, 844], [1440, 900]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`${BASE}/`, { waitUntil: "load" }).catch(() => {});
  await page.waitForTimeout(4000);
  for (const theme of ["light", "contrast"]) {
    try {
      await page.evaluate((t) => {
        const s = document.querySelector("#atlas-theme");
        if (s) { s.value = t; s.dispatchEvent(new Event("change", { bubbles: true })); }
        document.documentElement.dataset.theme = t;
      }, theme);
      await page.waitForTimeout(2500);
      const probe = await page.evaluate(() => {
        const lum = (c) => { const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/); if (!m) return null; if (m[4] !== undefined && Number(m[4]) < 0.4) return null; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]); };
        const bgOf = (el) => { let e = el; while (e && e !== document.documentElement) { const c = lum(getComputedStyle(e).backgroundColor); if (c !== null) return c; e = e.parentElement; } return lum(getComputedStyle(document.body).backgroundColor); };
        const h2 = document.querySelector("h2");
        const ratios = {};
        if (h2) { const fg = lum(getComputedStyle(h2).color), bg = bgOf(h2); if (fg !== null && bg !== null) ratios.h2 = Math.round(((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)) * 100) / 100; }
        const body = document.querySelector("main p, main span");
        if (body) { const fg = lum(getComputedStyle(body).color), bg = bgOf(body); if (fg !== null && bg !== null) ratios.bodyText = Math.round(((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)) * 100) / 100; }
        return { theme: document.documentElement.dataset.theme, ratios };
      });
      await page.screenshot({ path: path.join(OUT, `theme-${theme}-${w}.png`), timeout: 60000 });
      out[`theme-${theme}-${w}`] = probe;
    } catch (e) { out[`theme-${theme}-${w}`] = { error: String(e.message || e).split("\n")[0] }; }
  }
}

await page.close(); await browser.close(); try { child.kill("SIGKILL"); } catch {}
rmSync(profile, { recursive: true, force: true });
writeFileSync(path.join(OUT, "probe2-raw.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 4200));
