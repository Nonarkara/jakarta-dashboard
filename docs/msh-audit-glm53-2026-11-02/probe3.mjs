#!/usr/bin/env node
/** Probe 3: switch theme through the real user path (Kontrol drawer -> Tampilan select). */
import { chromium } from "/Users/nonarkara/Projects/dashboards/HCMC/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CHROME = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync);
const profile = mkdtempSync(path.join(tmpdir(), "msh-probe3-"));
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
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("https://jakarta.nonarkara.org/", { waitUntil: "load" }).catch(() => {});
await page.waitForTimeout(5000);

const before = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, bodyBg: getComputedStyle(document.body).backgroundColor, h2: getComputedStyle(document.querySelector("h2")).color }));
// open the Kontrol drawer like a user, then choose Tampilan -> Terang kota
await page.click("details.city-controls > summary");
await page.waitForTimeout(400);
await page.selectOption("#atlas-theme", "light");
await page.waitForTimeout(3000);
const after = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, bodyBg: getComputedStyle(document.body).backgroundColor, h2: getComputedStyle(document.querySelector("h2")).color, selectVal: document.querySelector("#atlas-theme").value }));
await page.screenshot({ path: "docs/msh-audit-glm53-2026-11-02/theme-light-userpath-390.png", timeout: 60000 });
await page.selectOption("#atlas-theme", "contrast");
await page.waitForTimeout(3000);
const afterC = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, bodyBg: getComputedStyle(document.body).backgroundColor, h2: getComputedStyle(document.querySelector("h2")).color, selectVal: document.querySelector("#atlas-theme").value }));
await page.screenshot({ path: "docs/msh-audit-glm53-2026-11-02/theme-contrast-userpath-390.png", timeout: 60000 });
console.log(JSON.stringify({ before, afterLight: after, afterContrast: afterC }, null, 2));
await page.close(); await browser.close(); try { child.kill("SIGKILL"); } catch {} rmSync(profile, { recursive: true, force: true });
