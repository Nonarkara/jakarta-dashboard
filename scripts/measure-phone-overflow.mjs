// Measure horizontal overflow of the atlas shell and its open popup panels at a
// phone viewport, and name the widest offending node.
//
//   node scripts/measure-phone-overflow.mjs [url] [--menu] [--controls] [--out=path]
//
// Chrome on this machine runs as a single shared instance, so launching a second
// headless process silently attaches to nothing usable. This script therefore
// connects to an already-running debuggable Chrome (CDP_PORT, default 9656),
// opens one throwaway tab, measures it, and closes it again. It never touches the
// instance's existing tabs and writes nothing to the dashboard itself.

import { writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const url = args.find((a) => /^https?:\/\//.test(a)) ?? "https://jakarta.nonarkara.org/atlas";
const wantMenu = args.includes("--menu");
const wantControls = args.includes("--controls");
const wantNav = args.includes("--nav");
const outPath = args.find((a) => a.startsWith("--out="))?.slice("--out=".length);
const width = Number(args.find((a) => a.startsWith("--width="))?.slice(8) ?? 390);
const height = Number(args.find((a) => a.startsWith("--height="))?.slice(9) ?? 844);
const port = Number(process.env.CDP_PORT ?? 9656);

const base = `http://127.0.0.1:${port}`;
const version = await fetch(`${base}/json/version`).then((r) => r.json());
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener("open", res, { once: true });
  ws.addEventListener("error", () => rej(new Error(`cannot reach Chrome CDP on ${port}`)), { once: true });
});

let seq = 0;
const pending = new Map();
const events = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) {
    events.push(msg);
  }
});
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const call = (method, params) => send(method, params, sessionId);

const evaluate = async (expression) => {
  const r = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "evaluate failed");
  return r.result.value;
};

await call("Page.enable");
await call("Runtime.enable");
await call("Network.enable");
// Without this the browser reuses a cached stylesheet between runs and a
// before/after comparison silently measures the same bytes twice.
await call("Network.setCacheDisabled", { cacheDisabled: true });
await call("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 2,
  mobile: true,
});
await call("Page.navigate", { url });

// The map boots a WebGL canvas and PMTiles tiles; give the shell real time to lay
// out before measuring, otherwise the measurement catches an unloaded page.
await new Promise((r) => setTimeout(r, 12000));

if (wantMenu) {
  await evaluate(`(() => {
    const d = document.getElementById('atlas-menu') || document.querySelector('.atlas-menu');
    if (d) d.open = true;
    return !!d;
  })()`);
  await new Promise((r) => setTimeout(r, 1200));
}
if (wantControls) {
  await evaluate(`(() => {
    const d = document.querySelector('details.city-controls') || document.querySelector('.atlas-extra-controls');
    if (d) d.open = true;
    return !!d;
  })()`);
  await new Promise((r) => setTimeout(r, 1200));
}
if (wantNav) {
  await evaluate(`(() => {
    const d = document.querySelector('details.city-navigation') || document.getElementById('city-navigation');
    if (d) d.open = true;
    return !!d;
  })()`);
  await new Promise((r) => setTimeout(r, 1200));
}

// Open any selector's owning dialog or details, for surfaces that only exist
// after a user action. "--open=#some-dialog" opens the dialog itself.
const openSel = args.find((a) => a.startsWith("--open="))?.slice("--open=".length);
if (openSel) {
  await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(openSel)});
    if (!el) return false;
    if (typeof el.showModal === 'function') { el.showModal(); return true; }
    if ('open' in el) { el.open = true; return true; }
    const host = el.closest('dialog, details');
    if (host) { if (host.showModal) host.showModal(); else host.open = true; return true; }
    el.click();
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 2000));
}

// Read the panel's own rect as well as the document overflow. A panel that stays
// closed renders nothing, so "no offender" alone does not prove the fix landed.
const panel = await evaluate(`(() => {
  const pick = ['.city-navigation .sections', '.atlas-menu-body', '.city-controls > div', '.atlas-extra-controls-body']
    .map((s) => document.querySelector(s)).find((el) => el && el.getBoundingClientRect().width > 0);
  if (!pick) return { found: false };
  const r = pick.getBoundingClientRect();
  const cs = getComputedStyle(pick);
  return {
    found: true,
    selector: pick.className || pick.tagName.toLowerCase(),
    left: Math.round(r.left),
    right: Math.round(r.right),
    width: Math.round(r.width),
    position: cs.position,
    insetRight: cs.right,
    viewportWidth: document.documentElement.clientWidth,
    insideViewport: Math.round(r.right) <= document.documentElement.clientWidth && Math.round(r.left) >= 0,
  };
})()`);

const report = await evaluate(`(() => {
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const overRight = Math.round(r.right - vw);
    const overLeft = Math.round(0 - r.left);
    if (overRight > 1 || overLeft > 1) {
      const cs = getComputedStyle(el);
      offenders.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        cls: (el.getAttribute('class') || '').slice(0, 48) || null,
        position: cs.position,
        overflowX: cs.overflowX,
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
        over: Math.max(overRight, overLeft),
      });
    }
  }
  offenders.sort((a, b) => b.over - a.over);
  return {
    url: location.href,
    viewport: { vw, vh: document.documentElement.clientHeight },
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    overflowPx: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw,
    offenderCount: offenders.length,
    offenders: offenders.slice(0, 20),
  };
})()`);
report.panel = panel;
report.opened = { menu: wantMenu, controls: wantControls, nav: wantNav };

if (outPath) {
  const { data } = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(outPath, Buffer.from(data, "base64"));
}

console.log(JSON.stringify(report, null, 2));
if (outPath) console.log(`screenshot: ${outPath}`);

await send("Target.closeTarget", { targetId });
ws.close();