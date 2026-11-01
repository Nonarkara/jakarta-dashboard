// Touch-emulated tap targets at 390 — pointer:coarse media rules now apply.
import { chromium } from "/Users/nonarkara/Projects/dashboards/HCMC/node_modules/playwright/index.mjs";
import { writeFileSync, existsSync } from "node:fs";

const BASE = "https://jakarta.nonarkara.org";
const CHROME = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(p => p && existsSync(p));
const ROUTES = [["dashboard", "/"], ["atlas", "/atlas"], ["atlas-waterways", "/atlas?lens=waterways"], ["research", "/research"]];

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
const out = {};
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  for (const [name, p] of ROUTES) {
    await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(name.includes("atlas") ? 12000 : 8000);
    out[name] = await page.evaluate(() => {
      const rows = [];
      for (const el of document.querySelectorAll("button, input, select, textarea, a[href], summary")) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const isControl = el.matches("button, input, select, textarea");
        if (r.height < 32) rows.push({ tag: el.tagName.toLowerCase(), h: Math.round(r.height), text: (el.textContent || el.value || "").trim().slice(0, 26), isControl, pointer: cs.pointerEvents });
      }
      // dedupe by tag+text
      const seen = new Set();
      const uniq = rows.filter(r => { const k = r.tag + "|" + r.text + "|" + r.h; if (seen.has(k)) return false; seen.add(k); return true; });
      return { under32: uniq.length, controlsUnder32: uniq.filter(r => r.isControl).length, list: uniq };
    });
  }
} finally { await browser.close().catch(() => {}); }
writeFileSync("probe-touch.json", JSON.stringify(out, null, 2));
console.log("TOUCH PROBE DONE");
