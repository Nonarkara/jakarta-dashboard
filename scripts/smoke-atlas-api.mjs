#!/usr/bin/env node
// JKTx 3D Atlas — smoke test the live (or local) API surface.
// Exits non-zero on any failure.
//
// Usage:
//   node scripts/smoke-atlas-api.mjs                  # live atlas
//   ATLAS_URL=http://localhost:8787 node scripts/smoke-atlas-api.mjs  # local

const ATLAS_URL = (process.env.ATLAS_URL || "https://jakarta.nonarkara.org").replace(/\/$/, "");

const CHECKS = [];
function check(name, ok, detail = "") {
  CHECKS.push({ name, ok, detail });
}
// Open-Meteo throttles shared Cloudflare egress; the client fetches it from the
// visitor's browser instead. Report a Worker-side outage, don't fail on it.
function soft(name, ok, detail = "") {
  CHECKS.push({ name: name + " (Worker egress; browser fallback covers it)", ok, detail, soft: true });
}

async function get(path) {
  const url = `${ATLAS_URL}${path}`;
  const res = await fetch(url, { headers: { accept: "application/json" }, signal:AbortSignal.timeout(45000) });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

(async () => {
  console.log(`JKTx 3D Atlas smoke · ${ATLAS_URL}`);
  {
    const r = await get("/api/atlas/areas?bbox=106.65,-6.40,107.00,-6.08");
    check("atlas.areas returns the 12 places", r.status === 200 && r.body?.count === 12, `${r.status} count=${r.body?.count}`);
  }
  {
    const r = await get("/api/atlas/districts");
    check("atlas.districts lists the five kota", r.status === 200 && r.body?.count === 5, `${r.status} count=${r.body?.count}`);
  }
  {
    const r = await get("/api/atlas/at-this-point?lng=106.8205&lat=-6.2060");
    check("atlas.at-this-point locates Sudirman–Thamrin", r.status === 200 && r.body?.nearestArea?.id === "sudirman-thamrin", `${r.status} nearest=${r.body?.nearestArea?.id}`);
    check("atlas.at-this-point names its model sample", typeof r.body?.nearestModelSample?.id === "string", `sample=${r.body?.nearestModelSample?.id}`);
  }
  {
    const r = await get("/api/atlas/buildings?bbox=106.81,-6.21,106.83,-6.19");
    check("atlas.buildings points to PMTiles", r.status === 200 && typeof r.body?.pointer?.pmtiles === "string" && r.body.pointer.sizeMb > 1, `${r.status} sizeMb=${r.body?.pointer?.sizeMb}`);
  }
  {
    const r = await get("/api/atlas/air-quality");
    soft("air quality returns model AQI with valid time", r.status === 200 && Array.isArray(r.body) && r.body.length > 0 && r.body.every(p => Number.isFinite(p.aqi) && p.observedAt), `${r.status} rows=${Array.isArray(r.body) ? r.body.length : 0}`);
  }
  {
    const r = await get("/api/atlas/watch");
    check("city watch answers with five places", r.status === 200 && r.body?.places?.length === 5 && r.body?.traffic?.congestion === "unavailable", `${r.status} places=${r.body?.places?.length}`);
  }
  {
    const r = await get("/api/health");
    check("health sees the building archive", r.status === 200 && r.body?.ok === true, `${r.status} ok=${r.body?.ok}`);
  }
  {
    const r = await get("/api/atlas/at-this-point?lng=0&lat=0");
    check("atlas.at-this-point rejects out-of-bbox", r.status === 400 && r.body?.error === "out_of_jakarta_bbox", `${r.status} error=${r.body?.error}`);
  }
  {
    const r = await get("/api/atlas/at-this-point?lng=abc&lat=xyz");
    check("atlas.at-this-point rejects invalid input", r.status === 400 && r.body?.error === "invalid_coordinates", `${r.status} error=${r.body?.error}`);
  }

  {
    const r = await get("/api/atlas/environment");
    check("NASA products expose usable dated imagery", r.status === 200 && r.body?.products?.length === 9 && r.body.products.filter(p => p.id !== "himawari").every(p => p.available && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.tiles?.length === 1 && p.dates?.includes(p.date)), `${r.status} products=${r.body?.products?.length}`);
    const himawari = r.body?.products?.find(p => p.id === 'himawari');
    check("Himawari exposes a dated infrared frame", himawari?.available && himawari.date?.includes('T') && himawari.tiles?.length === 1, himawari?.date || 'unavailable');
    check("radar exposes past observations", r.status === 200 && r.body?.radar?.available && r.body.radar.frames?.length > 0 && r.body.radar.frames.every(f => Number.isFinite(Date.parse(f.observedAt))), `frames=${r.body?.radar?.frames?.length}`);
  }
  {
    const r = await get("/api/atlas/rainfall");
    soft("rainfall exposes five valid model samples", r.status === 200 && r.body?.points?.length === 5 && r.body.points.every(p => p.available && Number.isFinite(p.precipitationMm) && Number.isFinite(p.next24hMm) && p.validAt?.endsWith("Z")), `${r.status} points=${r.body?.points?.length}`);
  }

  {
    const r=await get('/api/atlas/fires');
    check('thermal detections are bounded and dated, or explicitly unavailable',
      r.status===503 && r.body?.error==='fires_unavailable' || r.status===200 && r.body?.type==='FeatureCollection' && r.body.windowHours===24 && r.body.tier==='satellite-detection' && r.body.count===r.body.features?.length && r.body.features.every(f=>Number.isFinite(Date.parse(f.properties.observedAt)) && Date.now()-Date.parse(f.properties.observedAt)<=25*3600000), `HTTP ${r.status} admitted=${r.body?.count??'unavailable'}`);
  }
  {
    const r=await get('/api/atlas/air-timeline');
    check('air timeline exposes validated model hours or a bounded outage',
      r.status===503 && r.body?.available===false || r.status===200 && r.body?.available===true && r.body.tier==='model-forecast' && r.body.times?.length===48 && r.body.times.every(row=>row.validAt?.endsWith('Z')), `HTTP ${r.status} hours=${r.body?.times?.length??'unavailable'}`);
  }

  let pass = 0, hard = 0;
  for (const c of CHECKS) {
    const sym = c.ok ? "✓" : c.soft ? "⚠" : "✗";
    const detail = c.detail ? `  ${c.detail}` : "";
    console.log(`  ${sym} ${c.name}${detail}`);
    if (c.ok) pass++;
    else if (!c.soft) hard++;
  }
  console.log(`\n${pass}/${CHECKS.length} passed${hard ? "" : " (no hard failures)"}`);
  if (hard) process.exit(1);
})();
