#!/usr/bin/env node
// JKTx 3D Atlas — smoke test the live (or local) API surface.
// Exits non-zero on any failure.
//
// Usage:
//   node scripts/smoke-atlas-api.mjs                  # live atlas
//   ATLAS_URL=http://localhost:8787 node scripts/smoke-atlas-api.mjs  # local

import {validImageryCatalogue} from './environment-smoke-contract.mjs';

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
// A section behind a 200-gate must still be counted when the gate is closed.
// A green run that quietly covered fewer checks is how an upstream outage
// hides a broken contract: the denominator itself is part of the result.
function notRun(name, why) {
  CHECKS.push({ name: name + " — NOT RUN", ok: false, detail: why, soft: true });
}

async function get(path) {
  const url = `${ATLAS_URL}${path}`;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(45000) });
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, body };
  } catch (e) {
    // A network error is a failed check with a reason, not an unhandled
    // rejection that kills the run before the later checks register.
    return { status: 0, body: null, error: e?.name === "TimeoutError" ? "timeout" : String(e?.cause?.code || e?.message || e) };
  }
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
    const ok200 = r.status === 200 && Array.isArray(r.body) && r.body.length > 0 && r.body.every(p => Number.isFinite(p.aqi) && p.observedAt);
    const outage503 = r.status === 503 && r.body?.error === "air_quality_unavailable";
    if (outage503) {
      soft("air quality returns model AQI with valid time", false, `HTTP 503 explicit outage (error=${r.body.error})`);
    } else {
      check("air quality returns model AQI with valid time", ok200, `${r.status}${r.error ? ' ' + r.error : ''} rows=${Array.isArray(r.body) ? r.body.length : 0}`);
    }
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
    const rawProducts = r.body?.products;
    const satellite = Array.isArray(rawProducts) ? rawProducts.filter(p=>p&&typeof p==='object') : [];
    check("satellite catalogue preserves identities, dates and explicit outages", validImageryCatalogue(r.status,rawProducts), `${r.status} products=${satellite.length}`);
    const daily=satellite.filter(p=>p.id!=='himawari'),himawari=satellite.find(p=>p.id==='himawari');
    CHECKS.push({name:'NASA dated imagery availability',ok:daily.length===9&&daily.every(p=>p.available),soft:true,detail:`available=${daily.filter(p=>p.available).length}/9; unavailable=${daily.filter(p=>!p.available).map(p=>p.id).join(',')||'none'}`});
    CHECKS.push({name:'Himawari dated infrared availability',ok:himawari?.available===true,soft:true,detail:himawari?.date||'explicitly unavailable; no imagery claimed'});
    check("radar exposes past observations", r.status === 200 && r.body?.radar?.available && r.body.radar.frames?.length > 0 && r.body.radar.frames.every(f => Number.isFinite(Date.parse(f.observedAt))), `frames=${r.body?.radar?.frames?.length}`);
  }
  {
    const r = await get("/api/atlas/rainfall");
    const ok200 = r.status === 200 && r.body?.points?.length === 5 && r.body.points.every(p => p.available && Number.isFinite(p.precipitationMm) && Number.isFinite(p.next24hMm) && p.validAt?.endsWith("Z"));
    const outage503 = r.status === 503 && Array.isArray(r.body?.points);
    if (outage503) {
      soft("rainfall exposes five valid model samples", false, `HTTP 503 explicit outage (points=${r.body.points.length})`);
    } else {
      check("rainfall exposes five valid model samples", ok200, `${r.status}${r.error ? ' ' + r.error : ''} points=${r.body?.points?.length}`);
    }
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

  {
    const r = await get('/api/atlas/hydrology');
    // ewscilicis.id intermittently fails, so an explicit 503 is a valid state of
    // this contract, not a defect. What must never pass is a 200 whose freshness
    // contract is broken, or a 503 that prints ✓ for 200-only freshness checks.
    const outage = r.status === 503 && r.body?.available === false;
    check('a route with no current reading is an explicit outage, not an empty 200',
      outage || r.status === 200 && r.body?.available === true && (r.body.freshLevels > 0 || r.body.predictions?.some(p => p.current)),
      `HTTP ${r.status}${r.error ? ' ' + r.error : ''} available=${r.body?.available}`);
    if (r.status === 200 && Array.isArray(r.body?.stations) && Array.isArray(r.body?.predictions)) {
      const window = r.body.freshnessWindowMs;
      const now = Date.now();
      // cleanGauge's real contract: a reading is usable only with a finite value
      // in metres and a valid stamp; it is fresh only if also inside the window.
      // A station with a current timestamp but no reading is "unknown".
      const stateHolds = s => {
        const at = Date.parse(s.observedAt);
        const usable = Number.isFinite(s.levelM) && s.levelM !== null && !s.rejectedTimestamp;
        const inside = usable && Number.isFinite(at) && now - at <= window;
        return s.fresh === inside && s.levelState === (!usable ? 'unknown' : inside ? 'fresh' : 'stale');
      };
      const detail = `${r.status} fresh=${r.body.freshLevels}/${r.body.stations.length} window=${window ? window / 3600000 : '?'}h states=${['fresh', 'stale', 'unknown'].map(k => `${k}=${r.body.stations.filter(s => s.levelState === k).length}`).join(' ')}`;
      check('hydrology states a freshness window and its gauge states match the contract',
        typeof window === 'number' && window > 0 && typeof r.body.freshnessPolicy === 'string'
        && r.body.freshLevels === r.body.stations.filter(s => s.fresh).length
        && r.body.stations.every(stateHolds),
        detail);
      check('no prediction outside the window claims to be current',
        r.body.predictions.every(p =>
          p.current === (Number.isFinite(Date.parse(p.validAt)) && now - Date.parse(p.validAt) <= window)),
        `predictions=${r.body.predictions.length} current=${r.body.predictions.filter(p => p.current).length}`);
    } else {
      const why = `upstream HTTP ${r.status}${r.error ? ' ' + r.error : ''}`;
      notRun('hydrology states a freshness window and its gauge states match the contract', why);
      notRun('no prediction outside the window claims to be current', why);
    }
  }
  {
    const r = await get('/api/atlas/coastal');
    check('coastal forecast exposes published BMKG points or an explicit outage',
      r.status === 503 && r.body?.available === false || r.status === 200 && r.body?.available === true
      && r.body.tier === 'official-coastal-forecast' && r.body.points.length > 0,
      `HTTP ${r.status} points=${r.body?.points?.length ?? 'unavailable'}`);
    if (r.status === 200) {
      const pts = r.body.points;
      const stamps = pts.map(p => Date.parse(p.validAt));
      check('coastal points are sorted, deduplicated and strictly increasing',
        pts.every(p => p.validAt?.endsWith('Z')) && stamps.every((t, i) => i === 0 || t > stamps[i - 1]),
        `first=${pts[0]?.validAt} last=${pts[pts.length - 1]?.validAt} rows=${pts.length}`);
      // A tide forecast with no published vertical datum must say so; it cannot
      // be joined to river-gauge heights or terrain.
      check('coastal states its vertical datum is unpublished',
        typeof r.body.datumNote === 'string' && /datum/i.test(r.body.datumNote) && /cannot|not comparable|tidak/i.test(r.body.datumNote),
        (r.body.datumNote || 'missing').slice(0, 60));
      check('coastal issuance is not from the future', Number.isFinite(Date.parse(r.body.issuedAt)) && Date.parse(r.body.issuedAt) <= Date.now() + 5 * 60000, `issuedAt=${r.body.issuedAt}`);
    } else {
      const why = `upstream HTTP ${r.status}${r.error ? ' ' + r.error : ''}`;
      notRun('coastal points are sorted, deduplicated and strictly increasing', why);
      notRun('coastal states its vertical datum is unpublished', why);
      notRun('coastal issuance is not from the future', why);
    }
  }
  {
    // The audit round rejected model runs older than 72h and narrowed the tile
    // window to 4 days. Both must reject on the edge, not only in unit tests.
    const stale = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
    const r = await get(`/api/atlas/jaxa-tile?product=OUTFLW&date=${stale}&z=4&x=8&y=8`);
    check('jaxa-tile rejects a date outside its 4-day window', r.status === 400, `${r.status}`);
    const bad = await get('/api/atlas/jaxa-tile?product=NOT_A_PRODUCT&date=' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '&z=4&x=8&y=8');
    check('jaxa-tile rejects an unknown product', bad.status === 400, `${bad.status}`);
    const w = await get('/api/atlas/jaxa-water');
    check('jaxa-water answers with a bounded model run or an explicit outage',
      w.status === 503 || w.status === 200 && w.body?.tier === 'hydrological-model' && Number.isFinite(Date.parse(w.body.validAt)),
      `HTTP ${w.status} validAt=${w.body?.validAt ?? 'unavailable'}`);
  }

  {
    const s = await get('/api/atlas/synoptic');
    // The synoptic layer draws isobars, so the contract that keeps it honest:
    // cells are the ones the provider returned, pressure is bounded to real
    // observations, and a too-small field is an explicit outage rather than a
    // contour drawn through nothing.
    check('synoptic field exposes the provider grid, or an explicit outage',
      s.status === 503 && s.body?.available === false || s.status === 200 && s.body?.available === true
      && s.body.cells?.length >= 4 && s.body.cellCount === s.body.cells.length
      && s.body.cellCount <= s.body.requestedPoints
      && s.body.cells.every(c => Number.isFinite(c.lat) && Number.isFinite(c.lng) && c.hours?.length > 0),
      `HTTP ${s.status} cells=${s.body?.cells?.length ?? 'unavailable'} of ${s.body?.requestedPoints ?? '?'} requested`);
    if (s.status === 200) {
      const cells = s.body.cells;
      const keys = cells.map(c => `${c.lat.toFixed(3)},${c.lng.toFixed(3)}`);
      check('synoptic cells are the provider cells, deduplicated',
        new Set(keys).size === keys.length, `unique=${new Set(keys).size} of ${keys.length}`);
      check('every synoptic pressure stays inside a real sea-level observation',
        cells.every(c => c.hours.every(h => h.mslpHpa === null || (h.mslpHpa >= 870 && h.mslpHpa <= 1085))),
        'out-of-range hPa');
      check('synoptic wind stays a valid bearing and speed',
        cells.every(c => c.hours.every(h =>
          (h.wind850Ms === null || (h.wind850Ms >= 0 && h.wind850Ms <= 150))
          && (h.wind850FromDeg === null || (h.wind850FromDeg >= 0 && h.wind850FromDeg <= 360)))), 'bad wind');
      // The panel says 850 hPa is model wind because Himawari ships no wind
      // product. If that wording is dropped the layer starts implying a
      // satellite wind vector that does not exist.
      check('synoptic states 850 hPa is model wind, not a Himawari product',
        typeof s.body.windNote === 'string' && /Himawari/.test(s.body.windNote)
        && /model wind/i.test(s.body.windNote), String(s.body.windNote).slice(0, 60));
      check('synoptic carries no rainfall or cloud claim',
        !('rainMm' in s.body) && !('precipitationMm' in s.body) && !('cloudTopK' in s.body),
        Object.keys(s.body).join(','));
    } else {
      const why = `upstream HTTP ${s.status}${s.error ? ' ' + s.error : ''}`;
      notRun('synoptic cells are the provider cells, deduplicated', why);
      notRun('every synoptic pressure stays inside a real sea-level observation', why);
      notRun('synoptic wind stays a valid bearing and speed', why);
      notRun('synoptic states 850 hPa is model wind, not a Himawari product', why);
      notRun('synoptic carries no rainfall or cloud claim', why);
    }
  }

  {
    const r = await get('/api/atlas/wind-field');
    // The wind layer is the one place motion is drawn. The contract that keeps it
    // honest: cells are the ones the provider returned, the count can be smaller
    // than requested, and an absent field never reads as calm.
    check('wind field exposes the provider model cells, or an explicit outage',
      r.status === 503 && r.body?.available === false || r.status === 200 && r.body?.available === true
      && r.body.cells?.length > 0 && r.body.cellCount === r.body.cells.length
      && r.body.cellCount <= r.body.requestedPoints
      && r.body.cells.every(c => Number.isFinite(c.lat) && Number.isFinite(c.lng) && c.hours?.length > 0),
      `HTTP ${r.status} cells=${r.body?.cells?.length ?? 'unavailable'} of ${r.body?.requestedPoints ?? '?'} requested`);
    if (r.status === 200) {
      const cells = r.body.cells;
      const keys = cells.map(c => `${c.lat.toFixed(3)},${c.lng.toFixed(3)}`);
      check('wind cells are the provider cells, deduplicated',
        new Set(keys).size === keys.length, `unique=${new Set(keys).size} of ${keys.length}`);
      check('every wind cell keeps only validated hours',
        cells.every(c => c.hours.every(h => h.validAt?.endsWith('Z')
          && (h.windMs === null || (h.windMs >= 0 && h.windMs <= 100))
          && (h.windFromDeg === null || (h.windFromDeg >= 0 && h.windFromDeg <= 360)))),
        `bad=${cells.reduce((n, c) => n + c.hours.filter(h => h.validAt && !h.validAt.endsWith('Z')).length, 0)}`);
      check('wind field carries no concentration or plume field',
        !('concentration' in r.body) && !('plume' in r.body) && r.body.tier === 'model-estimate',
        Object.keys(r.body).join(','));
      check('wind cells are inside the Jakarta rectangle',
        cells.every(c => c.lat >= -6.6 && c.lat <= -5.88 && c.lng >= 106.45 && c.lng <= 107.20), 'outside');
    } else {
      const why = `upstream HTTP ${r.status}${r.error ? ' ' + r.error : ''}`;
      notRun('wind cells are the provider cells, deduplicated', why);
      notRun('every wind cell keeps only validated hours', why);
      notRun('wind field carries no concentration or plume field', why);
      notRun('wind cells are inside the Jakarta rectangle', why);
    }
  }

  let pass = 0, hard = 0, absent = 0;
  for (const c of CHECKS) {
    const sym = c.ok ? "✓" : c.soft ? "⚠" : "✗";
    const detail = c.detail ? `  ${c.detail}` : "";
    console.log(`  ${sym} ${c.name}${detail}`);
    if (c.ok) pass++;
    else if (c.soft) absent++;
    else hard++;
  }
  console.log(`\n${pass}/${CHECKS.length} passed${absent ? `, ${absent} degraded or not run` : ""}${hard ? "" : " (no hard failures)"}`);
  if (hard) process.exit(1);
})();
