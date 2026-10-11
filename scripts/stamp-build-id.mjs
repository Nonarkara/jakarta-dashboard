#!/usr/bin/env node
// Stamps the asset-cache-buster version into public/index.html so the
// dashboard's iframe (and any browser caching the atlas URL) always pulls
// the latest app.js / style.css after a deploy. Also writes the build tag
// into public/app.js so the atlas can broadcast its identity to the
// dashboard's iframe parent via postMessage.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexHtml = join(__dirname, "..", "public", "index.html");
const appJs = join(__dirname, "..", "public", "app.js");

let sha = "local";
try {
  sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {}

const now = new Date();
const stamp = `jakarta-atlas-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}-${Math.floor(now.getTime() / 1000)}-${sha}`;

const html = readFileSync(indexHtml, "utf8");
const nextHtml = html
  .replace(/src="\/(translations|i18n)\.js(?:\?v=[^"]*)?"/g, (_, file) => `src="/${file}.js?v=${stamp}"`)
  .replace(/src="\/loader\.js(?:\?v=[^"]*)?"/g, `src="/loader.js?v=${stamp}"`)
  .replace(/href="\/style\.css\?v=[^"]*"/g, `href="/style.css?v=${stamp}"`)
  .replace(/src="\/theme\.js\?v=[^"]*"/g, `src="/theme.js?v=${stamp}"`)
  .replace(/data-app="\/app\.js\?v=[^"]*"/g, `data-app="/app.js?v=${stamp}"`);

writeFileSync(indexHtml, nextHtml.replace(/href="\/jakarta-design\.css\?v=[^"]*"/g, `href="/jakarta-design.css?v=${stamp}"`), "utf8");

const js = readFileSync(appJs, "utf8");
const nextJs = js.replace(
  /const ATLAS_BUILD_TAG = "[^"]*";/,
  `const ATLAS_BUILD_TAG = "${stamp}";`,
);
writeFileSync(appJs, nextJs, "utf8");

console.log(`[stamp-build-id] wrote ${stamp} into index.html and app.js`);
const dashboardHtml = join(__dirname, '..', 'public', 'dashboard.html');
const dashboardJs = join(__dirname, '..', 'public', 'dashboard.js');
writeFileSync(dashboardHtml, readFileSync(dashboardHtml, 'utf8').replace(/(dashboard\.css|dashboard\.js|theme\.js|jakarta-design\.css)\?v=[^" ]*/g, '$1?v=' + stamp));
writeFileSync(dashboardJs, readFileSync(dashboardJs, 'utf8').replace(/const DASHBOARD_BUILD = '[^']*';/, "const DASHBOARD_BUILD = '" + stamp + "';"));
