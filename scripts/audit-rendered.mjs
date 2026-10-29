#!/usr/bin/env node
// Rendered-page anti-slop audit.
//
// The guards in scripts/test-anti-slop-design.mjs read source. This one reads
// the page a human actually sees, at three widths, on the deployed site. It
// exists because the strongest defects in this project were never visible in a
// stylesheet: a fixed panel trapped by an ancestor's containing block, a
// controls row that rendered correctly and swallowed every click, a chart
// whose bars were all 0.4% of a 500px track and could not be compared.
//
// Playwright is not a dependency of this repository and must not become one.
// It is loaded from the sanctioned sibling checkout. If it is not there this
// FAILS LOUDLY — it never quietly skips, because a gate that silently passes
// when it cannot run is the exact defect class this file exists to catch.
//
// Usage:
//   ATLAS_URL=https://jakarta.nonarkara.org node scripts/audit-rendered.mjs
//   SHOT_DIR=docs/receipts node scripts/audit-rendered.mjs

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import {auditStatusClock} from './status-clock-browser-audit.mjs';
import {auditRefusalSessions} from './refusal-session-audit.mjs';
import {panelReadiness} from './panel-readiness.mjs';

const BASE = process.env.ATLAS_URL || 'https://jakarta.nonarkara.org';
const SHOTS = process.env.SHOT_DIR || '';
const PLAYWRIGHT = process.env.PLAYWRIGHT_PATH || '/Users/nonarkara/Projects/dashboards/HCMC/node_modules/playwright/index.mjs';
const CDP = process.env.CHROME_CDP || 'http://127.0.0.1:9656';

let chromium;
try {
  ({ chromium } = await import(PLAYWRIGHT));
} catch (e) {
  console.error(`FATAL: cannot load Playwright from ${PLAYWRIGHT}.\n` +
    `The rendered audit cannot run, and it will not report success without running.\n` +
    `Set PLAYWRIGHT_PATH to a Playwright 1.64+ install. (${e.message})`);
  process.exit(2);
}

// One shared browser, per the standing rule. Attach to the running instance;
// start it only if nobody holds the port.
let browser;
try {
  browser = await chromium.connectOverCDP(CDP);
} catch {
  const { spawn } = await import('node:child_process');
  const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const child = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${new URL(CDP).port}`,
    `--user-data-dir=/tmp/one-shared-chrome-${new URL(CDP).port}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'],
    { detached: true, stdio: 'ignore' });
  child.unref();
  for (let i = 0; i < 40 && !browser; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try { browser = await chromium.connectOverCDP(CDP); } catch { /* not up yet */ }
  }
  if (!browser) { console.error(`FATAL: no Chrome at ${CDP} and it would not start. The audit cannot run.`); process.exit(2); }
}

if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const record = (where, name, ok, detail) => { results.push({ where, name, ok, detail }); };

// Everything below runs inside the page.
const AUDIT = () => {
  const out = { overflow: null, mapShare: null, boxes: [], measure: [], hittable: [], charts: [], cropped: [], mathsOverlap: [], errors: [] };
  out.overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;

  // ── The chrome band fits its controls. A band that is shorter than what it
  // holds does not push the control away — it CROPS it, and a control cropped
  // at the top of the page is cropped by the top of the document. The atlas's
  // header row is 28px with 2px of padding, so its content box is 24px; the
  // language select was 30px, and it sat 1.5px above the top of the page. The
  // spatial gate cannot see this: it measures the atlas inside an iframe,
  // where the atlas hides its own header, so the gate never measured the
  // band at all. This reads the rendered page.
  //
  // The check is installed on the window, not written inline, so the mutation
  // below can call THE SAME function. A mutation that proves a copy of the
  // check bites proves nothing about the check.
  window.__SL_CROPPED__ = () => {
    const found = [];
    for (const band of document.querySelectorAll('.atlas-header, .atlas-lenses')) {
      const br = band.getBoundingClientRect();
      if (!br.height) continue;
      for (const el of band.querySelectorAll('a,button,input,select,textarea,summary')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        // Only the band's OWN row. A control that STARTS below the band is a
        // panel that hangs off it (the Controls menu), not something the band
        // was supposed to hold.
        if (r.top >= br.bottom - 0.5) continue;
        const above = +(br.top - r.top).toFixed(1);
        const below = +(r.bottom - br.bottom).toFixed(1);
        if (above > 0.5 || below > 0.5) {
          found.push({
            band: (band.className || band.tagName).toString().split(' ')[0],
            name: (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')),
            above, below,
          });
        }
      }
    }
    return found;
  };
  out.cropped = window.__SL_CROPPED__();

  // Multiple method paragraphs must occupy separate rows. A source-only
  // grid check missed three paragraphs explicitly placed into row2.
  window.__SL_MATHS_OVERLAP__ = () => {
    const found=[];
    for(const article of document.querySelectorAll('.maths article')) {
      const paragraphs=[...article.querySelectorAll('p')].map(p=>({text:p.textContent.trim().slice(0,45),r:p.getBoundingClientRect()})).filter(p=>p.r.width&&p.r.height);
      for(let i=0;i<paragraphs.length;i++)for(let j=i+1;j<paragraphs.length;j++) {
        const a=paragraphs[i],b=paragraphs[j];
        if(Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>1&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>1)found.push({title:article.querySelector('h3')?.textContent.trim(),a:a.text,b:b.text});
      }
    }
    return found;
  };
  out.mathsOverlap=window.__SL_MATHS_OVERLAP__();


  const map = document.querySelector('.maplibregl-map');
  if (map) {
    const r = map.getBoundingClientRect();
    out.mapShare = +(((r.width * r.height) / (innerWidth * innerHeight)) * 100).toFixed(1);
  }

  // ── Hittability. A control that renders and cannot be clicked is not a
  // control. Hit-test each page-level door at its own centre.
  for (const el of document.querySelectorAll('.atlas-page-tools > *, .atlas-layers > details > summary')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const label = (el.tagName === 'SUMMARY' || el.classList.contains('atlas-embedded-drawer') || el.classList.contains('atlas-watch')
      ? (el.querySelector('summary')?.textContent || el.textContent)
      : el.textContent) || el.className;
    out.hittable.push({
      name: label.trim().replace(/\s+/g, ' ').slice(0, 28),
      top: hit === el || el.contains(hit),
      coveredBy: hit && !(hit === el || el.contains(hit)) ? (hit.tagName + '.' + (hit.className || '')).slice(0, 40) : null,
    });
  }

  // ── Boxes fit their content. The law allows 0.5–1.5x line height of
  // padding. An element whose height is a graphic is not measured here: a bar
  // chart row is legitimately taller than the text sitting in it.
  const GRAPHIC = 'canvas,svg,img,video,i.meter,.meter';
  for (const el of document.querySelectorAll('body *')) {
    if (el.matches(GRAPHIC) || el.querySelector(GRAPHIC)) continue;
    const cs = getComputedStyle(el);
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const text = el.textContent.trim();
    if (!text || text.length > 400) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 4) continue;
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    const lines = el.getClientRects().length || 1;
    const budget = 1.5 * lh;
    if (pad > budget) {
      out.boxes.push({
        name: el.tagName + '.' + (el.className || '').toString().slice(0, 30),
        text: text.slice(0, 30), pad: Math.round(pad), budget: Math.round(budget), lines,
        h: Math.round(r.height),
      });
    }
  }

  // ── Reading measure, in real characters. `ch` is the advance of "0", not the
  // mean advance, so a CSS max-width cannot be trusted; count what is drawn.
  for (const p of document.querySelectorAll('p, li')) {
    const cs = getComputedStyle(p);
    const r = p.getBoundingClientRect();
    if (r.width < 200 || r.height < 10) continue;
    if (p.closest('table,.table,.bars,.formula,.pipe,.legend')) continue;
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:' + cs.font;
    probe.textContent = 'abcdefghijklmnopqrstuvwxyz';
    document.body.append(probe);
    const avg = probe.getBoundingClientRect().width / 26;
    probe.remove();
    const chars = Math.round(r.width / avg);
    if (chars > 78) out.measure.push({ name: p.className || p.tagName, chars, w: Math.round(r.width) });
  }

  // ── Charts must encode something. A bar whose drawn length does not track
  // its own stated share is a picture of a chart. Compare the painted width to
  // the number printed beside it — checking only that a bar exists lets every
  // bar be drawn at 100% forever.
  for (const host of document.querySelectorAll('.bars')) {
    const rows = [...host.querySelectorAll('.row')].map((row) => {
      const meter = row.querySelector('.meter');
      const fill = row.querySelector('.meter i');
      const stated = parseFloat(row.dataset.share);           // the value, not its rendering
      const mw = meter ? meter.getBoundingClientRect().width : 0;
      const fw = fill ? fill.getBoundingClientRect().width : 0;
      return {
        label: (row.querySelector('.name')?.textContent || '').slice(0, 30),
        stated: Number.isFinite(stated) ? +(stated * 100).toFixed(2) : null,
        drawn: mw > 0 && fill ? +((100 * fw) / mw).toFixed(2) : null,
      };
    });
    if (!rows.length) continue;
    const liar = rows.filter((r) => r.drawn === null || !Number.isFinite(r.stated) || Math.abs(r.drawn - r.stated) > 0.6);
    const sum = +rows.reduce((a, r) => a + (r.stated || 0), 0).toFixed(1);
    out.charts.push({
      id: host.id, rows, liars: liar.map((r) => `${r.label}: states ${r.stated}% but draws ${r.drawn}%`),
      sum, sumOk: Math.abs(sum - 100) <= 1.0,
    });
  }
  return out;
};

const VIEWPORTS = [[1440, 900, false], [1024, 768, false], [390, 844, true]];
const PAGES = [['/atlas', 'atlas'], ['/research', 'research']];

for (const [path, label] of PAGES) {
  for (const [w, h, isMobile] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile, hasTouch: isMobile });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => record(label, 'page error', false, String(e).slice(0, 100)));
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(3500);

    // The loading veil sits above every control. While it is up, a hit-test
    // failure means nothing — the page simply is not interactive yet. Wait for
    // it to lift, and if it never does, say so once and skip the hit-tests
    // rather than reporting three controls as broken.
    let veilLifted = true;
    if (label === 'atlas') {
      try {
        await page.waitForFunction(() => {
          const v = document.getElementById('atlas-map-loading');
          return !v || v.offsetParent === null || getComputedStyle(v).display === 'none';
        }, null, { timeout: 20000 });
      } catch { veilLifted = false; }
    }

    const a = await page.evaluate(AUDIT);
    const where = `${label}@${w}`;

    record(where, 'no horizontal overflow', !a.overflow, a.overflow ? `scrollWidth exceeds clientWidth by ${a.overflow}px` : 'none');
    if(label==='research') {
      record(where,'method paragraphs do not overlap',a.mathsOverlap.length===0,JSON.stringify(a.mathsOverlap));
      const bite=await page.evaluate(()=>{
        const before=window.__SL_MATHS_OVERLAP__().length,style=document.createElement('style');
        style.textContent='.maths article.budget-method{display:grid!important;grid-template-columns:minmax(0,24ch) minmax(0,65ch)!important}.budget-method-copy{display:contents!important}.maths article > p:not(.formula),.budget-method-copy > p{grid-column:2!important;grid-row:2!important}';document.head.append(style);
        const after=window.__SL_MATHS_OVERLAP__().length;style.remove();return {before,after};
      });
      record(where,'method overlap check bites',bite.before===0&&bite.after>0,JSON.stringify(bite));
    }

    for (const c of a.cropped) {
      record(where, `the ${c.band} band fits its controls: ${c.name}`, false,
        `${c.name} sticks ${c.above > 0 ? c.above + 'px above' : ''}${c.above > 0 && c.below > 0 ? ' and ' : ''}${c.below > 0 ? c.below + 'px below' : ''} the band that holds it`);
    }
    if (!veilLifted) {
      record(where, 'the map finishes loading', false, 'the loading veil never lifted; hit-tests skipped because nothing was interactive');
      await ctx.close();
      continue;
    }

    // ── THE CHECK MUST BITE. An assertion nobody has seen fail is decoration,
    // so the band check is put to the test on this very page: the page is put
    // back the way it SHIPPED — a fixed 28px header row and a 40px language
    // control in a 24px content box — and the SAME check has to report the
    // crop. If the answer does not change, the check is blind and the audit
    // fails saying so.
    //
    // The mutation has to restore the defect, not merely change the page: the
    // band now grows to fit its controls, so making the control taller on its
    // own changes nothing. The shipped page is what has to come back.
    const bite = await page.evaluate(() => {
      const sel = document.querySelector('.atlas-header .atlas-theme-control select');
      if (!sel || typeof window.__SL_CROPPED__ !== 'function') return { skipped: true };
      const pick = (list) => list.find((c) => c.name === '#atlas-language') || null;
      const before = pick(window.__SL_CROPPED__());
      const style = document.createElement('style');
      style.textContent = `
        body.atlas-workbench .atlas-page { grid-template-rows: 28px 26px minmax(0,1fr) !important; }
        .atlas-header .atlas-theme-control select { min-height:40px !important; }
      `;
      document.head.append(style);
      const after = pick(window.__SL_CROPPED__());
      style.remove();
      return {
        skipped: false,
        beforeAbove: before ? before.above : 0,
        afterAbove: after ? after.above : 0,
      };
    });
    if (bite.skipped) {
      record(where, 'the band check bites', true, 'this page has no atlas header band to test');
    } else {
      record(where, 'the band check bites', bite.afterAbove > bite.beforeAbove,
        bite.afterAbove > bite.beforeAbove
          ? `the page as it shipped (a fixed 28px row, a 40px control) was reported ${bite.beforeAbove}px above the band before and ${bite.afterAbove}px after`
          : `the page as it shipped was not reported (${bite.beforeAbove}px above before, ${bite.afterAbove}px after) — the check is blind`);
    }
    if (label === 'atlas' && w >= 1024) {
      record(where, 'the map keeps the viewport', a.mapShare !== null && a.mapShare >= 60,
        a.mapShare === null ? 'no map element' : `${a.mapShare}% of the viewport`);
    }
    for (const t of a.hittable) record(where, `"${t.name}" is clickable`, t.top, t.coveredBy ? `covered by ${t.coveredBy}` : '');
    for (const b of a.boxes) record(where, `box fits its text: ${b.name}`, false, `"${b.text}" has ${b.pad}px padding against a ${b.budget}px budget (${b.lines} lines, ${b.h}px tall)`);
    for (const m of a.measure) record(where, `reading measure: ${m.name}`, false, `${m.chars} characters across ${m.w}px`);
    for (const c of a.charts) {
      record(where, `chart "${c.id}" draws its own numbers`, c.liars.length === 0,
        c.liars.length ? c.liars.join('; ') : `${c.rows.length} rows, each bar length matches its stated share`);
      record(where, `chart "${c.id}" shares sum to one whole`, c.sumOk, `stated shares sum to ${c.sum}%`);
    }

    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}-${w}.png` });
    await ctx.close();
  }
}

// ── THE LENS DEEP LINK, AS IT ARRIVES.
//
// `/atlas?lens=waterways` is the URL the water-recovery receipt publishes and
// the atlas's own share link for the water lens. Before this pass the water
// lens never opened its own evidence: the count, the legend, the budget and
// the retry chip were all sealed inside a closed <details>, so that link
// landed on a map and nothing else. This audit never saw it either — it
// audited `/atlas`, which opens on the city lens.
//
// Nothing below opens anything by hand. The state measured is the state a
// reader gets from the link.
const LENS_AUDIT = () => {
  const out = { open: false, title: '', titleVisible: false, adjacent: false, between: -1, emptyLegendSpace: 0, legend: '', slabs: [], controls: 0 };
  const ev = document.getElementById('atlas-lens-evidence');
  out.open = !!(ev && ev.open);
  const title = document.getElementById('atlas-lens-title');
  out.title = (title?.textContent || '').trim();
  out.titleVisible = !!title && title.getClientRects().length > 0;
  const body = document.getElementById('atlas-lens-body');
  const legend = body?.querySelector(':scope > p.water-legend');
  const summary = body?.querySelector(':scope > p[role="status"]');
  out.legend = (legend?.textContent || '').trim();
  if (legend && summary && body) {
    const kids = [...body.children];
    const li = kids.indexOf(legend), si = kids.indexOf(summary);
    out.adjacent = si >= 0 && li === si + 1;
    out.between = si >= 0 && li >= 0 ? li - si - 1 : -1;
  }
  // An empty paragraph has NO BOX — but it still claims its margins, and a
  // legend that says nothing while holding 26px of panel is the row of dashes
  // that occupies space without saying anything. Measure the space it takes,
  // not the height of a box that was never there.
  if (legend && !out.legend) {
    const cs = getComputedStyle(legend);
    const lr = legend.getBoundingClientRect();
    out.emptyLegendSpace = cs.display === 'none' ? 0
      : Math.round(lr.height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0));
  }
  // The controls, behind their disclosures. A control in a collapsed section is
  // not on screen, so it is not measured, so it is not ruled on: the traffic
  // panel's three action buttons are 44px slabs round a 16px line, and they
  // live inside collapsed sections. MSH: a box is its label plus padding —
  // more than 2.5x its own text is spatial hallucination.
  for (const e of document.querySelectorAll('#atlas-lens-body button, #atlas-lens-body summary')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    out.controls++;
    if (typeof e.checkVisibility === 'function' && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) continue;
    const rg = document.createRange(); rg.selectNodeContents(e);
    const t = rg.getBoundingClientRect(); if (!t.height) continue;
    if (r.height > t.height * 2.5 + 1 && r.height > 40) {
      out.slabs.push(`${(e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)} is ${Math.round(r.height)}px tall round a ${Math.round(t.height)}px line`);
    }
  }
  return out;
};

const REFUSAL_AUDIT = () => {
  const text = document.getElementById('atlas-lens-body')?.innerText || '';
  const reason=[...document.querySelectorAll('#atlas-lens-body p')].find(p=>/rate limited|permintaan dibatasi/i.test(p.textContent));
  const reasonLines=reason?reason.getBoundingClientRect().height/parseFloat(getComputedStyle(reason).lineHeight):Infinity;
  return {reasonLines,refused:/rate limited|permintaan dibatasi/i.test(text),window:/\b47\b/.test(text),
    claimsLevels:/current levels|without a usable level|kept as dated evidence/i.test(text),
    width:document.documentElement.scrollWidth};
};
for (const [w, h] of [[1440, 900], [1024, 768], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const where = `atlas-refusal@${w}`;
  page.on('pageerror', (e) => record(where, 'page error', false, String(e).slice(0, 100)));
  await page.route('**/api/**', route => route.fulfill({status:429,
    headers:{'content-type':'application/json','retry-after':'47'},
    body:JSON.stringify({error:'Too many requests',retryAfterSeconds:47})}));
  await page.goto(BASE + '/atlas?lens=waterways&lang=en', {waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForSelector('#atlas-lens-evidence', {timeout:30000});
  await page.evaluate(() => { document.getElementById('atlas-lens-evidence').open=true; });
  const ready=await page.evaluate(panelReadiness,{expand:true,timeoutMs:45000});
  record(where,'refused panel reaches a terminal state',ready.ready,JSON.stringify(ready));
  const panel=await page.evaluate(REFUSAL_AUDIT);
  record(where,'a refused request is stated as rate limited',panel.refused,'explicit request state');
  record(where,'the refusal names the retry window',panel.window,'47 seconds');
  record(where,'a refusal prints no count of levels',!panel.claimsLevels,'no invented gauge count');
  record(where,'refusal stays within three reading lines',panel.reasonLines<=3.1,`${panel.reasonLines} lines`);
  record(where,'refusal fits viewport',panel.width===w,`${panel.width}/${w}`);
  if(SHOTS)await page.screenshot({path:`${SHOTS}/atlas-refusal-${w}.png`});
  // Restore the discarded wordy reason on this local browser fixture. The same
  // three-line budget must reject the extra reading cost without shrinking type.
  await page.evaluate(() => {const p=[...document.querySelectorAll('#atlas-lens-body p')].find(n=>/rate limited|permintaan dibatasi/i.test(n.textContent));p.dataset.original=p.textContent;p.textContent='Request rate limited. This address sent too many requests, so the server refused this one. Nothing was measured and nothing is missing — the same reading can be fetched again in about 47 seconds.';});
  const wordy=await page.evaluate(REFUSAL_AUDIT);
  record(where,'refusal reading budget bites',wordy.reasonLines>3.1,`${wordy.reasonLines} old-copy lines`);
  await page.evaluate(() => {const p=document.querySelector('[data-original]');p.textContent=p.dataset.original;delete p.dataset.original;});
  // Inject the old false claim into this refused fixture; the same checker must see it.
  await page.evaluate(() => { const p=document.createElement('p');p.id='refusal-mutant';p.textContent='0 current levels · 58 without a usable level';document.getElementById('atlas-lens-body').append(p); });
  const mutated=await page.evaluate(REFUSAL_AUDIT);
  record(where,'refusal claim detector bites',mutated.claimsLevels,'injected false gauge count detected');
  await page.evaluate(() => document.getElementById('refusal-mutant').remove());
  await ctx.close();
}

for (const [w, h] of [[1440, 900], [1024, 768]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const where = `atlas-waterways@${w}`;
  page.on('pageerror', (e) => record(where, 'page error', false, String(e).slice(0, 100)));
  await page.goto(BASE + '/atlas?lens=waterways', { waitUntil: 'networkidle', timeout: 90000 });
  // The panel opens when the lens is chosen and the legend fills when the
  // mapped reference arrives. Wait for both, then measure what arrived.
  await page.waitForFunction(() => document.getElementById('atlas-lens-evidence')?.open === true, null, { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => { const l = document.querySelector('#atlas-lens-body > p.water-legend'); return l && l.textContent.trim().length > 0; }, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
  // The check is installed on the window from ITS OWN SOURCE, so the mutation
  // below calls THE SAME function. A mutation that proves a copy of the check
  // bites proves nothing about the check.
  await page.evaluate(`void (window.__SL_LENS__ = ${LENS_AUDIT.toString()})`);
  const ready = await page.evaluate(panelReadiness,{expand:true});
  record(where,'expanded controls finish loading',ready.ready,JSON.stringify(ready));
  const lens = await page.evaluate(() => window.__SL_LENS__());

  record(where, 'the deep link opens its own evidence', lens.open,
    lens.open ? 'the panel is open on arrival' : 'the lens arrived with its evidence folded shut');
  record(where, 'the lens states what it is', lens.title.length > 0 && lens.titleVisible,
    lens.titleVisible ? lens.title : 'the lens title is not painted');
  record(where, "the legend is the count's own breakdown", lens.adjacent,
    lens.adjacent ? 'directly under the count it explains' : `${lens.between} elements sit between the count and its legend`);
  record(where, 'the legend never holds a line of nothing', lens.emptyLegendSpace === 0,
    `an empty legend occupies ${lens.emptyLegendSpace}px`);
  record(where, 'no panel control is a slab', lens.slabs.length === 0,
    lens.slabs.length ? lens.slabs.join('; ') : `${lens.controls} panel controls measured behind their disclosures, none bigger than its own text`);

  // ── THE CHECKS MUST BITE. The same function is called on a page put back
  // into each defect: the panel closed, the legend in its shipped place below
  // four unrelated sections, the legend holding a line of nothing.
  const bite = await page.evaluate(() => {
    const out = { skipped: true };
    const ev = document.getElementById('atlas-lens-evidence');
    const body = document.getElementById('atlas-lens-body');
    const legend = body?.querySelector(':scope > p.water-legend');
    const summary = body?.querySelector(':scope > p[role="status"]');
    if (!ev || !legend || !summary || typeof window.__SL_LENS__ !== 'function') return out;
    out.skipped = false;
    const wasOpen = ev.open;
    ev.open = false;
    out.closed = window.__SL_LENS__();
    ev.open = wasOpen;
    const firstDetails = body.querySelector('details');
    if (firstDetails) {
      body.insertBefore(legend, firstDetails.nextSibling);
      out.orphan = window.__SL_LENS__();
      body.insertBefore(legend, summary.nextSibling);
    }
    const text = legend.textContent;
    legend.textContent = '';
    legend.hidden = false;
    out.empty = window.__SL_LENS__();
    legend.textContent = text;
    legend.hidden = false;
    // and a control put back into the SHAPE of the defect: a box more than
    // 2.5x its own text. The 44px floor was one instance of that shape; the
    // rule is about the shape, so the mutation restores the shape — a fixed
    // 44px would only bite on a one-line label, and this panel's labels are
    // all two lines wide, so a fixed height would have found nothing and
    // reported the check as blind.
    let slabbed = null;
    for (const e of body.querySelectorAll('button, summary')) {
      const rg = document.createRange(); rg.selectNodeContents(e);
      const t = rg.getBoundingClientRect();
      if (!t.height) continue;
      const before = e.style.minHeight;
      e.style.minHeight = Math.ceil(t.height * 2.6) + 2 + 'px';
      const after = window.__SL_LENS__();
      e.style.minHeight = before;
      if (after.slabs.length > 0) { slabbed = { before, after }; break; }
    }
    out.slabbed = slabbed;
    return out;
  });
  if (bite.skipped) {
    record(where, 'the lens checks bite', false, 'the lens page carried no panel, legend or count to test');
  } else {
    record(where, 'the panel check bites', bite.closed && bite.closed.open === false && lens.open,
      bite.closed && bite.closed.open === false ? 'closing the panel was reported' : 'closing the panel changed nothing — the check is blind');
    record(where, 'the legend-adjacency check bites', bite.orphan && bite.orphan.adjacent === false && lens.adjacent,
      bite.orphan && bite.orphan.adjacent === false ? `the legend in its shipped place left ${bite.orphan.between} elements between it and the count` : 'moving the legend changed nothing — the check is blind');
    record(where, 'the empty-legend check bites', bite.empty && bite.empty.emptyLegendSpace > 0 && lens.emptyLegendSpace === 0,
      bite.empty && bite.empty.emptyLegendSpace > 0 ? `an empty legend was measured at ${bite.empty.emptyLegendSpace}px` : 'an empty legend measured 0px — the check is blind');
    record(where, 'the slab check bites', !!bite.slabbed && bite.slabbed.after.slabs.length > 0 && lens.slabs.length === 0,
      bite.slabbed && bite.slabbed.after.slabs.length > 0
        ? `a control put back into the shape of the defect was reported: ${bite.slabbed.after.slabs[0]}`
        : 'a control stretched past its own text was not reported — the check is blind');
  }

  if (SHOTS) await page.screenshot({ path: `${SHOTS}/atlas-waterways-${w}.png` });
  await ctx.close();
}


// All panel lenses share the size law. Reuse the loaded map at each width:
// the broader control sweep does not repeat the full spatial instrument.
for(const width of [1440,390]){
 const ctx=await browser.newContext({viewport:{width,height:900},hasTouch:width<700});
 const page=await ctx.newPage();
 await page.goto(BASE+'/atlas?lang=en&lens=traffic',{waitUntil:'load',timeout:90000});
 const lenses=await page.locator('.atlas-lenses > button[data-lens]').evaluateAll(nodes=>nodes.map(n=>n.dataset.lens).filter(l=>['city','air','rain','haze','green','waterways','exposure','arrival','confidence','traffic','coverage'].includes(l)));
 record('panel-controls@'+width,'all eleven panel lenses are present',new Set(lenses).size===11,lenses.join(', '));
 for(const lens of lenses){
  const where=`controls-${lens}@${width}`;
  await page.locator('.atlas-lenses > button[data-lens="'+lens+'"]').click();
  await page.locator('#atlas-lens-evidence > summary').evaluate(e=>{if(!e.parentElement.open)e.click();});
  const ready=await page.evaluate(panelReadiness,{expand:true});
  record(where,'expanded controls finish loading',ready.ready,JSON.stringify(ready));
  const measured=await page.evaluate(LENS_AUDIT);
  record(where,'no panel control is a slab',measured.slabs.length===0,measured.slabs.length?measured.slabs.join('; '):`${measured.controls} controls behind settled disclosures`);
  console.log('  '+(ready.ready&&!measured.slabs.length?'PASS ':'FAIL ')+where+' · '+measured.controls+' controls');
  if(width===1440&&lens==='traffic'){
   // Prove the asynchronous expansion reaches a control which did not exist
   // when its parent first opened. This also catches one-pass expansion.
   await page.evaluate(()=>{
    const body=document.getElementById('atlas-lens-body'),fixture=document.createElement('details');fixture.id='audit-lazy-control';
    fixture.innerHTML='<summary>Delayed disclosure test</summary>';
    fixture.addEventListener('toggle',()=>{if(!fixture.open||fixture.dataset.started)return;fixture.dataset.started='true';fixture.setAttribute('aria-busy','true');setTimeout(()=>{
     const nested=document.createElement('details');nested.innerHTML='<summary>Nested disclosure test</summary>';
     nested.addEventListener('toggle',()=>{if(!nested.open||nested.dataset.started)return;nested.dataset.started='true';const b=document.createElement('button');b.textContent='Delayed oversized control';b.style.cssText='min-height:80px;font-size:12px;line-height:16px';nested.append(b);fixture.setAttribute('aria-busy','false');});fixture.append(nested);
    },200);});body.append(fixture);
   });
   const waited=await page.evaluate(panelReadiness,{expand:true});
   const measured=await page.evaluate(LENS_AUDIT);
   record(where,'lazy nested-control check bites',waited.ready&&waited.opened>=2&&measured.slabs.some(s=>s.includes('Delayed oversized control')),JSON.stringify({waited,slabs:measured.slabs}));
   await page.locator('#audit-lazy-control').evaluate(e=>e.remove());
  }
 }
 await ctx.close();
}

await auditRefusalSessions(browser,BASE);
record('refusal sessions','Research/haze recovery and independent feeds',true,'actual controllers, current synthetic fixtures, EN/ID and no page errors');
await auditStatusClock(browser,BASE);
record('source-clock','time-driven evidence and accessible stable status',true,'controlled real page, no clock-driven status writes, expiry, unavailable feeds and reachable zones');
await browser.close();

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  if (!r.ok) console.log(`  FAIL  ${r.where}  ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
}
console.log(`\nrendered audit: ${results.length - failed.length}/${results.length} passed against ${BASE}`);
if (failed.length) { console.log(`${failed.length} rendered defect(s). Bytes are not pixels.`); process.exit(1); }