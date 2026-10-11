import { handleJakarta } from "./jakarta.js";
// Cloudflare Worker entry for jakarta-3d-atlas.
//
// The atlas is a static SPA in public/ (no build step). The Worker exists to
// (1) host the custom domain, (2) pass HTTP Range through to R2 for the
// PMTiles archives (the Workers [assets] binding does not honor Range, so
// every GET would return the whole archive), and (3) answer a small
// AI-readable mirror at /api/atlas/*. Ported from hcmc-3d-atlas; everything
// here reads open providers directly -- Jakarta has no operations dashboard
// behind it, so there are no sensor, bus or incident feeds.
//
//   /api/atlas/areas?bbox=&category=     the 12 curated places
//   /api/atlas/districts                 the five mainland kota (reference)
//   /api/atlas/at-this-point?lng=&lat=   nearest place + nearest model sample
//   /api/atlas/buildings                 pointer to the buildings PMTiles
//   /api/atlas/environment               NASA GIBS products + RainViewer radar
//   /api/atlas/rainfall                  Open-Meteo rain at five samples
//   /api/atlas/air-quality               Open-Meteo / CAMS at five samples
//   /api/atlas/watch                     flood/air/wind/storm watch strip
//   /api/health                          liveness + tile archive presence

export interface Env {
  ASSETS: Fetcher;
  JAKARTA_TILES: R2Bucket;
}

const PMTILES_PATH = "/jakarta-buildings.pmtiles";
const PMTILES_R2_KEY = "buildings/jakarta-v1.pmtiles"; // Overture footprints + Google 2.5D heights, scripts/bake-buildings.py
const WATERWAYS_PMTILES_PATH = "/jakarta-waterways.pmtiles";
const WATERWAYS_PMTILES_R2_KEY = "buildings/jakarta-waterways.pmtiles"; // scripts/bake-osm-layers.py waterways

const ATLAS_VERSION = "0.1.0";

// DKI Jakarta mainland and its immediate edge. Kepulauan Seribu is outside.
const CITY_BBOX = {
  minLat: -6.40,
  maxLat: -6.08,
  minLon: 106.65,
  maxLon: 107.00,
} as const;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("access-control-allow-origin", "*");
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "public, max-age=60");
  }
  return new Response(JSON.stringify(body), { ...init, headers });
}

function applyTileCors(headers: Headers) {
  headers.set("access-control-allow-origin", "*");
  headers.set(
    "access-control-expose-headers",
    "Accept-Ranges, Content-Length, Content-Range, ETag",
  );
  // Vary on Range so Cloudflare's edge does NOT cache the first 200 OK
  // response and serve it back on subsequent Range requests. Without this,
  // pmtiles.js's first header-range GET gets a 206 with content-length 128,
  // then the next full-file GET (or any other Range) hits the cached 200
  // and the library throws "Server returned no content-length header or
  // content-length exceeding request".
  headers.append("vary", "Range");
}

// ── PMTiles Range passthrough ─────────────────────────────────────────────

function parseRange(header: string | null):
  | { offset: number; length?: number }
  | { offset: number; length: number; suffix: true }
  | null {
  if (!header) return null;
  const match = /^bytes=(-)?(\d+)(?:-(\d*))?$/.exec(header.trim());
  if (!match) return null;
  if (match[1] === "-") {
    const suffix = Number.parseInt(match[2], 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    return { offset: 0, length: suffix, suffix: true };
  }
  const offset = Number.parseInt(match[2], 10);
  if (!Number.isFinite(offset) || offset < 0) return null;
  if (match[3] === undefined || match[3] === "") return { offset };
  const end = Number.parseInt(match[3], 10);
  if (!Number.isFinite(end) || end < offset) return null;
  return { offset, length: end - offset + 1 };
}

async function servePmtilesFromR2(request: Request, env: Env, key: string): Promise<Response> {
  if (request.method === "HEAD") {
    const head = await env.JAKARTA_TILES.head(key);
    if (!head) return new Response("not found", { status: 404 });
    const headers = new Headers({ "content-type": "application/octet-stream", "accept-ranges": "bytes", "content-length": String(head.size), "cache-control": "public, max-age=31536000, immutable" });
    if (head.httpEtag) headers.set("etag", head.httpEtag);
    applyTileCors(headers);
    return new Response(null, { headers });
  }
  const range = parseRange(request.headers.get("range"));
  if (range && "suffix" in range && range.suffix) {
    const head = await env.JAKARTA_TILES.head(key);
    if (head === null) return new Response("not found", { status: 404 });
    const suffixLen = range.length ?? 0;
    const length = Math.min(suffixLen, head.size);
    const offset = head.size - length;
    return streamRange(env, key, offset, length, head.size);
  }
  if (range) {
    // Validate the requested range against the actual object size BEFORE
    // hitting R2 -- R2 throws Error 10039 "The requested range is not
    // satisfiable" which manifests as a Worker 500 and trips pmtiles.js.
    const head = await env.JAKARTA_TILES.head(key);
    if (head === null) return new Response("not found", { status: 404 });
    const requestedEnd = range.offset + (range.length ?? (head.size - range.offset)) - 1;
    if (range.offset >= head.size) {
      // Proper HTTP 416 Range Not Satisfiable, pmtiles.js handles this.
      const h = new Headers();
      h.set("content-range", `bytes */${head.size}`);
      h.set("accept-ranges", "bytes");
      applyTileCors(h);
      return new Response(null, { status: 416, headers: h });
    }
    if (requestedEnd >= head.size) {
      // Clamp the read to the actual file end rather than blowing up. This
      // is what S3 / R2 do internally too -- pmtiles.js accepts the
      // truncated read as long as content-length matches.
      range.length = head.size - range.offset;
    }
    return streamRange(env, key, range.offset, range.length ?? (head.size - range.offset), head.size);
  }
  const obj = await env.JAKARTA_TILES.get(key);
  if (obj === null) return new Response("not found", { status: 404 });
  if (!("body" in obj) || obj.body === null) return new Response(null, { status: 304 });
  const headers = new Headers();
  headers.set("content-type", "application/octet-stream");
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  applyTileCors(headers);
  if (obj.httpEtag) headers.set("etag", obj.httpEtag);
  headers.set("x-jktx-source", `R2 jakarta-tiles/${key}`);
  headers.set("content-length", String(obj.size));
  return new Response(obj.body, { status: 200, headers });
}

async function streamRange(env: Env, key: string, offset: number, length: number, totalSize: number): Promise<Response> {
  const obj = await env.JAKARTA_TILES.get(key, { range: { offset, length } });
  if (obj === null || !("body" in obj) || obj.body === null) {
    return new Response(null, { status: 304 });
  }
  const headers = new Headers();
  headers.set("content-type", "application/octet-stream");
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  applyTileCors(headers);
  if (obj.httpEtag) headers.set("etag", obj.httpEtag);
  headers.set("x-jktx-source", `R2 jakarta-tiles/${key}`);
  headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${totalSize}`);
  headers.set("content-length", String(length));
  return new Response(obj.body, { status: 206, headers });
}

// ── Request parsing ───────────────────────────────────────────────────────

function parseBbox(text: string): [number, number, number, number] | null {
  const values = text.split(",");
  if (values.length !== 4 || values.some((v) => !v.trim())) return null;
  const parts = values.map(Number);
  if (!parts.every(Number.isFinite)) return null;
  const [w, south, e, n] = parts;
  if (w >= e || south >= n || w < -180 || e > 180 || south < -90 || n > 90) return null;
  return parts as [number, number, number, number];
}

function parseCityLngLat(request: Request): { lng: number; lat: number } | Response {
  const url = new URL(request.url);
  const lngText = url.searchParams.get("lng")?.trim();
  const latText = url.searchParams.get("lat")?.trim();
  const lng = lngText ? Number(lngText) : NaN;
  const lat = latText ? Number(latText) : NaN;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return jsonResponse(
      {
        error: "invalid_coordinates",
        message: "Pass ?lng=&lat= as WGS84 decimals (Jakarta ≈ 106.83, -6.20).",
      },
      { status: 400 },
    );
  }
  if (
    lng < CITY_BBOX.minLon || lng > CITY_BBOX.maxLon ||
    lat < CITY_BBOX.minLat || lat > CITY_BBOX.maxLat
  ) {
    return jsonResponse(
      {
        error: "out_of_jakarta_bbox",
        message: "Coordinates fall outside the Jakarta bbox used by this atlas.",
        lng,
        lat,
      },
      { status: 400 },
    );
  }
  return { lng, lat };
}

// ── Static assets ─────────────────────────────────────────────────────────

interface CityArea {
  id: string;
  name: string;
  indonesian: string;
  category: string;
  chapter: string;
  description: string;
  center: [number, number];
  zoom: number;
  pitch?: number;
  bearing?: number;
  tags?: string[];
}

interface CityAreasDoc {
  name: string;
  version: string;
  license: string;
  projection: string;
  areas: CityArea[];
  categories: Record<string, string>;
}

let areasCache: CityAreasDoc | null = null;

async function loadAreas(env: Env, request: Request): Promise<CityAreasDoc | null> {
  if (areasCache) return areasCache;
  const url = new URL("/jakarta-areas.json", request.url);
  const res = await env.ASSETS.fetch(new Request(url.toString(), request));
  if (!res.ok) return null;
  const doc = (await res.json()) as CityAreasDoc;
  if (Array.isArray(doc?.areas) && doc.areas.length > 0) {
    areasCache = doc;
    return areasCache;
  }
  return null;
}

function validObservation(stamp: string | null | undefined, maxAgeMs: number): boolean {
  const time = stamp ? Date.parse(stamp) : NaN;
  return Number.isFinite(time) && time <= Date.now() + 5 * 60000 && Date.now() - time <= maxAgeMs;
}

// ── /api/atlas/* handlers ─────────────────────────────────────────────────

async function handleAreas(request: Request, env: Env): Promise<Response> {
  const doc = await loadAreas(env, request);
  if (!doc) {
    return jsonResponse({ error: "areas_unavailable" }, { status: 503 });
  }
  const url = new URL(request.url);
  const bboxParam = url.searchParams.get("bbox");
  const category = url.searchParams.get("category");
  let areas = doc.areas;
  if (category) areas = areas.filter((a) => a.category === category);
  if (bboxParam !== null) {
    const parts = parseBbox(bboxParam);
    if (!parts) return jsonResponse({ error: "invalid_bbox", message: "Use west,south,east,north with increasing WGS84 bounds." }, { status: 400 });
    const [w, south, e, n] = parts;
    areas = areas.filter((a) => a.center[0] >= w && a.center[0] <= e && a.center[1] >= south && a.center[1] <= n);
  }
  return jsonResponse({
    tool: "atlas.areas",
    version: ATLAS_VERSION,
    count: areas.length,
    areas,
    categories: doc.categories,
    source: "jakarta-3d-atlas/jakarta-areas.json",
  });
}

async function handleDistricts(): Promise<Response> {
  // Names and rough centroids only. No population or area figures: there is
  // no verified, dated source wired in, and a rounded number would read as one.
  const districts = [
    { id: "pusat", nameEn: "Central Jakarta", nameId: "Jakarta Pusat", centroid: [106.8340, -6.1820] },
    { id: "utara", nameEn: "North Jakarta", nameId: "Jakarta Utara", centroid: [106.8650, -6.1300] },
    { id: "barat", nameEn: "West Jakarta", nameId: "Jakarta Barat", centroid: [106.7600, -6.1700] },
    { id: "selatan", nameEn: "South Jakarta", nameId: "Jakarta Selatan", centroid: [106.8100, -6.2700] },
    { id: "timur", nameEn: "East Jakarta", nameId: "Jakarta Timur", centroid: [106.9000, -6.2300] },
  ];
  return jsonResponse({
    tool: "atlas.districts",
    version: ATLAS_VERSION,
    count: districts.length,
    districts,
    source: {
      name: "curated static list in the worker",
      tier: "unverified-reference",
      observedAt: null,
      note: "The five mainland kota administrasi of DKI Jakarta with approximate centroids. Not boundaries; Kepulauan Seribu is outside the atlas bbox.",
    },
  });
}

async function handleAtThisPoint(request: Request, env: Env): Promise<Response> {
  const parsed = parseCityLngLat(request);
  if (parsed instanceof Response) return parsed;
  const { lng, lat } = parsed;
  const doc = await loadAreas(env, request);
  let nearest: CityArea | null = null;
  let best = Infinity;
  for (const a of doc?.areas ?? []) {
    if (a.category === "city-scale") continue;
    const d = distanceKm(lat, lng, a.center[1], a.center[0]);
    if (d < best) { best = d; nearest = a; }
  }
  const [weather, air] = await Promise.all([loadWeatherPoints(), loadAirPoints()]);
  let sample = -1, sampleKm = Infinity;
  RAIN_POINTS.forEach((p, i) => {
    const d = distanceKm(lat, lng, p.lat, p.lng);
    if (d < sampleKm) { sampleKm = d; sample = i; }
  });
  const point = weather.points[sample];
  const { forecast: _forecast, ...current } = point ?? {};
  return jsonResponse({
    tool: "atlas.at-this-point",
    version: ATLAS_VERSION,
    query: { lng, lat },
    nearestArea: nearest ? { id: nearest.id, name: nearest.name, indonesian: nearest.indonesian, distanceKm: Math.round(best * 10) / 10 } : null,
    nearestModelSample: point ? {
      ...current,
      distanceKm: Math.round(sampleKm * 10) / 10,
      air: air.points[sample] ?? null,
      note: "Weather and air values are model output at the nearest of five sample points, not a measurement at the queried location.",
    } : null,
    fetchedAt: new Date().toISOString(),
  });
}

async function handleBuildings(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const bboxParam = url.searchParams.get("bbox");
  if (bboxParam !== null && !parseBbox(bboxParam)) return jsonResponse({ error: "invalid_bbox" }, { status: 400 });
  const head = await env.JAKARTA_TILES.head(PMTILES_R2_KEY).catch(() => null);
  return jsonResponse({
    tool: "atlas.buildings",
    version: ATLAS_VERSION,
    bbox: bboxParam,
    pointer: {
      pmtiles: PMTILES_PATH,
      r2Key: PMTILES_R2_KEY,
      sizeMb: head ? head.size / (1024 * 1024) : null,
    },
    note: "Honest pointer: there is no server-side bbox query. Load the PMTiles in MapLibre via the pmtiles:// protocol and filter client-side.",
  });
}

// Public Earth-observation products. Fixed providers and bounded requests, never a user-supplied proxy URL.
const GIBS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const ENV_PRODUCTS = [
  { id: "surface-water", layer: "MODIS_Combined_Flood_3-Day", maxzoom: 9, resolution: "250 m", units: "classification", legend: "MODIS_Flood", tier: "satellite-observation" },
  { id: "aerosol", layer: "MODIS_Terra_Aerosol", maxzoom: 6, resolution: "10 km", units: "AOD (unitless)", legend: "MODIS_VIIRS_AOD", tier: "satellite-observation" },
  { id: "satellite-rain", layer: "IMERG_Precipitation_Rate", maxzoom: 6, resolution: "0.1°", units: "mm/h", legend: "GPM_Precipitation_Rate", tier: "satellite-estimate" },
  { id: "himawari", layer: "Himawari_AHI_Band13_Clean_Infrared", maxzoom: 6, resolution: "2 km", units: "K", legend: "Clean_Longwave_Infrared_Window_Band", tier: "satellite-observation" },
];
// Five model sample points, one per mainland kota administrasi. Planning
// locations for weather models, not rain gauges or district averages.
const RAIN_POINTS = [
  { id: "pusat", name: "Central Jakarta", name_id: "Jakarta Pusat", lat: -6.18, lng: 106.83 },
  { id: "utara", name: "North Jakarta", name_id: "Jakarta Utara", lat: -6.12, lng: 106.88 },
  { id: "barat", name: "West Jakarta", name_id: "Jakarta Barat", lat: -6.17, lng: 106.75 },
  { id: "selatan", name: "South Jakarta", name_id: "Jakarta Selatan", lat: -6.27, lng: 106.81 },
  { id: "timur", name: "East Jakarta", name_id: "Jakarta Timur", lat: -6.23, lng: 106.90 },
];
const CITY_CENTRE = { lat: -6.1754, lng: 106.8272 }; // Monas
async function fetchEnvironmentProvider(url: string, format: "json" | "text", ttl: number): Promise<{ body: any; fetchedAt: string } | null> {
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(url);
  try { const hit = await cache.match(key); if (hit) return await hit.json(); } catch {}
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(format === "text" ? 30000 : 20000) });
    if (!response.ok) return null;
    const data = { body: format === "json" ? await response.json() : await response.text(), fetchedAt: new Date().toISOString() };
    try { await cache.put(key, Response.json(data, { headers: { "cache-control": `public, max-age=${ttl}` } })); } catch {}
    return data;
  } catch { return null; }
}
function normalizedUtc(time: unknown): string | null {
  if (typeof time !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z?$/.test(time)) return null;
  const stamp = time.endsWith("Z") ? time : time + "Z";
  return Number.isFinite(Date.parse(stamp)) ? stamp : null;
}
function positiveValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
async function handleEnvironment(): Promise<Response> {
  const [capabilities, radar] = await Promise.all([
    fetchEnvironmentProvider(`${GIBS_BASE}/1.0.0/WMTSCapabilities.xml`, "text", 300),
    fetchEnvironmentProvider("https://api.rainviewer.com/public/weather-maps.json", "json", 120),
  ]);
  const layers = typeof capabilities?.body === "string" ? capabilities.body.match(/<Layer\b[^>]*>[\s\S]*?<\/Layer>/g) || [] : [];
  const products = ENV_PRODUCTS.map((product) => {
    const layer = layers.find((l: string) => l.includes(`<ows:Identifier>${product.layer}</ows:Identifier>`));
    if (product.id === "himawari") {
      const stamp = layer?.match(/<Default>(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)<\/Default>/)?.[1];
      const instant = stamp ? Date.parse(stamp) : NaN;
      const available = Number.isFinite(instant) && instant <= Date.now() + 300000 && Date.now() - instant <= 3 * 3600000
        && !!layer?.includes("<TileMatrixSet>GoogleMapsCompatible_Level6</TileMatrixSet>");
      const ranges = [...(layer || "").matchAll(/<Value>(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)(?:\/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\/PT10M)?<\/Value>/g)];
      const dates = available ? Array.from({ length: 12 }, (_, i) => new Date(instant - i * 600000).toISOString().replace('.000Z', 'Z'))
        .filter(day => ranges.length ? ranges.some(r => Date.parse(day) >= Date.parse(r[1]) && Date.parse(day) <= Date.parse(r[2] || r[1]) && (Date.parse(day) - Date.parse(r[1])) % 600000 === 0) : day === stamp) : [];
      return { ...product, available: available && dates.length > 0, source: "JMA Himawari AHI / NASA GIBS", date: dates[0] || null, latestAvailableDate: stamp || null, dates,
        fetchedAt: capabilities?.fetchedAt ?? null, timePrecision: "10 minutes", windowDays: null,
        tiles: dates.length ? [`${GIBS_BASE}/${product.layer}/default/${dates[0]}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`] : [],
        legendUrl: `${GIBS_BASE.replace('/wmts/epsg3857/best', '')}/legends/${product.legend}_H.svg`, sourceUrl: "https://www.jma.go.jp/jma/jma-eng/jma-center/nowcasting/index.html" };
    }
    const date = layer?.match(/<Default>(\d{4}-\d{2}-\d{2})<\/Default>/)?.[1];
    const matrix = `GoogleMapsCompatible_Level${product.maxzoom}`;
    const available = !!date && date <= new Date().toISOString().slice(0, 10) && !!layer?.includes(`<TileMatrixSet>${matrix}</TileMatrixSet>`);
    const ranges = [...(layer || "").matchAll(/<Value>(\d{4}-\d{2}-\d{2})(?:\/(\d{4}-\d{2}-\d{2})\/P1D)?<\/Value>/g)];
    const dates = available ? Array.from({ length: 7 }, (_, i) => new Date(Date.parse(date!) - i * 86400000).toISOString().slice(0, 10))
      .filter(day => ranges.length ? ranges.some(r => day >= r[1] && day <= (r[2] || r[1])) : day === date) : [];
    const selectedDate = dates.find(day => day < new Date().toISOString().slice(0, 10)) || date;
    return { ...product, available, source: "NASA GIBS / LANCE", date: available ? selectedDate : null, latestAvailableDate: available ? date : null, dates,
      fetchedAt: capabilities?.fetchedAt ?? null, timePrecision: "day", windowDays: product.id === "surface-water" ? 3 : 1,
      tiles: available ? [`${GIBS_BASE}/${product.layer}/default/${selectedDate}/${matrix}/{z}/{y}/{x}.png`] : [],
      legendUrl: `https://gibs.earthdata.nasa.gov/legends/${product.legend}_H.svg`,
      sourceUrl: "https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/" };
  });
  const radarBody = radar?.body;
  const frames = radarBody?.host === "https://tilecache.rainviewer.com" && Array.isArray(radarBody?.radar?.past)
    ? radarBody.radar.past.filter((f: any) => f && typeof f.time === "number" && Number.isFinite(f.time)
      && f.time * 1000 <= Date.now() + 5 * 60000 && Date.now() - f.time * 1000 <= 3 * 3600000
      && typeof f.path === "string" && /^\/v2\/radar\/[a-zA-Z0-9_-]+$/.test(f.path))
      .sort((a: any, b: any) => a.time - b.time).slice(-13).map((f: any) => ({
        observedAt: new Date(f.time * 1000).toISOString(),
        tiles: [`https://tilecache.rainviewer.com${f.path}/256/{z}/{x}/{y}/2/0_0.png`],
      })) : [];
  return jsonResponse({ products, radar: { available: frames.length > 0, frames, maxzoom: 7,
    source: "RainViewer radar composite", tier: "radar-observation", fetchedAt: radar?.fetchedAt ?? null,
    coverageTiles: ["https://tilecache.rainviewer.com/v2/coverage/0/256/{z}/{x}/{y}/0/0_0.png"],
    sourceUrl: "https://www.rainviewer.com", termsUrl: "https://www.rainviewer.com/api.html" },
    fetchedAt: new Date().toISOString(),
  }, { headers: { "cache-control": "public, max-age=120" } });
}
function forecastRequestUrl(): string {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", RAIN_POINTS.map(p => p.lat).join(","));
  url.searchParams.set("longitude", RAIN_POINTS.map(p => p.lng).join(","));
  url.searchParams.set("current", "precipitation,rain,wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl");
  url.searchParams.set("hourly", "precipitation,precipitation_probability");
  url.searchParams.set("forecast_days", "3");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "UTC");
  return url.toString();
}
function boundedNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}
function unitNumber(row: any, field: string, units: string[], min: number, max: number, ok: boolean): number | null {
  return ok && units.includes(row?.current_units?.[field]) ? boundedNumber(row?.current?.[field], min, max) : null;
}
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
async function loadWeatherPoints(): Promise<{ points: any[]; fetchedAt: string | null }> {
  const provider = await fetchEnvironmentProvider(forecastRequestUrl(), "json", 600);
  const body = Array.isArray(provider?.body) ? provider.body : [];
  const points = RAIN_POINTS.map((p, i) => {
    const d = body[i]; const time = normalizedUtc(d?.current?.time);
    const valid = d?.utc_offset_seconds === 0 && d?.current_units?.precipitation === "mm"
      && d?.hourly_units?.precipitation === "mm" && !!time && validObservation(time, 3 * 3600000)
      && Number.isFinite(d?.latitude) && Number.isFinite(d?.longitude)
      && distanceKm(p.lat, p.lng, d.latitude, d.longitude) <= 20;
    const forecastStart = time ? Math.ceil(Date.parse(time) / 3600000) * 3600000 : NaN;
    const times = Array.isArray(d?.hourly?.time) ? d.hourly.time : [];
    const forecast = valid ? times.flatMap((t: unknown, j: number) => {
      const stamp = normalizedUtc(t), mm = positiveValue(d.hourly.precipitation?.[j]);
      const probability = positiveValue(d.hourly.precipitation_probability?.[j]);
      return stamp && Date.parse(stamp) > forecastStart && Date.parse(stamp) <= forecastStart + 24 * 3600000
        ? [{ validAt: stamp, precipitationMm: mm, probabilityPct: probability != null && probability <= 100 ? probability : null }] : [];
    }) : [];
    const total = forecast.length === 24 && forecast.every((f: any, i: number) => f.precipitationMm !== null && Date.parse(f.validAt) === forecastStart + (i + 1) * 3600000)
      ? Math.round(forecast.reduce((sum: number, f: any) => sum + f.precipitationMm, 0) * 100) / 100 : null;
    const windOk = valid && d?.current_units?.wind_speed_10m === "km/h" && d?.current_units?.wind_gusts_10m === "km/h";
    return { ...p, available: valid, validAt: valid ? time : null,
      forecastFromUtc: valid ? new Date(forecastStart).toISOString() : null,
      forecastToUtc: valid ? new Date(forecastStart + 24 * 3600000).toISOString() : null,
      precipitationMm: valid ? positiveValue(d.current.precipitation) : null,
      intervalSeconds: valid && typeof d.current.interval === "number" && d.current.interval > 0 ? d.current.interval : null,
      windKph: windOk ? boundedNumber(d.current.wind_speed_10m, 0, 300) : null,
      gustKph: windOk ? boundedNumber(d.current.wind_gusts_10m, 0, 300) : null,
      windFromDeg: unitNumber(d, "wind_direction_10m", ["°"], 0, 360, valid),
      pressureHpa: unitNumber(d, "pressure_msl", ["hPa"], 870, 1080, valid),
      next24hMm: total, forecast, modelLocation: valid ? { lat: d.latitude, lng: d.longitude } : null };
  });
  return { points, fetchedAt: provider?.fetchedAt ?? null };
}
async function handleRainfall(): Promise<Response> {
  const { points, fetchedAt } = await loadWeatherPoints();
  return jsonResponse({ points, source: "Open-Meteo weather models", tier: "model-estimate-and-forecast",
    fetchedAt, sourceUrl: "https://open-meteo.com/en/docs", timezone: "UTC",
  }, { status: points.some(p => p.available) ? 200 : 503, headers: { "cache-control": "public, max-age=600" } });
}

const WATCH_RAIN_ACTION = "People should avoid low streets at this sample. An administrator should inspect the satellite surface-water layer before closing a road. Model rain is not a flood map.";
const WATCH_WIND_ACTION = "People should secure loose materials and stay off exposed rooftops. An administrator should check cranes and trees at this sample. A gust is not a tropical depression.";
const WATCH_PRESSURE_ACTION = "Pressure at this sample is below 1000 hPa. Read it beside the storm list. Pressure alone does not name a tropical depression.";
const WATCH_STORM_ACTION = "A listed tropical cyclone is within 800 km. People should follow the national weather service. An administrator should read the Himawari cloud layer with the official track, not this distance alone.";
const WATCH_AIR_ACTION = "People should limit long outdoor exertion while this sample stays at or above US AQI 151. An administrator should open the aerosol layer. This point is a model, not a street monitor.";

function gdacsIsCurrent(properties: any): boolean {
  const flag = properties?.iscurrent;
  if (flag === true || flag === "true") {
    const end = normalizedUtc(properties?.todate);
    return !end || Date.parse(end) >= Date.now() - 6 * 3600000;
  }
  if (flag === false || flag === "false") return false;
  const end = normalizedUtc(properties?.todate);
  return !!end && Date.parse(end) >= Date.now() - 6 * 3600000;
}
async function handleCityWatch(): Promise<Response> {
  const airUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  airUrl.searchParams.set("latitude", RAIN_POINTS.map(p => p.lat).join(","));
  airUrl.searchParams.set("longitude", RAIN_POINTS.map(p => p.lng).join(","));
  airUrl.searchParams.set("current", "pm2_5,pm10,us_aqi");
  airUrl.searchParams.set("timezone", "UTC");
  const [weather, airFeed, stormFeed] = await Promise.all([
    loadWeatherPoints(),
    fetchEnvironmentProvider(airUrl.toString(), "json", 600),
    fetchEnvironmentProvider("https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC", "json", 300),
  ]);
  const airRows = Array.isArray(airFeed?.body) ? airFeed.body : [];
  const places = weather.points.map((point, i) => {
    const { forecast: _forecast, ...place } = point;
    const row = airRows[i];
    const time = normalizedUtc(row?.current?.time);
    const located = row?.utc_offset_seconds === 0 && !!time && validObservation(time, 3 * 3600000)
      && Number.isFinite(row?.latitude) && Number.isFinite(row?.longitude)
      && distanceKm(point.lat, point.lng, row.latitude, row.longitude) <= 35;
    const pm25 = unitNumber(row, "pm2_5", ["μg/m³", "µg/m³"], 0, 1000, located);
    const pm10 = unitNumber(row, "pm10", ["μg/m³", "µg/m³"], 0, 1000, located);
    const usAqi = unitNumber(row, "us_aqi", ["USAQI"], 0, 500, located);
    return {
      ...place,
      air: { available: located && (pm25 != null || usAqi != null), pm25, pm10, usAqi, validAt: located ? time : null,
        source: "Open-Meteo / CAMS", tier: "model-estimate" },
    };
  });
  const features = stormFeed && stormFeed.body?.type === "FeatureCollection" && Array.isArray(stormFeed.body.features) ? stormFeed.body.features : null;
  const systems = (features || []).flatMap((feature: any) => {
    const props = feature?.properties;
    const coordinates = feature?.geometry?.type === "Point" ? feature.geometry.coordinates : null;
    if (props?.eventtype !== "TC" || !gdacsIsCurrent(props) || !Array.isArray(coordinates)) return [];
    const lng = Number(coordinates[0]), lat = Number(coordinates[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];
    const distance = distanceKm(CITY_CENTRE.lat, CITY_CENTRE.lng, lat, lng);
    if (distance > 800) return [];
    return [{
      id: props.eventid ?? null, name: typeof props.name === "string" ? props.name : "Unnamed cyclone",
      alertLevel: typeof props.alertlevel === "string" ? props.alertlevel : null,
      distanceKm: Math.round(distance), lat, lng, validTo: normalizedUtc(props.todate),
    }];
  }).sort((a: any, b: any) => a.distanceKm - b.distanceKm).slice(0, 3);
  const notices: any[] = [];
  const rainy = places.filter(p => p.available && (
    (p.precipitationMm != null && p.precipitationMm >= 10 && p.intervalSeconds != null && p.intervalSeconds <= 3600)
    || (p.next24hMm != null && p.next24hMm >= 50)));
  const wettest = rainy.sort((a, b) => (b.next24hMm ?? -1) - (a.next24hMm ?? -1))[0];
  if (wettest) notices.push({ id: "rain-" + wettest.id, topic: "rain", placeId: wettest.id, level: "watch",
    statement: wettest.name + " model rain is " + wettest.precipitationMm + " mm in the current interval and " + wettest.next24hMm + " mm over the next 24 hours.",
    action: WATCH_RAIN_ACTION, basis: "10 mm in a model interval of at most one hour, or 50 mm across the next complete 24 model hours.",
    source: "Open-Meteo weather models", tier: "model-estimate-and-forecast", validAt: wettest.validAt });
  const gusty = places.filter(p => p.gustKph != null && p.gustKph >= 75).sort((a, b) => b.gustKph - a.gustKph)[0];
  if (gusty) notices.push({ id: "wind-" + gusty.id, topic: "wind", placeId: gusty.id, level: "watch",
    statement: gusty.name + " model gust is " + gusty.gustKph + " km/h.", action: WATCH_WIND_ACTION,
    basis: "75 km/h model gust. This is not a tropical-depression classification.",
    source: "Open-Meteo weather models", tier: "model-estimate-and-forecast", validAt: gusty.validAt });
  const low = places.filter(p => p.pressureHpa != null && p.pressureHpa < 1000).sort((a, b) => a.pressureHpa - b.pressureHpa)[0];
  if (low) notices.push({ id: "pressure-" + low.id, topic: "pressure", placeId: low.id, level: "watch",
    statement: low.name + " model pressure is " + low.pressureHpa + " hPa.", action: WATCH_PRESSURE_ACTION,
    basis: "Model sea-level pressure below 1000 hPa. Pressure alone does not name a tropical depression.",
    source: "Open-Meteo weather models", tier: "model-estimate-and-forecast", validAt: low.validAt });
  for (const system of systems) notices.push({ id: "storm-" + system.id, topic: "storm", placeId: null, level: "watch",
    statement: system.name + " is listed " + system.distanceKm + " km from the city centre.", action: WATCH_STORM_ACTION,
    basis: "Current GDACS tropical cyclone within 800 km of 6.18 S, 106.83 E.",
    source: "GDACS", tier: "event-list", validAt: system.validTo });
  const dirtiest = places.filter(p => p.air?.usAqi != null && p.air.usAqi >= 151).sort((a, b) => b.air.usAqi - a.air.usAqi)[0];
  if (dirtiest) notices.push({ id: "air-" + dirtiest.id, topic: "air", placeId: dirtiest.id, level: "watch",
    statement: dirtiest.name + " model US AQI is " + dirtiest.air.usAqi + " and PM2.5 is " + dirtiest.air.pm25 + " µg/m³.",
    action: WATCH_AIR_ACTION, basis: "Open-Meteo US AQI at or above 151. The category may be driven by a pollutant other than PM2.5.",
    source: "Open-Meteo / CAMS", tier: "model-estimate", validAt: dirtiest.air.validAt });
  return jsonResponse({
    places, notices,
    storm: { available: features != null, systems, radiusKm: 800, source: "GDACS", tier: "event-list",
      fetchedAt: stormFeed?.fetchedAt ?? null, sourceUrl: "https://www.gdacs.org/" },
    traffic: { congestion: "unavailable", reason: "No open live feed for Jakarta street congestion or TransJakarta positions is wired into this atlas." },
    flood: { surveyed: false, reason: "Satellite surface water is a separate dated overlay. This response does not convert it into a flooded-street list." },
    source: "Open-Meteo, CAMS, GDACS", tier: "mixed-open-data",
    fetchedAt: new Date().toISOString(),
  }, { status: places.some(p => p.available) || features != null ? 200 : 503, headers: { "cache-control": "public, max-age=120" } });
}


// Open-Meteo / CAMS air quality at the five sample points. Model estimates,
// not monitoring stations; each row keeps its valid time.
async function loadAirPoints(): Promise<{ points: any[]; fetchedAt: string | null }> {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", RAIN_POINTS.map(p => p.lat).join(","));
  url.searchParams.set("longitude", RAIN_POINTS.map(p => p.lng).join(","));
  url.searchParams.set("current", "pm2_5,pm10,us_aqi");
  url.searchParams.set("timezone", "UTC");
  const feed = await fetchEnvironmentProvider(url.toString(), "json", 600);
  const rows = Array.isArray(feed?.body) ? feed.body : [];
  const points = RAIN_POINTS.map((p, i) => {
    const row = rows[i];
    const time = normalizedUtc(row?.current?.time);
    const located = row?.utc_offset_seconds === 0 && !!time && validObservation(time, 3 * 3600000)
      && Number.isFinite(row?.latitude) && Number.isFinite(row?.longitude)
      && distanceKm(p.lat, p.lng, row.latitude, row.longitude) <= 35;
    return {
      id: p.id, label: p.name, label_id: p.name_id, lat: p.lat, lng: p.lng,
      aqi: unitNumber(row, "us_aqi", ["USAQI"], 0, 500, located),
      pm25: unitNumber(row, "pm2_5", ["μg/m³", "µg/m³"], 0, 1000, located),
      pm10: unitNumber(row, "pm10", ["μg/m³", "µg/m³"], 0, 1000, located),
      observedAt: located ? time : null,
      modelLocation: located ? { lat: row.latitude, lng: row.longitude } : null,
      provenance: { source: "Open-Meteo / CAMS", tier: "model-estimate" },
    };
  });
  return { points, fetchedAt: feed?.fetchedAt ?? null };
}

function aqiCategory(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

async function handleAirQuality(): Promise<Response> {
  const { points } = await loadAirPoints();
  const rows = points.filter(p => p.aqi != null).map(p => ({ ...p, category: aqiCategory(p.aqi) }));
  if (!rows.length) return jsonResponse({ error: "air_quality_unavailable" }, { status: 503 });
  return jsonResponse(rows, { headers: { "cache-control": "public, max-age=300" } });
}

// ── /api/health — quick liveness probe ────────────────────────────────────

async function handleHealth(env: Env): Promise<Response> {
  const head = await env.JAKARTA_TILES.head(PMTILES_R2_KEY).catch(() => null);
  return jsonResponse({
    tool: "health",
    version: ATLAS_VERSION,
    ok: head !== null,
    pmtiles: head
      ? { available: true, sizeMb: head.size / (1024 * 1024) }
      : { available: false, sizeMb: null },
    bbox: CITY_BBOX,
    checkedAt: new Date().toISOString(),
  }, { status: head ? 200 : 503, headers: { "cache-control": "no-store" } });
}

// ── Router ────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await routeRequest(request, env);
    const headers = new Headers(response.headers);
    if (["/", "/index.html", "/atlas", "/atlas/"].includes(new URL(request.url).pathname)) headers.set("cache-control", "no-cache");
    if (response.status >= 500) headers.set("cache-control", "no-store");
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "strict-origin-when-cross-origin");
    headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
    headers.set("content-security-policy", "default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; connect-src 'self' https://api.open-meteo.com https://services.arcgisonline.com https://tile.openstreetmap.org https://demotiles.maplibre.org https://gibs.earthdata.nasa.gov https://tilecache.rainviewer.com https://air-quality-api.open-meteo.com; img-src 'self' data: blob: https://gibs.earthdata.nasa.gov; frame-src 'self' https://datastudio.google.com https://lookerstudio.google.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'");
    return new Response(request.method === "HEAD" ? null : response.body, { status: response.status, statusText: response.statusText, headers });
  },
};

async function routeRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, HEAD, OPTIONS",
        "access-control-allow-headers": "content-type, range",
        "access-control-expose-headers": "Accept-Ranges, Content-Length, Content-Range, ETag",
        "access-control-max-age": "86400",
      },
    });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("method not allowed", { status: 405, headers: { allow: "GET, HEAD, OPTIONS", "access-control-allow-origin": "*" } });
  }

  if (path.startsWith("/api/jakarta/")) return handleJakarta(request);
  if (["/", "/index.html", "/atlas", "/atlas/"].includes(path)) {
    const target = new URL(request.url);
    target.pathname = path.startsWith("/atlas") ? "/index.html" : "/dashboard.html";
    return env.ASSETS.fetch(new Request(target, request));
  }

  // PMTiles Range passthrough. pmtiles.js appends `?v=` cache busters, so
  // route by pathname only.
  if (path === PMTILES_PATH) return servePmtilesFromR2(request, env, PMTILES_R2_KEY);
  if (path === WATERWAYS_PMTILES_PATH) return servePmtilesFromR2(request, env, WATERWAYS_PMTILES_R2_KEY);

  if (path === "/api/atlas/environment") return handleEnvironment();
  if (path === "/api/atlas/rainfall") return handleRainfall();
  if (path === "/api/atlas/watch") return handleCityWatch();
  if (path === "/api/atlas/air-quality") return handleAirQuality();
  if (path === "/api/atlas/areas") return handleAreas(request, env);
  if (path === "/api/atlas/districts") return handleDistricts();
  if (path === "/api/atlas/at-this-point") return handleAtThisPoint(request, env);
  if (path === "/api/atlas/buildings") return handleBuildings(request, env);
  if (path === "/api/health") return handleHealth(env);

  const asset = await env.ASSETS.fetch(request);
  const headers = new Headers(asset.headers);
  headers.set("access-control-allow-origin", "*");
  return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
}
