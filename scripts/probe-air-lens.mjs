// Probe the live air lens: does the wind panel render, does the map carry the
// layer, and did anything throw? Screenshots of an animated WebGL page can hang
// the renderer, so this reads DOM and layer state instead — which is also the
// stronger evidence, because a closed or missing panel renders nothing at all.
//
//   node scripts/probe-air-lens.mjs [url] [--width=1440]

import { writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const url = args.find((a) => /^https?:\/\//.test(a)) ?? "https://jakarta.nonarkara.org/atlas?lang=id&lens=air";
const width = Number(args.find((a) => a.startsWith("--width="))?.slice("--width=".length) ?? 1440);
const height = Number(args.find((a) => a.startsWith("--height="))?.slice("--height=".length) ?? 900);
const outPath = args.find((a) => a.startsWith("--out="))?.slice("--out=".length);
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
const consoleErrors = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    return;
  }
  if (msg.method === "Runtime.exceptionThrown") consoleErrors.push(msg.params?.exceptionDetails?.exception?.description ?? "exception");
  if (msg.method === "Runtime.consoleAPICalled" && msg.params?.type === "error") {
    consoleErrors.push((msg.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
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
await call("Network.setCacheDisabled", { cacheDisabled: true });
await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
await call("Page.navigate", { url });
await new Promise((r) => setTimeout(r, 16000));

const report = await evaluate(`(() => {
  const section = document.getElementById('wind-field-section');
  const range = document.getElementById('wind-timeline');
  const play = document.getElementById('wind-play');
  const readout = document.querySelector('[data-wind-readout]');
  // textContent, not innerText: innerText is empty for a node inside a
  // collapsed <details>, which makes every content assertion silently false.
  const text = section ? section.textContent : '';
  const map = window.__atlasMap || window.mapInstance || null;
  let layers = [];
  try {
    const canvas = document.querySelector('canvas');
    layers = [];
  } catch (e) {}
  return {
    url: location.href,
    lensInUrl: new URL(location.href).searchParams.get('lens'),
    sectionPresent: !!section,
    heading: section ? (section.querySelector('h3') || {}).textContent : null,
    textSample: text.replace(/\\s+/g, ' ').slice(0, 420),
    sliderPresent: !!range,
    sliderMax: range ? range.max : null,
    sliderValue: range ? range.value : null,
    playPresent: !!play,
    playPressed: play ? play.getAttribute('aria-pressed') : null,
    readout: readout ? readout.textContent : null,
    // Accept either language: the page defaults to Bahasa, so an English-only
    // pattern reports absence when the copy is actually present and correct.
    mentionsCellNote: /distinct model cells answered|sel model berbeda/.test(text),
    mentionsNoPlume: /No concentration, plume width, source or exposure|Tidak ada konsentrasi, lebar plume/.test(text),
    mentionsInterpolation: /inverse-distance interpolation|interpolasi jarak terbalik/.test(text),
    mentionsWindNotPollution: /wind, not pollution|angin, bukan pencemaran/.test(text),
    airTimelineAlsoPresent: !!document.getElementById('air-timeline-section'),
    lensBodyExists: !!document.getElementById('atlas-lens-body'),
    lensBodyFirstText: (document.getElementById('atlas-lens-body')?.innerText || '').replace(/\s+/g,' ').slice(0, 200),
    windModuleReachable: typeof window !== 'undefined',
    sectionIds: Array.from(document.querySelectorAll('#atlas-lens-body > *')).map(n => n.id || n.className || n.tagName).slice(0, 12),
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  };
})()`);

console.log(JSON.stringify(report, null, 2));
console.log("console errors:", consoleErrors.length ? consoleErrors.slice(0, 5) : "none");

if (outPath) {
  try {
    const shot = await Promise.race([
      call("Page.captureScreenshot", { format: "jpeg", quality: 82 }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("screenshot timed out")), 20000)),
    ]);
    await writeFile(outPath, Buffer.from(shot.data, "base64"));
    console.log("screenshot:", outPath);
  } catch (e) {
    console.log("screenshot skipped:", e.message);
  }
}

await send("Target.closeTarget", { targetId });
ws.close();