// JKTx 3D Atlas -- full MapLibre client. Ported from hcmc-3d-atlas.
//
// Loads curated places, renders Jakarta in 3D from baked Overture
// footprints, lets the visitor click any building for its height
// provenance, and overlays OSM rail and waterways plus open environmental
// layers. There is no operations dashboard behind this atlas, so there are
// no sensor, bus or incident feeds.

// loader.js imports the pinned MapLibre module before this client.
// PMTiles uses its pinned UMD global.
const __maplibregl__ = window.maplibregl;
const __pmtiles__ = window.pmtiles;

if (!__maplibregl__ || !__pmtiles__) {
  const el = document.getElementById("atlas-map-loading");
  if (el) {
    el.innerHTML =
      '<div class="atlas-map-loading-inner">' +
      '<span class="atlas-map-loading-glyph">Jx</span>' +
      '<p class="atlas-map-loading-line">MapLibre failed to load</p>' +
      '<p class="atlas-map-loading-sub">Map libraries are unavailable. Reload to retry, or use Data &amp; sources below.</p>' +
      "</div>";
  }
  console.error("maplibregl/pmtiles not on window -- script order issue");
}

const ATLAS_BASE = ""; // same origin
const CITY_CENTER = [106.8230, -6.1950]; // Bundaran HI, looking down Sudirman

const ESRI_IMAGERY =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const $ = function (sel, root) {
  return (root || document).querySelector(sel);
};
const $$ = function (sel, root) {
  return Array.prototype.slice.call((root || document).querySelectorAll(sel));
};

// ── State ──────────────────────────────────────────────────────────────────
let areasDoc = null;
let mapInstance = null;
// Build tag sent to an embedding page in the `jakarta-atlas` ready
// postMessage. `scripts/stamp-build-id.mjs` rewrites this on every
// deploy so the dashboard can detect a stale iframe bundle.
const ATLAS_BUILD_TAG = "jakarta-atlas-20261106-1793948812-9c5c39a";
// Append a build-tag query string to the PMTiles URLs so every deploy
// busts Cloudflare's edge cache. Without this, the first GET (which the
// protocol handler makes without a Range header) gets cached as 200 OK
// at the edge, and every subsequent Range request from pmtiles.js reads
// back that cached 200 with the FULL content-length -- the protocol then
// throws "Server returned no content-length header or content-length
// exceeding request" because the body is 10 MB but it only asked for 16 KB.
// pmtiles.js's Protocol() regex captures the path up to /z/x/y, so query
// strings before /z/x/y are part of the source URL and ride along on
// every Range fetch -- exactly the cache-buster we need.
const PMTILES_BUILDINGS = ATLAS_BASE + "/jakarta-buildings.pmtiles" + "?v=" + encodeURIComponent(ATLAS_BUILD_TAG);
const PMTILES_WATERWAYS = ATLAS_BASE + "/jakarta-waterways.pmtiles" + "?v=" + encodeURIComponent(ATLAS_BUILD_TAG);
let currentBasemap = "esri";
let currentView = "3d", saved3DPitch = 60, saved3DBearing = 160;
let currentAreaId = null;
let flyoverTimer = null;
let inspectFeature = null;
const liveCache = new Map();
const liveRequests = new Map();
// A refused request (HTTP 429) is not a broken source and not an empty one.
// The atlas client is a classic script, so the shared reader arrives as a
// module — the very file the lens modules import, so there is one rule and
// one instance of it in the browser.
const liveRefusals = new Map();
let refusalModule = null;
let refusalModulePromise = null;
function loadRefusalModule() {
  return refusalModulePromise ||= import("/refusal.js").then((module) => (refusalModule = module)).catch(error => { refusalModulePromise = null; throw error; });
}
// Used only if the shared reader cannot be loaded at all. It fails closed: a
// response that is not OK is an error, never a payload. A rule about how a
// failure is reported must never cost the reader their data, and it must
// never hand them a refusal's error body as if it were data either.
async function fallbackRead(response) {
  if (response.ok) return await response.json();
  throw new Error("source " + response.status);
}
// A static file is not rate limited, so a missing file is a missing file and
// never a refusal. It is read through a named helper rather than an inline
// conditional, so no response in this client is read the old way.
async function readStatic(response) {
  if (response.ok) return await response.json();
  return null;
}
// Read a response through the shared rule. The module is loaded by the first
// live request; if it has not arrived yet, it is asked for.
async function readApi(response) {
  const mod = refusalModule || await loadRefusalModule().catch(() => null);
  return mod ? await mod.readJson(response) : await fallbackRead(response);
}
// A fallback that was refused must not be reported as an outage either. The
// primary's own window is kept when there is one.
function noteRefusal(endpoint, error) {
  if (!error || error.refused !== true) return;
  if (!liveRefusals.has(endpoint)) liveRefusals.set(endpoint, error.retryAfterSeconds);
}
// The refusal for an endpoint, in the reader's language, or null when the
// request was not refused. The shared reader is loaded before any request is
// made, so its copy is available by the time a refusal is recorded.
function refusalFor(endpoint, form) {
  if (!liveRefusals.has(endpoint) || !refusalModule) return null;
  const seconds = liveRefusals.get(endpoint);
  return form === "label"
    ? refusalModule.refusalLabel(seconds, (en, id) => lensText(en, id))
    : refusalModule.refusalMessage(seconds, (en, id) => lensText(en, id));
}
let lastAirQuality = [];

// Jakarta/Palette 267: coastal blue structure with warm pointers. Hazard and
// transit colours keep their geographic meaning (context.md).
const MAP_THEMES = {
  dark: { buildings: ["#66848d", "#92aeb5", "#c3d4d7", "#edf7f5"], accent: "#fdbf68", civic: "#fdbf68", opacity: 0.8, saturation: -0.45, hazard: ["#3f5a6e", "#7f9a7a", "#c98a3c", "#d9534f"], green: "#2f7d63", water: "#3b82c4", sensor: "#3fb950" },
  light: { buildings: ["#647f83", "#91a7a8", "#bed0cf", "#e6f0ec"], accent: "#985200", civic: "#985200", opacity: 0.65, saturation: -0.6, hazard: ["#8aa0ab", "#b08a4a", "#b45309", "#b91c1c"], green: "#1f6b52", water: "#1d4ed8", sensor: "#15803d" },
  contrast: { buildings: ["#91a7a8", "#bed0cf", "#edf7f5", "#f6fff9"], accent: "#ffcf7d", civic: "#ffcf7d", opacity: 0.45, saturation: -1, hazard: ["#ffffff", "#ffcf7d", "#ffa94d", "#ff6b6b"], green: "#1f6b52", water: "#1d4ed8", sensor: "#15803d" },
};
function mapTheme() { return MAP_THEMES[document.documentElement.dataset.theme] || MAP_THEMES.dark; }
// "height" colours by height; "confidence" colours by where the height came from.
// Both read the same four theme stops, so the confidence lens introduces no new
// colour and the legend can order the tiers from observed to assumed.
let buildingPaintMode = "height";
function buildingThemeColor() {
  const colors = mapTheme().buildings;
  if (buildingPaintMode === "confidence") {
    return ["case", ["!", ["has", "hs"]], colors[0],
      ["match", ["get", "hs"],
        "measured", colors[3], "landmark", colors[3], "google", colors[2],
        "floors", colors[1], "ghsl", colors[1], colors[0]]];
  }
  return ["interpolate", ["linear"], HEIGHT_GET, 6, colors[0], 20, colors[1], 60, colors[2], 150, colors[3]];
}
function applyMapTheme() {
  if (!mapInstance) return;
  const palette = mapTheme();
  const paints = {
    "esri-imagery": { "raster-opacity": palette.opacity, "raster-saturation": palette.saturation },
    "jkt-buildings": { "fill-extrusion-color": ["case", ["boolean", ["feature-state", "selected"], false], palette.accent, buildingThemeColor()] },
    "jkt-buildings-outline": { "line-color": palette.accent },
    "jkt-landmarks-3d": { "fill-extrusion-color": ["match", ["get", "category"], "civic", palette.civic, palette.accent] },
    "jkt-landmarks-outline": { "line-color": palette.accent },
    "jkt-dashboard-selection-fill": { "fill-color": palette.accent },
    "jkt-dashboard-selection-line": { "line-color": palette.accent },
    "jkt-dashboard-selection-point": { "circle-color": palette.accent },
    "insight-green": { "fill-color": palette.green },
    "insight-stations": { "circle-color": ["match", ["get", "__kind"], 0, palette.water, 1, palette.accent, 2, palette.sensor, 3, palette.civic, palette.green] },
  };
  Object.keys(paints).forEach(function (id) {
    if (!mapInstance.getLayer(id)) return;
    Object.keys(paints[id]).forEach(function (property) { mapInstance.setPaintProperty(id, property, paints[id][property]); });
  });
}
window.addEventListener("atlas:theme", applyMapTheme);
// The exposure lens shades by a quartile of its own measured spread, so the four
// hazard stops are rebuilt on every theme change rather than baked into the layer.
// Separate from applyMapTheme, which must not grow a dependency on the data views.
function repaintExposureLayer() {
  if (!mapInstance || !mapInstance.getLayer('insight-risk') || !insightData) return;
  const rows = insightData.exposure.kelurahan;
  const cuts = quantileBands(rows.map(r => r.exposureScore), 0.25);
  const hazard = mapTheme().hazard;
  const byCode = ['match', ['get', '__code']];
  rows.forEach(r => byCode.push(r.kelurahanCode, hazard[bandOf(r.exposureScore, cuts)]));
  byCode.push(hazard[0]);
  mapInstance.setPaintProperty('insight-risk', 'fill-color', byCode);
}
window.addEventListener('atlas:theme', repaintExposureLayer);

// ── Helpers ────────────────────────────────────────────────────────────────
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PARENT_ORIGINS = [
  "https://jakarta.nonarkara.org",
  "https://jakarta-3d-atlas.drnon.workers.dev",
];

function parentTargetOrigin() {
  try {
    if (document.referrer) {
      const origin = new URL(document.referrer).origin;
      if (PARENT_ORIGINS.indexOf(origin) !== -1) return origin;
    }
  } catch (e) {} // axiom-audit-ignore honesty -- Invalid parent referrer falls back to same origin; no data readings are fabricated.
  return window.location.origin;
}

function fmtNum(n, digits) {
  if (n === null || n === undefined || Number.isNaN(n)) return "--";
  return Number(n).toLocaleString(window.AtlasLanguage?.language() === "id" ? "id-ID" : "en-US", {
    minimumFractionDigits: digits || 0,
    maximumFractionDigits: digits || 0,
  });
}

function hideLoading() {
  const el = document.getElementById("atlas-map-loading");
  if (!el) return;
  el.style.transition = "opacity 220ms ease-out";
  el.style.opacity = "0";
  setTimeout(function () { el.style.display = "none"; }, 240);
}

function showToast(msg, ttl) {
  let el = document.getElementById("atlas-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "atlas-toast";
    el.className = "atlas-toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("atlas-toast--visible");
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(function () {
    el.classList.remove("atlas-toast--visible");
  }, ttl || 2200);
}

// Register pmtiles:// protocol once
if (__pmtiles__ && __maplibregl__) {
  const pmtilesProtocol = new __pmtiles__.Protocol();
  __maplibregl__.addProtocol("pmtiles", pmtilesProtocol.tile);
}

// ── Map setup ──────────────────────────────────────────────────────────────
try {
  if (__maplibregl__ && __pmtiles__) {
mapInstance = new __maplibregl__.Map({
  container: "atlas-map",
  style: {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>' },
      esri: {
        type: "raster",
        tiles: [ESRI_IMAGERY],
        tileSize: 256,
        maxzoom: 19,
        attribution: "(c) Esri World Imagery",
      },
    },
    // Late-afternoon sun from the south-west so facades shade differently
    // and the blocks read as volumes. Lighting, not a drop shadow.
    light: { anchor: "map", position: [1.4, 210, 35], color: "#fff4e0", intensity: 0.45 },
    layers: [{ id: "osm-streets", type: "raster", source: "osm", layout: { visibility: "none" } }, {
      id: "esri-imagery",
      type: "raster",
      source: "esri",
      // Muted like bkk-3d-atlas so the buildings, not the imagery, carry the eye.
      paint: { "raster-opacity": mapTheme().opacity, "raster-saturation": mapTheme().saturation, "raster-contrast": 0.05 },
    }],
  },
  center: CITY_CENTER,
  zoom: 15.2,
  pitch: 60,
  bearing: 160,
  minZoom: 9,
  maxZoom: 18,
  renderWorldCopies: false,
  maxPitch: 70,
  hash: false,
  attributionControl: { compact: true, customAttribution: "Heights: Google 2.5D / GHSL / OSM / estimates" },
});

  }
} catch (e) {
  console.warn("[atlas] map unavailable:", e.message);
  const el = document.getElementById("atlas-map-loading");
  if (el) el.textContent = "3D rendering is unavailable on this device. Use Data & sources below.";
}

if (mapInstance) {

requestAnimationFrame(function () { mapInstance.resize(); });

// Resolves once the style object exists. Registered here, at construction,
// because boot() awaits a fetch first: by then `style.load` may already have
// fired, and isStyleLoaded() stays false while satellite tiles are still
// loading -- so waiting for the event *after* the fetch could wait forever
// and the city layers would randomly never appear.


// Hide loading overlay once MapLibre has rendered at least one tile.
// A stuck overlay is worse than a brief flash, so we hide on:
//   1. `idle`  -- the normal "everything in viewport rendered" signal
//   2. `render` + loaded() -- mid-flight, just hide if we've drawn once
//   3. `error` -- a tile-source failure (e.g. PMTiles Range/cache glitch)
//      should NOT leave the user staring at the spinner; the map is still
//      usable via the basemap + waterways + metro layers
//   4. hard 4.5s timeout -- last-resort guarantee
let loadingHidden = false;
function hideLoadingIfReady(force) {
  if (loadingHidden) return;
  // isStyleLoaded() stays false while any one source is erroring, so the
  // error and timeout paths force it -- a broken layer must not blank the map.
  if (force !== true && !mapInstance.isStyleLoaded()) return;
  loadingHidden = true;
  hideLoading();
}
mapInstance.on("idle", function () {
  hideLoadingIfReady();
  if (!mapInstance.__atlasTileError) setToggleLabel("atlas-map-status", "Map ready. Buildings appear from zoom 12; choose a place in Quick jump.");
});
mapInstance.on("render", function () { if (mapInstance.loaded()) hideLoadingIfReady(); });
mapInstance.on("error", function (e) {
  // Log it so the developer can see why a tile failed, but never let it
  // block the loading overlay -- the user wants to interact with the rest
  // of the map even if one source is broken.
  mapInstance.__atlasTileError = true;
  if (e && e.error) console.warn("[atlas] tile error:", e.error.message || e.error);
  setToggleLabel("atlas-map-status", "Some map data could not load. Reload to retry; the text data below remains available.");
  hideLoadingIfReady(true);
});
setTimeout(function () { hideLoadingIfReady(true); }, 4500);

mapInstance.addControl(
  new __maplibregl__.NavigationControl({ visualizePitch: true }),
  "bottom-right",
);
mapInstance.addControl(new __maplibregl__.ScaleControl({ unit: "metric" }), "bottom-left");

}

const styleReady = new Promise(function (resolve) {
  if (!mapInstance || mapInstance.style && mapInstance.style._loaded) resolve();
  else mapInstance.once("style.load", resolve);
});

// ── Building height + paint ────────────────────────────────────────────────
// Real metres, no multiplier. Unsupported or corrupt heights stay flat.
// Legacy PMTiles use hs=estimated for class defaults; retain their footprints
// without presenting those guesses as observed urban form.
const HEIGHT_RAW = ["to-number", ["coalesce", ["get", "h"], ["get", "render_height"], ["get", "height"]], 0];
const HEIGHT_KNOWN = ["all", ["in", ["get", "hs"], ["literal", ["measured", "floors", "google", "ghsl", "satellite"]]], [">=", HEIGHT_RAW, 1], ["<=", HEIGHT_RAW, 500]];
const HEIGHT_GET = ["case", HEIGHT_KNOWN, HEIGHT_RAW, 0];
function supportedBuildingHeight(props) {
  const value = Number(props.h ?? props.render_height ?? props.height ?? 0);
  return ['measured','floors','google','ghsl','satellite'].includes(props.hs) && Number.isFinite(value) && value >= 1 && value <= 500 ? value : 0;
}
// Base must stay strictly below height -- base >= height makes MapLibre
// emit degenerate roof triangles that read as sawteeth.
const BASE_RAW = ["to-number", ["coalesce", ["get", "b"], ["get", "render_min_height"], ["get", "min_height"]], 0];
const BASE_GET = ["case", [">=", BASE_RAW, HEIGHT_GET], 0, ["max", 0, BASE_RAW]];
const LANDMARK_HEIGHT_RAW = ["to-number", ["get", "height"], 0];
const LANDMARK_HEIGHT_GET = ["case", ["all", [">=", LANDMARK_HEIGHT_RAW, 1], ["<=", LANDMARK_HEIGHT_RAW, 500]], LANDMARK_HEIGHT_RAW, 0];
const LANDMARK_BASE_RAW = ["to-number", ["get", "base_height"], 0];
const LANDMARK_BASE_GET = ["case", [">=", LANDMARK_BASE_RAW, LANDMARK_HEIGHT_GET], 0, ["max", 0, LANDMARK_BASE_RAW]];

// One neutral body; height only lifts the value a little so towers catch
// light. The single amber belongs to landmarks and selection.
const BUILDING_COLOR = [
  "interpolate", ["linear"], HEIGHT_GET,
  6,   "#b9b2a4",
  20,  "#d6cfbf",
  60,  "#e8e2d4",
  150, "#f4f0e6",
];

// Opacity hits 1.0 by street zoom -- translucent fill-extrusion z-fights
// into glittery roof shards on Chrome/macOS.
const BUILDING_OPACITY = ["interpolate", ["linear"], ["zoom"], 11, 0.6, 13, 0.88, 14.5, 1];

const HEIGHT_SOURCE_LABEL = {
  measured: "tagged (OSM / survey; date unverified)",
  floors: "estimate: floor count × 3.3 m; date unverified",
  google: "satellite, this building (Google Open Buildings 2.5D, 2023)",
  ghsl: "satellite, 100 m area average (GHSL, 2018)",
  satellite: "satellite, 100 m area average (GHSL, 2018)",
  estimated: "unknown height; footprint only",
};

const FOOTPRINT_SOURCE_LABEL = {
  osm: "OpenStreetMap",
  ms: "Microsoft ML (satellite)",
  google: "Google Open Buildings (satellite)",
};

function addBuildings() {
  mapInstance.addSource("jkt-buildings-src", {
    type: "vector",
    url: "pmtiles://" + PMTILES_BUILDINGS,
    maxzoom: 15,
    attribution: "(c) OpenStreetMap, Microsoft, Google via Overture Maps",
  });
  mapInstance.addLayer({
    id: "jkt-buildings",
    type: "fill-extrusion",
    source: "jkt-buildings-src",
    "source-layer": "buildings",
    minzoom: 12,
    paint: {
      "fill-extrusion-color": [
        "case",
        ["boolean", ["feature-state", "selected"], false], "#f59e0b",
        BUILDING_COLOR,
      ],
      "fill-extrusion-height": HEIGHT_GET,
      "fill-extrusion-base": BASE_GET,
      "fill-extrusion-opacity": BUILDING_OPACITY,
      "fill-extrusion-vertical-gradient": true,
    },
  });
  // Building outlines on hover/select (feature-state)
  mapInstance.addLayer({
    id: "jkt-buildings-outline",
    type: "line",
    source: "jkt-buildings-src",
    "source-layer": "buildings",
    minzoom: 14.5,
    paint: {
      "line-color": "#f59e0b",
      "line-width": [
        "case",
        ["boolean", ["feature-state", "selected"], false], 2.5,
        ["boolean", ["feature-state", "hover"], false], 1.2,
        0,
      ],
      "line-opacity": [
        "case",
        ["boolean", ["feature-state", "selected"], false], 0.95,
        ["boolean", ["feature-state", "hover"], false], 0.55,
        0,
      ],
    },
  });
}

function addWaterways() {
  mapInstance.addSource("jkt-waterways-src", {
    type: "vector",
    url: "pmtiles://" + PMTILES_WATERWAYS,
    attribution: "(c) OpenStreetMap contributors",
  });
  mapInstance.addLayer({
    id: "waterways-line",
    type: "line",
    source: "jkt-waterways-src",
    "source-layer": "waterways",
    minzoom: 10,
    paint: {
      "line-color": "#1d4ed8", // axiom-audit-ignore colors -- Existing hydrography symbol colour, not an interface accent; geographic exception in context.md.
      "line-width": [
        "interpolate", ["linear"], ["zoom"],
        10, 0.4,
        13, 1.2,
        16, 2.4,
      ],
      "line-opacity": 0.75,
    },
  });
}

// ── Rail (OSM route relations: MRT, LRT, KRL) ────────────────────────────
// Track geometry as mapped in OSM, coloured by the route's own `colour` tag
// when it has one, otherwise by mode. scripts/bake-osm-layers.py rail.
// axiom-audit-ignore-next-line colors -- Existing OSM mode fallback symbols; route colour tags take priority and are independent of brand colours.
const RAIL_MODE_COLOR = ["match", ["get", "mode"], "subway", "#dc2626", "light_rail", "#a855f7", "#2f80c0"];
async function addRail() {
  let doc;
  try {
    const r = await fetch(ATLAS_BASE + "/jakarta-rail.geojson", { cache: "no-store" });
    if (!r.ok) throw new Error("rail " + r.status);
    doc = await r.json();
  } catch (e) {
    console.warn("[atlas] rail unavailable:", e.message);
    return;
  }
  mapInstance.addSource("rail-src", { type: "geojson", data: doc, attribution: "Rail (c) OpenStreetMap contributors" });
  const colour = ["case", ["has", "colour"], ["to-color", ["get", "colour"], RAIL_MODE_COLOR], RAIL_MODE_COLOR];
  mapInstance.addLayer({
    id: "rail-line",
    type: "line",
    source: "rail-src",
    filter: ["==", ["geometry-type"], "LineString"],
    minzoom: 9,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": colour,
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1, 13, 2.5, 16, 4],
      "line-opacity": 0.9,
    },
  }, mapInstance.getLayer("jkt-buildings") ? "jkt-buildings" : undefined);
  mapInstance.addLayer({
    id: "rail-stations",
    type: "circle",
    source: "rail-src",
    filter: ["==", ["geometry-type"], "Point"],
    minzoom: 12,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2.5, 14, 5, 16, 7],
      "circle-color": "#edf7f5",
      "circle-stroke-color": colour,
      "circle-stroke-width": 2,
    },
  });
  mapInstance.addLayer({
    id: "rail-stations-label",
    type: "symbol",
    source: "rail-src",
    filter: ["==", ["geometry-type"], "Point"],
    minzoom: 13.5,
    layout: {
      "text-field": ["get", "name"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 13.5, 9, 16, 12],
      "text-offset": [0, 1.2],
      "text-anchor": "top",
      "text-allow-overlap": false,
      "text-optional": true,
    },
    paint: { "text-color": "#f1e7d0", "text-halo-color": "#0f1b33", "text-halo-width": 1.2 },
  });
  setLayerVisible("rail-stations", layerVisibility["rail-stations"] !== false);
  setLayerVisible("rail-line", layerVisibility["rail-line"] !== false);
}

// ── Air quality / aerosol (Open-Meteo) ────────────────────────────────────
// Open-Meteo / CAMS model values at the five sample points (/api/atlas/air-quality).
// Color follows AQI category.
async function addAirQuality() {
  const features = [];
  mapInstance.addSource("jkt-aqi-src", {
    type: "geojson",
    data: { type: "FeatureCollection", features: features },
    attribution: "Air-quality model: CAMS via Open-Meteo",
  });
  mapInstance.addLayer({
    id: "aqi-points",
    type: "circle",
    source: "jkt-aqi-src",
    minzoom: 10,
    paint: {
      "circle-radius": [
        "interpolate", ["linear"], ["zoom"],
        10, 6,
        16, 18,
      ],
      "circle-color": [
        "match",
        ["get", "category"],
        "Good", "#22c55e",
        "Moderate", "#facc15",
        "Unhealthy for Sensitive", "#f97316",
        "Unhealthy for Sensitive Groups", "#f97316",
        "Unhealthy", "#ef4444",
        "Very Unhealthy", "#a21caf",
        "Hazardous", "#7f1d1d",
        "#9ca3af",
      ],
      "circle-opacity": 0.7,
      "circle-stroke-color": "#0a0a0a",
      "circle-stroke-width": 0.6,
    },
  });
  mapInstance.addLayer({
    id: "aqi-labels",
    type: "symbol",
    source: "jkt-aqi-src",
    minzoom: 12,
    layout: {
      "text-field": ["concat", ["to-string", ["round", ["get", "aqi"]]], " AQI · model"],
      "text-size": 10,
      "text-offset": [0, 1.6],
      "text-anchor": "top",
      "text-optional": true,
    },
    paint: {
      "text-color": "#fde68a",
      "text-halo-color": "#0a0a0a",
      "text-halo-width": 1,
    },
  });
}

// ── Fire hotspots (NASA FIRMS via /api/atlas/fires) ──────────────────────
// NOAA-20 VIIRS thermal detections, last 24 h, Sumatra to Kalimantan. A
// detection is a hot pixel seen from orbit, not a confirmed fire. The fixed
// fire colour, like the AQI scale, is a data encoding rather than UI accent.
function addFires() {
  mapInstance.addSource("jkt-fires-src", {
    type: "geojson",
    data: firesData || { type: "FeatureCollection", features: [] },
    attribution: "Fire detections: NASA FIRMS (NOAA-20 VIIRS)",
  });
  mapInstance.addLayer({
    id: "fire-hotspots",
    type: "circle",
    source: "jkt-fires-src",
    minzoom: 4,
    paint: {
      // Small at regional zoom so ~10k detections stay readable; larger by fire radiative power.
      "circle-radius": ["interpolate", ["linear"], ["zoom"],
        4, ["interpolate", ["linear"], ["coalesce", ["get", "frp"], 1], 1, 1, 100, 2.5, 500, 4],
        10, ["interpolate", ["linear"], ["coalesce", ["get", "frp"], 1], 1, 3, 100, 6, 500, 10]],
      "circle-color": "#ff5a1f",
      "circle-opacity": ["match", ["get", "confidence"], "low", 0.45, 0.9],
      "circle-stroke-color": "#1a0a00",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 4, 0, 8, 0.6],
    },
  });
  setLayerVisible("fire-hotspots", layerVisibility["fire-hotspots"] !== false);
}
let firesData = null;
async function refreshFires(force) {
  if (force) liveCache.delete("/api/atlas/fires");
  const data = await fetchLive("/api/atlas/fires", 1800);
  const {researchFires}=await import("./research-session.js");
  firesData = researchFires(data);
  // A failed load retries in a minute, not at the next scheduled refresh.
  if (!firesData && !refreshFires.retry) refreshFires.retry = setTimeout(() => { refreshFires.retry = null; refreshFires(true); }, 60000);
  const src = mapInstance && mapInstance.getSource("jkt-fires-src");
  if (src) src.setData(firesData || { type: "FeatureCollection", features: [] });
  const refused = refusalFor("/api/atlas/fires", "label");
  setToggleLabel("atlas-fires-label", firesData ? lensText("Thermal detections · admitted 24 h", "Deteksi termal · lolos 24 jam") : refused ? lensText("Thermal detections · ", "Deteksi termal · ") + refused : lensText("Thermal detections · unavailable", "Deteksi termal · tidak tersedia"));
  if (activeLens === "haze") renderLensEvidence();
}

function applyCurrentFires(data) {
  firesData=data;
  const source=mapInstance?.getSource('jkt-fires-src');
  source?.setData(data||{type:'FeatureCollection',features:[]});
  const label=document.getElementById('haze-thermal-status');if(label)label.textContent=data?fmtNum(data.features.length,0)+' '+lensText('detections on map · retrieved ','deteksi pada peta · diambil ')+formatLocal(data.fetchedAt):lensText('No current thermal count available.','Jumlah termal terkini belum tersedia.');
}

// ── Hero landmarks — OSM footprints at published or curated heights for
// Autograph Tower, Gama Tower, Wisma 46, Monas, Istiqlal and the others
// (jakarta-landmarks.geojson, scripts/curate-landmarks.py). Part geometry
// and heights are a reference model, not an as-built survey.
async function addHeroLandmarks() {
  let doc;
  try {
    const r = await fetch(ATLAS_BASE + "/jakarta-landmarks.geojson", { cache: "no-store" });
    if (!r.ok) throw new Error("hero landmarks fetch " + r.status);
    doc = await r.json();
  } catch (e) {
    console.warn("[atlas] hero landmarks unavailable:", e.message);
    return;
  }
  const features = (doc.features || []).filter(function (f) {
    const g = f.geometry;
    return g && (g.type === "Polygon" || g.type === "MultiPolygon");
  });
  if (!features.length) {
    console.warn("[atlas] hero landmarks file has no polygon features");
    return;
  }

  const tallest = new Map();
  features.forEach(f => tallest.set(f.properties.name, Math.max(tallest.get(f.properties.name) || 0, Number(f.properties.height) || 0)));
  features.forEach(f => { f.properties.exploreHeight = tallest.get(f.properties.name); f.properties.exploreKind = 'landmark'; f.properties.exploreSource = 'landmark'; });
  mapInstance.addSource("jkt-landmarks-src", {
    type: "geojson",
    data: { type: "FeatureCollection", features: features },
    attribution: "Landmarks (c) OpenStreetMap",
  });

  // Landmarks carry the one accent. Real footprints from OSM, published
  // heights with a cited source (scripts/curate-landmarks.py); parts stack
  // via base_height so towers get their podium + shaft silhouette.
  mapInstance.addLayer({
    id: "jkt-landmarks-3d",
    type: "fill-extrusion",
    source: "jkt-landmarks-src",
    minzoom: 11,
    paint: {
      "fill-extrusion-color": ["match", ["get", "category"], "civic", "#e0a33a", "#f59e0b"],
      "fill-extrusion-height": LANDMARK_HEIGHT_GET,
      "fill-extrusion-base": LANDMARK_BASE_GET,
      "fill-extrusion-opacity": 1,
      "fill-extrusion-vertical-gradient": true,
    },
  });

  // Outline so the edges of the towers read crisply against the satellite.
  mapInstance.addLayer({
    id: "jkt-landmarks-outline",
    type: "line",
    source: "jkt-landmarks-src",
    paint: {
      "line-color": "#f59e0b",
      "line-width": 1,
      "line-opacity": 0.5,
    },
  });

  // Names appear when zoomed in past 13.5 — keep the city-scale view clean.
  mapInstance.addLayer({
    id: "jkt-landmarks-label",
    type: "symbol",
    source: "jkt-landmarks-src",
    minzoom: 13.5,
    filter: ["!=", ["get", "part"], true], // one label per landmark, not per part
    layout: {
      "text-field": ["get", "name"],
      "text-size": [
        "interpolate", ["linear"], ["zoom"],
        13.5, 9,
        16, 13,
      ],
      "text-offset": [0, 1.0],
      "text-anchor": "top",
      "text-optional": true,
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#fef9c3",
      "text-halo-color": "#0a0a0a",
      "text-halo-width": 1.4,
    },
  });

  applyMapTheme();
  setLayerVisible("jkt-landmarks-3d", layerVisibility["jkt-landmarks-3d"] !== false);
  applyMapLanguage();
  applyBuildingFilter(buildingFilterState);
  window.__cityHeroLandmarks = features.map(function (f) {
    return Object.assign({}, f.properties, { geometry: f.geometry });
  });
}

function applyAllLayers() {
  addBuildings();
  addHeroLandmarks();
  addWaterways();
  addRail();
  addAirQuality();
  addFires();
  applyMapTheme();
  // Ground lines go under the extrusions so towers occlude them, instead of
  // the rivers painting across building faces. addRail inserts its own line
  // below the buildings once its file arrives.
  ["waterways-line"].forEach(function (id) {
    if (mapInstance.getLayer(id)) mapInstance.moveLayer(id, "jkt-buildings");
  });
}

// ── Text evidence (available even when WebGL or map tiles fail) ───────────
function observationStale(stamp, maxAge) {
  const time = stamp ? Date.parse(stamp) : NaN;
  return !Number.isFinite(time) || time > Date.now() + 5 * 60000 || Date.now() - time > maxAge;
}
function observationLabel(stamp) {
  const time = stamp ? Date.parse(stamp) : NaN;
  if (!Number.isFinite(time)) return "Observation time unknown";
  if (time > Date.now() + 5 * 60000) return "Observation time is in the future; unverified";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  const age = minutes < 60 ? minutes + " min" : minutes < 1440 ? Math.floor(minutes / 60) + " h" : Math.floor(minutes / 1440) + " d";
  return age + " ago · " + new Date(time).toLocaleString(window.AtlasLanguage?.language() === "id" ? "id-ID" : "en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }) +  " WIB";
}
function evidenceCell(source, tier, stamp) {
  return escapeHtml(source || "Source unknown") + " · " + escapeHtml(tier || "unverified") + "<small>" + escapeHtml(observationLabel(stamp)) + "</small>";
}
// Open-Meteo throttles shared Cloudflare egress, so the Worker route can 503
// while the provider still answers a visitor's browser. Same gates as the
// Worker: matching coordinates, fresh UTC time, declared units, no zero-fill.
// Same rule as the Worker's airForecast: declared units, UTC hours from one
// hour ago, no zero-fill; any failed gate gives an empty list.
function browserAirForecast(row, near) {
  const h = row?.hourly, units = row?.hourly_units || {};
  if (!near || !Array.isArray(h?.time) || !(units.pm2_5 === "μg/m³" || units.pm2_5 === "µg/m³") || units.us_aqi !== "USAQI") return [];
  const from = Date.now() - 3600000;
  return h.time.flatMap((time, i) => {
    const t = typeof time === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time) ? time + "Z" : null;
    if (!t || !(Date.parse(t) >= from)) return [];
    const pm25 = boundedReading(h.pm2_5?.[i], 0, 1000), aqi = boundedReading(h.us_aqi?.[i], 0, 500);
    return pm25 == null && aqi == null ? [] : [{ t, pm25, aqi }];
  }).slice(0, 72);
}
async function fetchBrowserAirQuality() {
  const points = [
    { label: "Central Jakarta", label_id: "Jakarta Pusat", lat: -6.18, lng: 106.83 },
    { label: "North Jakarta", label_id: "Jakarta Utara", lat: -6.12, lng: 106.88 },
    { label: "West Jakarta", label_id: "Jakarta Barat", lat: -6.17, lng: 106.75 },
    { label: "South Jakarta", label_id: "Jakarta Selatan", lat: -6.27, lng: 106.81 },
    { label: "East Jakarta", label_id: "Jakarta Timur", lat: -6.23, lng: 106.90 },
  ];
  try {
    const response = await fetch("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" + points.map(p => p.lat).join(",") + "&longitude=" + points.map(p => p.lng).join(",") + "&current=pm2_5,us_aqi&hourly=pm2_5,us_aqi&forecast_days=3&timezone=UTC", { signal: AbortSignal.timeout(8000) });
    const rows = await readApi(response);
    if (!Array.isArray(rows) || rows.length !== points.length) return null;
    const category = aqi => aqi <= 50 ? "Good" : aqi <= 100 ? "Moderate" : aqi <= 150 ? "Unhealthy for Sensitive Groups" : aqi <= 200 ? "Unhealthy" : aqi <= 300 ? "Very Unhealthy" : "Hazardous";
    const out = points.flatMap((p, i) => {
      const row = rows[i], stamp = freshStamp(row?.current?.time), units = row?.current_units || {};
      const near = row?.utc_offset_seconds === 0 && !!stamp && Number.isFinite(row?.latitude) && Number.isFinite(row?.longitude) && Math.hypot((row.latitude-p.lat)*111,(row.longitude-p.lng)*110.4) <= 35;
      const aqi = near && units.us_aqi === "USAQI" ? boundedReading(row.current?.us_aqi, 0, 500) : null;
      const pm25 = near && (units.pm2_5 === "μg/m³" || units.pm2_5 === "µg/m³") ? boundedReading(row.current?.pm2_5, 0, 1000) : null;
      return aqi == null ? [] : [{ ...p, aqi, pm25, category: category(aqi), observedAt: stamp, forecast: browserAirForecast(row, near), provenance: { source: "Open-Meteo / CAMS", tier: "model-estimate" } }];
    });
    return out.length ? out : null;
  } catch (e) { if (e && e.refused) throw e; return null; }
}
async function refreshAirQuality() {
  let data = await fetchLive("/api/atlas/air-quality", 300);
  if (!data) {
    try { data = await fetchBrowserAirQuality(); }
    catch (e) { noteRefusal("/api/atlas/air-quality", e); }
  }
  const available = Array.isArray(data);
  if (available) lastAirQuality = data.filter(function (p) {
    return p && Number.isFinite(p.lng) && Number.isFinite(p.lat) && Number.isFinite(p.aqi) && p.aqi >= 0;
  });
  const rows = lastAirQuality;
  const features = rows.map(function (p) {
    const stale = !available || observationStale(p.observedAt, 3 * 3600000);
    return { type: "Feature", properties: {
      label: uiLanguage() === "id" ? p.label_id || p.label : p.label, aqi: p.aqi, pm25: p.pm25, category: stale ? "stale" : p.category,
      source: p.provenance?.source || p.source, tier: p.provenance?.tier || "unverified", observedAt: p.observedAt,
    }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } };
  });
  const src = mapInstance && mapInstance.getSource("jkt-aqi-src");
  if (src) src.setData({ type: "FeatureCollection", features: features });
  const refused = refusalFor("/api/atlas/air-quality");
  const el = document.getElementById("atlas-aqi-rows");
  if (el) el.innerHTML = rows.length ? rows.map(function (p) {
    const modeled = /open-meteo|cams/i.test(p.source || p.provenance?.source || "");
    const tier = !available ? "last retrieved / unavailable" : observationStale(p.observedAt, 3 * 3600000) ? "stale" : modeled ? "modeled" : p.provenance?.tier || "unverified";
    const pm25 = Number.isFinite(p.pm25) && p.pm25 >= 0 ? " · PM2.5 " + fmtNum(p.pm25, 1) + " µg/m³" : " · PM2.5 unavailable";
    return '<tr><th scope="row">' + escapeHtml((uiLanguage() === "id" ? p.label_id : p.label) || p.label || "Unnamed location") + '</th><td>' + escapeHtml(Math.round(p.aqi) + " AQI" + pm25) + '<small>' + escapeHtml(p.category || "Category unknown") + '</small></td><td>' + evidenceCell(p.provenance?.source || p.source, tier, p.observedAt) + '</td></tr>';
  }).join("") : '<tr><td colspan="3">' + escapeHtml(refused || "No valid air-quality values available.") + '</td></tr>';
  setToggleLabel("atlas-aqi-label", available && rows.length ? "Air quality · model" : "Air quality · unavailable");
  setToggleLabel("atlas-aqi-status", available && rows.length ? "Model estimates retrieved. Valid time and source appear with each value." : refused || "Air-quality feed unavailable or invalid. Retained values, if any, are marked last retrieved.");
  if (activeLens === "haze") renderLensEvidence();
}
async function loadReferenceText() {
  const landmarks = await fetchLive("/jakarta-landmarks.geojson", 3600);
  const el = document.getElementById("atlas-reference-list");
  if (!el) return;
  const names = new Map();
  if (Array.isArray(landmarks?.features)) landmarks.features.forEach(function (f) {
    const p = f?.properties;
    if (!p || !Number.isFinite(p.height)) return;
    const prior = names.get(p.name);
    if (!prior || p.height > prior.height) names.set(p.name, p);
  });
  const entries = Array.from(names.values()).map(function (p) {
    return '<li>' + escapeHtml(p.name) + ': highest modeled part ' + escapeHtml(p.height) + ' m. Reference: ' + escapeHtml(p.source || "unknown") + '. Tier: curated model; reference date unverified.</li>';
  });
  el.innerHTML = entries.length ? '<ul class="atlas-reference-list">' + entries.join("") + '</ul>' : '<p>Reference files unavailable. Reload to retry.</p>';
}

// ── Live data fetchers (same-origin Worker) ───────────────────────────────
async function fetchLive(endpoint, ttl) {
  const cached = liveCache.get(endpoint);
  if (cached && cached.expires > Date.now()) return cached.value;
  if (liveRequests.has(endpoint)) return liveRequests.get(endpoint);
  const pending = (async function () {
    let mod = null;
    try {
      const r = await fetch(ATLAS_BASE + endpoint, {
        headers: { accept: "application/json" }, signal: AbortSignal.timeout(endpoint.startsWith("/api/") ? 35000 : 8000), // Worker routes can parse a provider on a cold edge (FIRMS ~0.8 MB CSV); 8 s aborted them
      });
      // One reader for every API payload. The shared reader is loaded first so
      // that a refusal is reported as a refusal — but if it cannot be loaded
      // the payload is still read, because a rule about how a failure is
      // reported must never cost the reader their data.
      mod = await loadRefusalModule().catch(() => null);
      const data = mod ? await mod.readJson(r) : await fallbackRead(r);
      if (!data) return null;
      liveCache.set(endpoint, { value: data, expires: Date.now() + (ttl || 60) * 1000 });
      liveRefusals.delete(endpoint);
      return data;
    } catch (e) {
      // A refused request is remembered with its retry window, so the surface
      // that asked can say what happened instead of reporting a broken source.
      liveRefusals.delete(endpoint);
      if (mod && mod.isRefusalError(e)) liveRefusals.set(endpoint, e.retryAfterSeconds);
      return null;
    }
  })();
  liveRequests.set(endpoint, pending);
  try { return await pending; } finally { liveRequests.delete(endpoint); }
}

function setToggleLabel(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ── Areas + flyTo + flyover ────────────────────────────────────────────────
function renderAreaGrid() {
  const grid = document.getElementById("atlas-area-grid");
  if (!grid || !areasDoc) return;
  grid.innerHTML = "";
  for (const area of areasDoc.areas) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "atlas-area-tile";
    tile.dataset.areaId = area.id;
    tile.setAttribute("aria-pressed", "false");
    tile.setAttribute("aria-label", "Fly to " + area.name);
    tile.innerHTML =
      '<span class="atlas-area-tile-cat">' + escapeHtml(area.category || "city") + "</span>" +
      '<span class="atlas-area-tile-name">' + escapeHtml(uiLanguage() === "id" ? area.indonesian || area.name : area.name) + "</span>" +
      '<span class="atlas-area-tile-namevi" data-language-fixed lang="' + (uiLanguage() === 'id' ? 'en' : 'id') + '">' + escapeHtml(uiLanguage() === 'id' ? area.name : area.indonesian || '') + "</span>";
    tile.addEventListener("click", function () { flyToArea(area.id, { updateHash: true }); });
    grid.appendChild(tile);
  }
}

function flyToArea(id, opts) {
  opts = opts || {};
  if (!areasDoc) return;
  if (!mapInstance) { showToast("3D map unavailable; reference data is below."); return; }
  const area = areasDoc.areas.find(function (a) { return a.id === id; });
  if (!area) return;
  currentAreaId = id;
  if (opts.instant || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    mapInstance.jumpTo({
      center: area.center,
      zoom: area.zoom || 14,
      pitch: currentView === "2d" ? 0 : area.pitch || 50,
      bearing: currentView === "2d" ? 0 : area.bearing || 0,
    });
  } else {
    mapInstance.flyTo({
      center: area.center,
      zoom: area.zoom || 14,
      pitch: currentView === "2d" ? 0 : area.pitch || 50,
      bearing: currentView === "2d" ? 0 : area.bearing || 0,
      duration: 2600,
      essential: false,
    });
  }
  if (opts.updateHash) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("area", id);
      history.replaceState(null, "", url.toString());
    } catch (e) {} // axiom-audit-ignore honesty -- History persistence is optional; the selected map area already changed.
  }
  $$(".atlas-area-tile").forEach(function (b) {
    b.classList.toggle("atlas-area-tile--active", b.dataset.areaId === id);
    b.setAttribute("aria-pressed", String(b.dataset.areaId === id));
  });
}

function startFlyover() {
  if (currentView === "2d") setMapView("3d");
  if (!mapInstance || !areasDoc || areasDoc.areas.length === 0) return;
  stopFlyover();
  orbiting = false;
  if (orbitRaf) cancelAnimationFrame(orbitRaf);
  const token = ++flyoverToken;
  flyoverTimer = token;
  let idx = 0;
  const step = function () {
    if (flyoverTimer !== token || !mapInstance) return;
    const area = areasDoc.areas[idx % areasDoc.areas.length];
    idx++;
    flyToArea(area.id, { updateHash: true });
    mapInstance.once("moveend", function () {
      if (flyoverTimer !== token) return;
      setTimeout(step, 1400);
    });
  };
  step();
  showToast("Flyover started -- " + areasDoc.areas.length + " stops");
  const btn = document.getElementById("atlas-flyover-btn");
  if (btn) { btn.textContent = "Stop flyover"; btn.setAttribute("aria-pressed", "true"); }
}
function stopFlyover() {
  flyoverTimer = null;
  const btn = document.getElementById("atlas-flyover-btn");
  if (btn) { btn.textContent = "Start flyover"; btn.setAttribute("aria-pressed", "false"); }
}

// ── Live sun ────────────────────────────────────────────────────────────────
// The light on the buildings is the real sun over Jakarta right now (NOAA
// low-precision solar position, good to ~0.5 deg). After dark the light
// goes overhead, cool and dim -- the city at night, not a fixed noon.
function sunOverCity(date) {
  const rad = Math.PI / 180;
  const lat = -6.1754 * rad, lon = 106.8272;
  const d = date.getTime() / 86400000 - 10957.5; // days since J2000
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = ((gmst * 15 + lon) * rad) - ra;
  const alt = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(ha));
  return { altitude: alt / rad, azimuth: ((az / rad) + 360) % 360 };
}

function applySunLight() {
  const sun = sunOverCity(new Date());
  const day = sun.altitude > 0;
  mapInstance.setLight({
    anchor: "map",
    position: day ? [1.4, sun.azimuth, Math.max(10, 90 - sun.altitude)] : [1.2, 0, 20],
    color: day ? (sun.altitude < 12 ? "#ffd9a8" : "#fff4e0") : "#9fb4d8",
    intensity: day ? 0.5 : 0.28,
  });
}

// ── Idle orbit ─────────────────────────────────────────────────────────────
// After 20 s untouched the camera turns slowly round the view, so a shared
// link opened on a phone shows depth without a gesture. Any touch stops it.
let orbitEnabled = false;
let orbitIdleTimer = null;
let orbiting = false;
let orbitRaf = 0;
let orbitLast = 0;
let flyoverToken = 0;
const ORBIT_DEG_PER_SEC = 2.5;
function orbitTick(now) {
  if (!orbiting || !mapInstance) return;
  const dt = orbitLast ? Math.min(0.05, (now - orbitLast) / 1000) : 0;
  orbitLast = now;
  if (dt) mapInstance.jumpTo({ bearing: mapInstance.getBearing() + ORBIT_DEG_PER_SEC * dt });
  orbitRaf = requestAnimationFrame(orbitTick);
}
function armIdleOrbit() {
  clearTimeout(orbitIdleTimer);
  orbiting = false;
  orbitLast = 0;
  if (orbitRaf) cancelAnimationFrame(orbitRaf);
  if (currentView === "2d" || !orbitEnabled || window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  orbitIdleTimer = setTimeout(function () {
    if (flyoverTimer || mapInstance.getZoom() < 12) return armIdleOrbit();
    orbiting = true;
    orbitLast = 0;
    orbitRaf = requestAnimationFrame(orbitTick);
  }, 20000);
}

// ── Inspect (click any building) ──────────────────────────────────────────
// Extrusion clicks project onto the ground behind a tower. Use its source footprint.
function inspectionLocation(feature, fallback) {
  if (!['Polygon','MultiPolygon'].includes(feature?.geometry?.type)) return fallback;
  let coordinates = feature.geometry.coordinates;
  while (Array.isArray(coordinates) && Array.isArray(coordinates[0])) coordinates = coordinates[0];
  if (!Array.isArray(coordinates) || !coordinates.slice(0,2).every(Number.isFinite) || coordinates.length < 2 ||
      coordinates[0] < 106.65 || coordinates[0] > 107 || coordinates[1] < -6.4 || coordinates[1] > -6.08) return fallback;
  return {lng:coordinates[0],lat:coordinates[1]};
}
function closeInspect() {
  const panel = document.getElementById("atlas-inspect");
  if (panel) panel.hidden = true;
  if (inspectFeature && mapInstance) {
    mapInstance.setFeatureState({ source: "jkt-buildings-src", sourceLayer: "buildings", id: inspectFeature.id }, { selected: false });
    inspectFeature = null;
  }
}

function setupInspect() {
  document.getElementById("atlas-inspect-close")?.addEventListener("click", closeInspect);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeInspect(); stopFlyover(); } });
  let hoveredFeature = null;
  function hasLandmarkAt(point) {
    return mapInstance.getLayer("jkt-landmarks-3d") &&
      mapInstance.queryRenderedFeatures(point, { layers: ["jkt-landmarks-3d"] }).length > 0;
  }
  mapInstance.on("mousemove", "jkt-buildings", function (e) {
    if (!e.features || !e.features[0]) return;
    if (hasLandmarkAt(e.point)) {
      if (hoveredFeature) {
        mapInstance.setFeatureState({ source: "jkt-buildings-src", sourceLayer: "buildings", id: hoveredFeature.id }, { hover: false });
        hoveredFeature = null;
      }
      mapInstance.getCanvas().style.cursor = "pointer";
      return;
    }
    if (hoveredFeature && hoveredFeature.id !== e.features[0].id) {
      mapInstance.setFeatureState({ source: "jkt-buildings-src", sourceLayer: "buildings", id: hoveredFeature.id }, { hover: false });
    }
    hoveredFeature = e.features[0];
    mapInstance.setFeatureState({ source: "jkt-buildings-src", sourceLayer: "buildings", id: hoveredFeature.id }, { hover: true });
    mapInstance.getCanvas().style.cursor = "pointer";
  });
  mapInstance.on("mouseleave", "jkt-buildings", function () {
    if (hoveredFeature) {
      mapInstance.setFeatureState({ source: "jkt-buildings-src", sourceLayer: "buildings", id: hoveredFeature.id }, { hover: false });
    }
    hoveredFeature = null;
    mapInstance.getCanvas().style.cursor = "";
  });

  mapInstance.on("click", "jkt-buildings", function (e) {
    if (hasLandmarkAt(e.point)) return;
    const f = e.features && e.features[0];
    if (!f) return;
    const props = f.properties || {};
    const h = supportedBuildingHeight(props);
    const hs = props.hs || null;
    const bldg = props.cls || props.building || "building";
    const card = document.getElementById("atlas-inspect-card");
    const hint = document.getElementById("atlas-inspect-hint");
    const coords = document.getElementById("atlas-inspect-coords");
    const propsEl = document.getElementById("atlas-inspect-props");
    if (!card || !propsEl) return;

    const center = inspectionLocation(f, e.lngLat);
    document.getElementById('place-inspect').onclick = () => openPlaceContext(center);
    coords.textContent = "lat " + center.lat.toFixed(5) + " -- lng " + center.lng.toFixed(5);
    propsEl.innerHTML =
      '<div class="atlas-inspect-row"><span>Type</span><strong>' + escapeHtml(bldg) + "</strong></div>" +
      '<div class="atlas-inspect-row"><span>Height</span><strong>' + escapeHtml(h ? h.toFixed(1) + " m" : "unknown") + "</strong></div>" +
      ('<div class="atlas-inspect-row"><span>Height from</span><strong>' + escapeHtml(HEIGHT_SOURCE_LABEL[hs] || hs || "unknown") + "</strong></div>") +
      (props.name ? '<div class="atlas-inspect-row"><span>Name</span><strong>' + escapeHtml(props.name) + "</strong></div>" : "") +
      '<div class="atlas-inspect-row"><span>Footprint</span><strong>' + escapeHtml(FOOTPRINT_SOURCE_LABEL[props.src] || props.src || "unknown") + "</strong></div>";

    if (hint) hint.style.display = "none";
    card.hidden = false;
    document.getElementById("atlas-inspect").hidden = false;

    if (inspectFeature) {
      mapInstance.setFeatureState({ source: "jkt-buildings-src", sourceLayer: "buildings", id: inspectFeature.id }, { selected: false });
    }
    inspectFeature = f;
    mapInstance.setFeatureState({ source: "jkt-buildings-src", sourceLayer: "buildings", id: f.id }, { selected: true });
  });

  mapInstance.on("click", "jkt-landmarks-3d", function (e) {
    const props = e.features?.[0]?.properties;
    if (!props) return;
    closeInspect();
    const center = inspectionLocation(e.features[0], e.lngLat);
    document.getElementById('place-inspect').onclick = () => openPlaceContext(center);
    document.getElementById("atlas-inspect-coords").textContent = "lat " + center.lat.toFixed(5) + " · lng " + center.lng.toFixed(5);
    document.getElementById("atlas-inspect-props").innerHTML =
      '<div class="atlas-inspect-row"><span>Name</span><strong>' + escapeHtml(props.name) + '</strong></div>' +
      '<div class="atlas-inspect-row"><span>Part height</span><strong>' + escapeHtml(props.height) + ' m</strong></div>' +
      '<div class="atlas-inspect-row"><span>Tier</span><strong>Curated reference model</strong></div>' +
      '<div class="atlas-inspect-row"><span>Reference</span><strong>' + escapeHtml(props.source || "unknown") + '</strong></div>' +
      '<div class="atlas-inspect-row"><span>Footprint</span><strong>OpenStreetMap ' + escapeHtml(props.osm) + '</strong></div>';
    document.getElementById("atlas-inspect-hint").style.display = "none";
    document.getElementById("atlas-inspect-card").hidden = false;
    document.getElementById("atlas-inspect").hidden = false;
  });
  mapInstance.on("click", function (e) {
    const layers = ["jkt-buildings", "jkt-landmarks-3d"].filter(function (id) { return mapInstance.getLayer(id); });
    const hits = layers.length ? mapInstance.queryRenderedFeatures(e.point, { layers: layers }) : [];
    if (!hits.length) closeInspect();
  });
}

// ── Layer toggles + basemap ────────────────────────────────────────────────
const LAYER_GROUPS = {
  "rain-model-samples": ["rain-model-samples", "rain-model-samples-label"],
  "jkt-buildings": ["jkt-buildings", "jkt-buildings-outline"],
  "rail-stations": ["rail-stations", "rail-stations-label"],
  "jkt-landmarks-3d": ["jkt-landmarks-3d", "jkt-landmarks-outline", "jkt-landmarks-label"],
  "aqi-points": ["aqi-points", "aqi-labels"],
};
const layerVisibility = {"fire-hotspots": false};
function setLayerVisible(layerId, visible) {
  if (!mapInstance) return;
  layerVisibility[layerId] = visible;
  (LAYER_GROUPS[layerId] || [layerId]).forEach(function (id) {
    const hiddenIn2D = currentView === "2d" && ["jkt-buildings", "jkt-buildings-outline", "jkt-landmarks-3d", "jkt-landmarks-outline"].includes(id);
    if (mapInstance.getLayer(id)) mapInstance.setLayoutProperty(id, "visibility", visible && !hiddenIn2D ? "visible" : "none");
  });
  $$("[data-layer-toggle]").forEach(function (btn) {
    if (btn.dataset.layerToggle !== layerId) return;
    if (["jkt-buildings", "jkt-landmarks-3d"].includes(layerId)) btn.disabled = currentView === "2d";
    const is3DGroup = ["jkt-buildings", "jkt-landmarks-3d"].includes(layerId);
    btn.classList.toggle("atlas-toggle--on", visible && !(currentView === "2d" && is3DGroup));
    btn.setAttribute("aria-pressed", String(visible && !(currentView === "2d" && is3DGroup)));
  });
}
function setupLayerToggles() {
  $$("[data-layer-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = btn.dataset.layerToggle;
      if (!mapInstance.getLayer(id)) { showToast("This layer is unavailable. See Data & sources."); return; }
      setLayerVisible(id, mapInstance.getLayoutProperty(id, "visibility") === "none");
      if (id === "fire-hotspots" && layerVisibility[id]) refreshFires(false);
    });
  });
}

function setBasemap(name) {
  if (!mapInstance || !["esri", "osm"].includes(name)) return;
  currentBasemap = name;
  if (name === "osm" && mapInstance.getLayer("osm-streets")) mapInstance.setLayoutProperty("osm-streets", "visibility", "visible");
  const esriVisible = name === "esri" ? "visible" : "none";
  mapInstance.setLayoutProperty("esri-imagery", "visibility", esriVisible);
  if (name === "esri" && mapInstance.getLayer("osm-streets")) mapInstance.setLayoutProperty("osm-streets", "visibility", "none");
  const select = document.getElementById("atlas-basemap"); if (select) select.value = name;
  $$(".atlas-basemap-btn").forEach(function (b) {
    b.classList.toggle("atlas-basemap-btn--active", b.dataset.bas === name);
    b.setAttribute("aria-pressed", String(b.dataset.bas === name));
  });
}

function setMapView(view) {
  if (!mapInstance || !['2d', '3d'].includes(view)) return;
  if (view !== currentView && view === '2d') { saved3DPitch = mapInstance.getPitch(); saved3DBearing = mapInstance.getBearing(); }
  stopMapMotion(); mapInstance.stop(); currentView = view;
  if (view === '3d') { layerVisibility['jkt-buildings'] = true; layerVisibility['jkt-landmarks-3d'] = true; }
  ['jkt-buildings', 'jkt-landmarks-3d'].forEach(id => setLayerVisible(id, layerVisibility[id] !== false));
  mapInstance.setMaxPitch(view === '2d' ? 0 : 70);
  if (view === '2d') mapInstance.dragRotate.disable(); else mapInstance.dragRotate.enable();
  mapInstance.easeTo({ pitch: view === '2d' ? 0 : Math.max(30, saved3DPitch), bearing: view === '2d' ? 0 : saved3DBearing,
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300 });
  const select = document.getElementById('atlas-view'); if (select) select.value = view;
  document.getElementById("atlas-map")?.setAttribute("aria-label", view === "2d" ? "2D map of Jakarta" : "3D map of Jakarta");
  if (view === '2d') { const inspect = document.getElementById('atlas-inspect'); if (inspect) inspect.hidden = true; }
  postMsg('view', { view, basemap: currentBasemap });
}

// ── postMessage bridge to dashboard iframe ────────────────────────────────
function postMsg(type, payload) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        Object.assign({ type: "jakarta-atlas", event: type, source: "atlas" }, payload),
        parentTargetOrigin(),
      );
    }
  } catch (e) {} // axiom-audit-ignore honesty -- Optional parent handshake failure keeps the standalone atlas; no observation is created.
}
// Bounded same-origin bridge for licensed scheduled routes and public civic points.
function applyDashboardOverlay(data) {
  if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length > 2000) return;
  const coordinates = [];
  function walk(c) {
    if (!Array.isArray(c)) return false;
    if (typeof c[0] === 'number') {
      if (c.length < 2 || !c.slice(0,2).every(Number.isFinite) || c[0] < 105 || c[0] > 108 || c[1] < -8 || c[1] > -5) return false;
      coordinates.push(c); return coordinates.length <= 20000;
    }
    return c.every(walk);
  }
  if (data.features.some(f => !['Point','LineString','Polygon','MultiPolygon'].includes(f?.geometry?.type) || !walk(f.geometry.coordinates))) return;
  styleReady.then(function () {
    const sourceId = 'jkt-dashboard-selection';
    if (!mapInstance.getSource(sourceId)) {
      mapInstance.addSource(sourceId, {type:'geojson', data});
      mapInstance.addLayer({id:sourceId+'-fill',type:'fill',source:sourceId,filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':mapTheme().accent,'fill-opacity':0.2}});
      mapInstance.addLayer({id:sourceId+'-line',type:'line',source:sourceId,filter:['!=',['geometry-type'],'Point'],paint:{'line-color':mapTheme().accent,'line-width':4}});
      mapInstance.addLayer({id:sourceId+'-point',type:'circle',source:sourceId,filter:['==',['geometry-type'],'Point'],paint:{'circle-color':mapTheme().accent,'circle-radius':7,'circle-stroke-color':'#0f1b33','circle-stroke-width':2}});
    } else mapInstance.getSource(sourceId).setData(data);
    if (coordinates.length) {
      setMapView('2d');
      const bounds = coordinates.reduce((b,c)=>b.extend(c), new maplibregl.LngLatBounds(coordinates[0],coordinates[0]));
      mapInstance.fitBounds(bounds,{padding:70,maxZoom:15,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:250});
    }
    postMsg('selection', {featureCount:data.features.length});
  });
}
// Building filters compare source metres; they never alter extrusion heights.
const BUILDING_TYPE_GROUPS = {
 housing: ['house','apartments','residential','detached','terrace','semidetached_house'],
 work: ['office','commercial','retail','shop','hotel'],
 industrial: ['industrial','warehouse','factory'],
 civic: ['school','university','hospital','civic','public','government','church','mosque','temple'],
 landmark: ['landmark']
};
let buildingFilterState = {min:0,max:500,kind:'all',source:'all',unknown:true};
const originalBuildingFilters = new Map();
let buildingFilterPending = false;
function normalizeBuildingFilter(input) {
 if (!input || !Number.isFinite(input.min) || !Number.isFinite(input.max) || input.min<0 || input.max>500 || input.min>input.max || typeof input.unknown!=='boolean') return null;
 if (input.kind!=='all' && !Object.hasOwn(BUILDING_TYPE_GROUPS,input.kind)) return null;
 if (!['all','measured','floors','google','ghsl','estimated','landmark'].includes(input.source)) return null;
 return {min:input.min,max:input.max,kind:input.kind,source:input.source,unknown:input.unknown};
}
function buildingFilterExpression(filter) {
 const raw=['to-number',['coalesce',['get','exploreHeight'],['get','h'],['get','render_height'],['get','height']],0];
 const known=['in',['coalesce',['get','exploreSource'],['get','hs'],''],['literal',['measured','floors','google','ghsl','satellite','landmark']]];
 const h=['case',['all',known,['>=',raw,1],['<=',raw,500]],raw,0];
 const tests=['all'];
 if(filter.min!==0 || filter.max!==500 || !filter.unknown) {
  const range=['all',['>',h,0],['>=',h,filter.min],['<=',h,filter.max]];
  tests.push(filter.unknown?['any',['<=',h,0],range]:range);
 }
 if(filter.kind!=='all') tests.push(['in',['coalesce',['get','exploreKind'],['get','cls'],['get','building'],''],['literal',BUILDING_TYPE_GROUPS[filter.kind]]]);
 if(filter.source!=='all') tests.push(['in',['coalesce',['get','exploreSource'],['get','hs'],''],['literal',filter.source==='ghsl'?['ghsl','satellite']:[filter.source]]]);
 return tests.length===1?null:tests;
}
function reportBuildingView() {
 if (!mapInstance) return;
 const visible=currentView==='3d' && mapInstance.getLayer('jkt-buildings') && mapInstance.getLayoutProperty('jkt-buildings','visibility')!=='none';
 const failed=!!mapInstance.__atlasTileError;
 const ready=mapInstance.areTilesLoaded()&&!failed&&!buildingFilterPending;
 const rows=visible&&ready?mapInstance.queryRenderedFeatures(undefined,{layers:['jkt-buildings']}):[];
 const ids=new Set(rows.filter(f=>f.id!=null).map(f=>String(f.id)));
 postMsg('building-view',{filter:buildingFilterState,count:visible&&ready?ids.size:null,state:failed?'unavailable':!visible?'hidden':ready?'ready':'loading',colors:mapTheme().buildings,scope:'rendered-footprints',tier:'rendered-snapshot',source:'Overture / OSM / Microsoft / Google',datasetDate:'2026-09-23',checkedAt:new Date().toISOString(),zoom:mapInstance.getZoom()});
}
function applyBuildingFilter(input) {
 const config=normalizeBuildingFilter(input);
 if (!config) { postMsg('building-filter-error',{reason:'invalid_filter'});return; }
 buildingFilterState=config;
 styleReady.then(()=>{
  buildingFilterPending=true;
  const expression=buildingFilterExpression(config);
  for(const id of ['jkt-buildings','jkt-buildings-outline','jkt-landmarks-3d','jkt-landmarks-outline','jkt-landmarks-label']){
   if(!mapInstance.getLayer(id))continue;
   if(!originalBuildingFilters.has(id))originalBuildingFilters.set(id,mapInstance.getFilter(id)||null);
   const base=originalBuildingFilters.get(id);
   mapInstance.setFilter(id,expression&&base?['all',base,expression]:expression||base);
  }
  closeInspect();reportBuildingView();
 });
}
if(mapInstance){mapInstance.on('idle',()=>{buildingFilterPending=false;reportBuildingView();});mapInstance.on('moveend',reportBuildingView);}
window.addEventListener('atlas:theme',reportBuildingView);
// The page's layout is assembled by public/atlas-layout.js, in a classic
// script at the end of the body, so that the DOM a reader gets is the DOM
// that was painted. It used to live here, at the end of a deferred script,
// and the atlas existed in two states: the static markup for a third of a
// second, and the real page after that. The map had a column of chrome it
// did not keep, and the spatial gate measured whichever state it caught.
window.addEventListener("message", function (e) {
  if (PARENT_ORIGINS.indexOf(e.origin) === -1 && e.origin !== window.location.origin) return;
  if (e.source !== window.parent) return;
  const m = e.data;
  if (!m || typeof m !== "object") return;
  if (m.type === "atlas:setLanguage" && ["id", "en"].includes(m.language)) { window.AtlasLanguage?.set(m.language); return; }
  if (m.type === "atlas:setTheme" && ['dark','light','contrast'].includes(m.theme)) {
    const select = document.getElementById('atlas-theme');
    if (select) { select.value = m.theme; select.dispatchEvent(new Event('change')); }
    return;
  }
  if (!mapInstance) return;
  if(m.type==='atlas:setBuildingFilter'){applyBuildingFilter(m.filter);return;}
  if(m.type==='atlas:requestBuildingView'){reportBuildingView();return;}
  if(m.type==='atlas:resetCityView'){stopFlyover();orbitEnabled=false;mapInstance.stop();setMapView('3d');flyToArea('sudirman-thamrin',{instant:true,updateHash:true});return;}
  if (m.type === 'atlas:dashboardOverlay') { applyDashboardOverlay(m.data); return; }
  if (m.type === "atlas:flyTo" && m.areaId) flyToArea(m.areaId, { updateHash: false });
  else if (m.type === "atlas:flyover") (m.start ? startFlyover : stopFlyover)();
  else if (m.type === "atlas:setBasemap" && ["esri", "osm"].includes(m.bas)) setBasemap(m.bas);
  else if (m.type === "atlas:setView") setMapView(m.view);
  else if (m.type === "atlas:toggleLayer" && m.layerId && mapInstance.getLayer(m.layerId)) {
    setLayerVisible(m.layerId, m.visible !== false);
  }
});

// Environmental products remain separate from unsurveyed flood reference sketches.
let environmentData = null, rainfallData = null, rainfallRefusalText = null;
let environmentRequest = 0;
let environmentTileError = false;
function uiLanguage() { return window.AtlasLanguage?.language() || 'en'; }
function translateUi(text) { return window.AtlasLanguage?.translate(text) || text; }
function formatLocal(stamp) {
  return stamp && Number.isFinite(Date.parse(stamp)) ? new Date(stamp).toLocaleString(uiLanguage() === 'id' ? 'id-ID' : 'en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) + ' WIB' : translateUi('unknown');
}
function downloadEvidence(filename, data, mime) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function selectedEnvironmentProduct() {
  const id = document.getElementById('atlas-environment-layer')?.value || 'none';
  if (id === 'radar') {
    const radar = environmentData?.radar, frames = radar?.frames || [];
    const index = Number(document.getElementById('atlas-radar-frame')?.value);
    const frame = frames[Number.isInteger(index) && index >= 0 ? index : frames.length - 1];
    return radar && { ...radar, ...frame, id, date: frame?.observedAt, tiles: frame?.tiles || [], available: radar.available && !!frame, units: 'dBZ', resolution: 'regional radar composite' };
  }
  const product = environmentData?.products?.find(p => p.id === id);
  const date = document.getElementById('atlas-satellite-date')?.value;
  return product && product.dates?.includes(date) ? { ...product, date, tiles: product.tiles.map(url => url.replace('/' + product.date + '/', '/' + date + '/')) } : product;
}
function renderObservationHud(product) {
  const hud = document.getElementById('atlas-observation-hud');
  if (!hud) return;
  hud.hidden = !product;
  const names = { himawari: 'Himawari infrared clouds', radar: 'Rain radar', 'surface-water': 'Satellite surface water / flood', aerosol: 'Satellite aerosol optical depth', 'satellite-rain': 'Satellite rainfall estimate', 'true-colour': 'Visible satellite imagery', 'night-lights': 'Night lights · corrected daily', 'night-lights-2016': 'Night lights · 2016 composite', 'aerosol-viirs': 'VIIRS Deep Blue aerosol', 'aerosol-index': 'OMPS absorbing aerosol index' };
  hud.innerHTML = product ? '<details class="atlas-hud-details"><summary>Observation</summary><div><strong>' + escapeHtml(names[product.id] || product.layer || product.id) + '</strong><span>' + escapeHtml(product.source + ' · ' + product.tier) + '</span><span>' + escapeHtml((product.date || 'unknown') + ' UTC') + '</span><span>Missing pixels are not an all-clear.</span><a href="#atlas-environment">Data &amp; sources</a></div></details>' : '';
  const disclosure = hud.querySelector?.('details');
  if (disclosure) disclosure.open = !window.matchMedia('(max-width: 700px)').matches;
}
function renderEnvironmentEvidence(product) {
  const evidence = document.getElementById('atlas-environment-evidence'), legend = document.getElementById('atlas-environment-legend');
  if (!evidence || !legend) return;
  renderObservationHud(product);
  if (!product) { evidence.innerHTML = ''; legend.innerHTML = ''; return; }
  const pairs = [['Source', product.source], ['Tier', product.tier], ['Observation date (UTC)', product.date || 'unknown'], ['Retrieved (WIB)', formatLocal(product.fetchedAt)], ['Resolution', product.resolution], ['Units', product.units], ['Time support', product.timePrecision || 'unknown']];
  if (product.windowDays) pairs.push(['Days in composite', product.windowDays]);
  evidence.innerHTML = '<dl class="atlas-environment-evidence">' + pairs.map(p => '<dt>' + escapeHtml(p[0]) + '</dt><dd>' + escapeHtml(p[1]) + '</dd>').join('') + '</dl><p><a href="' + escapeHtml(product.sourceUrl) + '" target="_blank" rel="noopener">Source documentation</a></p>';
  const notes = {
    'himawari': 'Himawari infrared observes cloud-top temperature, not measured rain. Cold clouds can support storm monitoring; use radar or IMERG to inspect rainfall.',
    'surface-water': 'Clouds, vegetation and buildings can hide water. The 3-day MODIS product has 250 m pixels; it does not measure depth or establish road safety. Blank pixels are not an all-clear.',
    'aerosol': 'Aerosol optical depth measures the atmospheric column, not surface PM2.5. Each square is one ~10 km retrieval, so a lone red square is one high reading, not a mapped plume. Cloud gaps are missing observations.',
    'radar': 'Rain radar shows precipitation echoes within provider coverage. It does not measure flood depth. Black coverage-mask areas lack radar coverage.',
    'true-colour': 'Visible satellite imagery can show clouds, land and smoke-like features. It does not identify a pollution source or measure surface concentration.',
    'satellite-rain': 'IMERG is a satellite rainfall-rate estimate, not ground radar. Daily imagery may lag; check the product date.',
    'night-lights': 'Black Marble is corrected for moonlight and atmosphere, with gaps filled from other nights. The dated daily product can contain older information. Fires and gas flares also glow. Brightness is not population, economic output or proof of a power outage.',
    'night-lights-2016': 'Fixed 2016 annual night-light composite. Its processing differs from corrected daily radiance. Compare spatial patterns only; brightness differences do not quantify city growth or outages.',
    'aerosol-viirs': 'VIIRS Deep Blue measures aerosol through the atmospheric column during daytime overpasses. Retrievals are about 6 km at nadir; the 2 km visualization adds no finer measurement. Clouds and swath gaps remain missing, not clean air.',
    'aerosol-index': 'OMPS detects UV-absorbing aerosol such as dust, smoke or volcanic ash. The index also depends on aerosol height and clouds; it does not identify the source or measure ground-level PM2.5. Native pixels are about 12 × 17 km at nadir.',

  };
  const categories = [['Surface water', '#32d2f5'], ['Recurring flood', '#ffff00'], ['Flood detected', '#fa1e24'], ['Insufficient data', '#afafaf']];
  legend.innerHTML = '<p>' + escapeHtml(notes[product.id]) + '</p>' + (product.id === 'surface-water'
    ? '<ul class="atlas-environment-legend">' + categories.map(p => '<li><i aria-hidden="true" style="background:' + p[1] + '"></i>' + escapeHtml(p[0]) + '</li>').join('') + '</ul>'
    : product.id === 'radar' ? '<p>Radar reflectivity (dBZ), RainViewer Universal Blue. No echo and no coverage are different.</p><ul class="atlas-environment-legend">' + [['15 dBZ', '#88ddee'], ['25 dBZ', '#0077aa'], ['35 dBZ', '#ffee00'], ['45 dBZ', '#ff4400'], ['55 dBZ', '#ffaaff']].map(p => '<li><i aria-hidden="true" style="background:' + p[1] + '"></i>' + p[0] + '</li>').join('') + '</ul><p><a href="https://www.rainviewer.com/api/color-schemes.html" target="_blank" rel="noopener">Provider legend</a></p>'
    : !product.legendUrl ? '' : '<p><a target="_blank" rel="noopener" href="' + escapeHtml(product.legendUrl) + '">Provider legend</a></p>');
}
function renderSatelliteDates(product) {
  if (!product || product.id === 'radar') return;
  const dates = document.getElementById('atlas-satellite-date');
  const prior = dates.value;
  const preserve = dates.dataset.product === product.id && product.dates?.includes(prior);
  setToggleLabel('atlas-satellite-date-label', product.id === 'himawari' ? 'Satellite frame' : 'Satellite day');
  dates.setAttribute('aria-label', product.id === 'himawari' ? 'Satellite frame' : 'Satellite day');
  dates.dataset.product = product.id;
  dates.innerHTML = (product.dates || []).map(date => '<option value="' + date + '">' + (product.id === 'himawari' ? formatLocal(date) : date + ' UTC') + '</option>').join('');
  dates.value = preserve ? prior : product.date;
}
async function applyEnvironmentOverlay() {
  environmentTileError = false;
  const token = ++environmentRequest;
  let product = selectedEnvironmentProduct();
  const radar = document.getElementById('atlas-environment-layer')?.value === 'radar';
  document.getElementById('atlas-satellite-date-control').hidden = !product || radar;
  renderSatelliteDates(product);
  product = selectedEnvironmentProduct();
  document.getElementById('atlas-radar-frame-control').hidden = !radar;
  document.getElementById('atlas-radar-coverage-control').hidden = !radar;
  renderEnvironmentEvidence(product);
  if (!mapInstance) { setToggleLabel('atlas-environment-status', '3D map unavailable; reference data is below.'); return; }
  await styleReady;
  if (token !== environmentRequest) return;
  for (const id of ['environment-overlay', 'radar-coverage']) {
    if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
    if (mapInstance.getSource(id)) mapInstance.removeSource(id);
  }
  if (!product) { setToggleLabel('atlas-environment-status', 'No environmental overlay selected.'); return; }
  if (!product.available || !product.tiles.length) { setToggleLabel('atlas-environment-status', 'Selected product unavailable; no image is being presented as current.'); return; }
  const before = mapInstance.getLayer('jkt-buildings') ? 'jkt-buildings' : undefined;
  mapInstance.addSource('environment-overlay', { type: 'raster', tiles: product.tiles, tileSize: 256, maxzoom: product.maxzoom, attribution: product.source + ' — ' + product.date });
  mapInstance.addLayer({ id: 'environment-overlay', type: 'raster', source: 'environment-overlay', paint: { 'raster-opacity': Number(document.getElementById('atlas-environment-opacity').value) / 100, 'raster-resampling': 'nearest' } }, before);
  if (mapInstance.getLayer('fire-hotspots')) mapInstance.moveLayer('fire-hotspots');
  if (radar && document.getElementById('atlas-radar-coverage').checked) {
    mapInstance.addSource('radar-coverage', { type: 'raster', tiles: product.coverageTiles, tileSize: 256, maxzoom: 7 });
    mapInstance.addLayer({ id: 'radar-coverage', type: 'raster', source: 'radar-coverage', paint: { 'raster-opacity': 0.65 } }, before);
  }
  setToggleLabel('atlas-environment-status', 'Loading selected imagery…');
}
function renderRadarFrames(preserve) {
  const select = document.getElementById('atlas-radar-frame');
  if (!select) return;
  const selected = select.value;
  select.innerHTML = (environmentData?.radar.frames || []).map((f, i) => '<option value="' + i + '">' + escapeHtml(formatLocal(f.observedAt)) + '</option>').join('');
  select.value = preserve ? selected : String((environmentData?.radar.frames.length || 0) - 1);
}
async function refreshEnvironment(force) {
  if (force) liveCache.delete('/api/atlas/environment');
  const data = await fetchLive('/api/atlas/environment', 120);
  environmentData = data && Array.isArray(data.products) && Array.isArray(data.radar?.frames) ? data : null;
  renderRadarFrames(false);
  const dates = document.getElementById('atlas-satellite-date');
  if (dates) dates.dataset.product = '';
  // A refused request was never measured. It is not an unavailable source, and
  // the status must not tell the reader to reload a request that was refused.
  const refused = refusalFor('/api/atlas/environment');
  if (!environmentData) { setToggleLabel('atlas-environment-status', refused || 'Environmental sources unavailable. Reload or refresh to retry.'); }
  await applyEnvironmentOverlay();
  if (!environmentData) setToggleLabel('atlas-environment-status', refused || 'Environmental sources unavailable. Reload or refresh to retry.');
  if (watchData) renderCityWatch();
}
function updateRainfallPoints() {
  if (!mapInstance) return;
  const features = (rainfallData?.points || []).map(p => ({ type: 'Feature', properties: { id: p.id, name: (uiLanguage() === 'id' ? p.name_id : p.name) + (Number.isFinite(p.next24hMm) ? ' · ' + fmtNum(p.next24hMm, 1) + ' mm / 24 h' : ' · ' + translateUi('unavailable')), rain24: Number.isFinite(p.next24hMm) ? p.next24hMm : -1 }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } }));
  const data = { type: 'FeatureCollection', features };
  const source = mapInstance.getSource('rain-model-samples');
  if (source) { source.setData(data); return; }
  mapInstance.addSource('rain-model-samples', { type: 'geojson', data, attribution: 'Atlas weather-model sample locations, not rain gauges' });
  mapInstance.addLayer({ id: 'rain-model-samples', type: 'circle', source: 'rain-model-samples', minzoom: 8, paint: { 'circle-radius': ['step', ['get', 'rain24'], 7, 20, 11, 50, 17, 100, 23], 'circle-color': ['step', ['get', 'rain24'], '#afafaf', 0, '#32bf82', 20, '#d8a24a', 50, '#da525d'], 'circle-stroke-color': '#0f1b33', 'circle-stroke-width': 2 } });
  mapInstance.addLayer({ id: 'rain-model-samples-label', type: 'symbol', source: 'rain-model-samples', minzoom: 8, layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-offset': [0, 1.2], 'text-anchor': 'top' }, paint: { 'text-color': '#f1e7d0', 'text-halo-color': '#0f1b33', 'text-halo-width': 2 } });
  setLayerVisible('rain-model-samples', layerVisibility['rain-model-samples'] !== false);
}
function renderRainfall() {
  const rows = document.getElementById('atlas-rainfall-rows');
  if (!rows) return;
  rows.innerHTML = rainfallData?.points?.length ? rainfallData.points.map(p => '<tr><th scope="row"><button type="button" class="atlas-rain-location" data-rain-point="' + escapeHtml(p.id) + '">' + escapeHtml(uiLanguage() === 'id' ? p.name_id : p.name) + '</button></th><td>' + escapeHtml(p.available && Number.isFinite(p.precipitationMm) ? fmtNum(p.precipitationMm, 1) + ' mm / ' + (p.intervalSeconds ? p.intervalSeconds / 60 + ' min' : 'interval unknown') : 'unavailable') + '</td><td>' + escapeHtml(Number.isFinite(p.next24hMm) ? fmtNum(p.next24hMm, 1) + ' mm' : 'unavailable') + '<small>' + escapeHtml(formatLocal(p.forecastFromUtc) + ' → ' + formatLocal(p.forecastToUtc)) + '</small></td><td>' + escapeHtml(formatLocal(p.validAt)) + '</td></tr>').join('') : '<tr><td colspan="4">' + escapeHtml(rainfallRefusalText || 'Rainfall data unavailable. No zero rainfall is assumed.') + '</td></tr>';
  if (mapInstance) styleReady.then(updateRainfallPoints);
  setToggleLabel('atlas-rainfall-status', rainfallData ? rainfallData.source + ' · ' + rainfallData.tier + ' · Retrieved (WIB): ' + formatLocal(rainfallData.fetchedAt) : rainfallRefusalText || 'Rainfall data unavailable. No zero rainfall is assumed.');
}
async function refreshRainfall(force) {
  if (force) liveCache.delete('/api/atlas/rainfall');
  const usable = data => { if (!data?.points?.some(p => p.available)) throw new Error('Forecast unavailable'); return data; };
  try { rainfallData = await Promise.any([
    fetchLive('/api/atlas/rainfall', 600).then(usable),
    fetchBrowserRainfall().catch(error=>{noteRefusal('/api/atlas/rainfall',error);throw error;}).then(usable),
  ]); } catch { rainfallData = null; }
  // A refused request was never measured. The table must not say the data is
  // unavailable, and the status must not invite a reload that will be refused
  // again while the window is open.
  rainfallRefusalText = rainfallData ? null : refusalFor('/api/atlas/rainfall');
  renderRainfall();
  renderCityWatch();
}

function applyMapLanguage() {
  if (!mapInstance) return;
  // Jakarta landmarks and stations carry their Indonesian names in OSM;
  // English mode swaps in the few that have a common English name.
  for (const id of ['rail-stations-label', 'jkt-landmarks-label']) {
    if (mapInstance.getLayer(id)) {
      const names = Object.entries(window.ATLAS_PLACE_EN || {});
      mapInstance.setLayoutProperty(id, 'text-field', uiLanguage() === 'en' && names.length ? ['match', ['get', 'name'], ...names.flat(), ['get', 'name']] : ['get', 'name']);
    }
  }
}
function stopMapMotion() {
  stopFlyover(); orbitEnabled = false; orbiting = false; orbitLast = 0; if (orbitRaf) cancelAnimationFrame(orbitRaf); clearTimeout(orbitIdleTimer);
  const button = document.getElementById('atlas-orbit-btn');
  button?.setAttribute('aria-pressed', 'false'); if (button) button.textContent = 'Enable orbit';
  mapInstance?.stop();
}
let watchData = null;
function watchValue(id, text) { setToggleLabel(id, text); }
function watchPlace(topic) {
  const places = watchData?.places || [];
  if (topic === "air") return places.filter(p => p.air?.usAqi != null).sort((a, b) => b.air.usAqi - a.air.usAqi)[0] || places[0];
  if (topic === "wind") {
    if (watchData?.storm?.systems?.[0]) return { lng: watchData.storm.systems[0].lng, lat: watchData.storm.systems[0].lat };
    return places.filter(p => p.gustKph != null).sort((a, b) => b.gustKph - a.gustKph)[0] || places[0];
  }
  if (topic === "traffic") return places.find(p => p.id === "pusat") || places[0];
  return places.filter(p => Number.isFinite(p.next24hMm)).sort((a, b) => b.next24hMm - a.next24hMm)[0] || places[0];
}
function renderCityWatch() {
  const action = document.getElementById("atlas-watch-action");
  const requestStatus=document.getElementById("atlas-watch-request-status");
  if(requestStatus){requestStatus.hidden=!!watchData;requestStatus.textContent=watchData?"":refusalFor("/api/atlas/watch")||lensText("Open data unavailable. No all-clear is assumed.","Data terbuka tidak tersedia. Kondisi aman tidak disimpulkan.");}
  if (!watchData) {
    // A refused request is not an open-data outage. The two read very
    // differently to a reader deciding whether the city is quiet.
    const text = lensText("Not retrieved","Belum diambil");
    ["atlas-watch-flood-value", "atlas-watch-air-value", "atlas-watch-wind-value", "atlas-watch-traffic-value"].forEach(id => watchValue(id, text));
    if (action) { action.hidden = true; action.textContent = ""; }
    return;
  }
  const water = environmentData?.products?.find(p => p.id === "surface-water");
  // The Worker's model call can be throttled while the browser fallback in
  // refreshRainfall succeeded; use whichever carries a complete 24 h total.
  const browserWettest = (rainfallData?.points || []).filter(p => Number.isFinite(p.next24hMm)).sort((a, b) => b.next24hMm - a.next24hMm)[0];
  const workerWettest = watchPlace("flood");
  const wettest = workerWettest && Number.isFinite(workerWettest.next24hMm) ? workerWettest : browserWettest || workerWettest;
  const rainBit = wettest && Number.isFinite(wettest.next24hMm) ? fmtNum(wettest.next24hMm, 1) + " mm / 24 h" : "Rain unavailable";
  const satBit = water?.available && water.date ? water.date : "Satellite day unavailable";
  watchValue("atlas-watch-flood-value", satBit + " · " + rainBit);
  const dirtiest = (watchData.places || []).filter(p => p.air?.available && p.air.usAqi != null).sort((a, b) => b.air.usAqi - a.air.usAqi)[0];
  watchValue("atlas-watch-air-value", dirtiest ? "US AQI " + dirtiest.air.usAqi + ", PM2.5 " + (dirtiest.air.pm25 == null ? "unavailable" : fmtNum(dirtiest.air.pm25, 0) + " µg/m³") : "Air sample unavailable");
  const windiest = (watchData.places || []).filter(p => p.gustKph != null).sort((a, b) => b.gustKph - a.gustKph)[0];
  const storm = watchData.storm;
  const stormBit = storm?.systems?.length ? storm.systems[0].name + " · " + storm.systems[0].distanceKm + " km" : storm?.available ? "No listed cyclone" : "Storm list unavailable";
  watchValue("atlas-watch-wind-value", stormBit + (windiest ? ", gust " + fmtNum(windiest.gustKph, 0) + " km/h" : ""));
  watchValue("atlas-watch-traffic-value", "Congestion is not measured");
  const topics = new Set((watchData.notices || []).map(n => n.topic));
  document.getElementById("atlas-watch-flood")?.classList.toggle("is-watch", topics.has("rain"));
  document.getElementById("atlas-watch-air")?.classList.toggle("is-watch", topics.has("air"));
  document.getElementById("atlas-watch-wind")?.classList.toggle("is-watch", topics.has("wind") || topics.has("pressure") || topics.has("storm"));
  const lines = [...new Set((watchData.notices || []).map(n => n.action).filter(Boolean))];
  if (action) { action.hidden = lines.length === 0; action.textContent = lines.join(" "); }
}
function freshStamp(time) {
  if (typeof time !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z?$/.test(time)) return null;
  const stamp = time.endsWith("Z") ? time : time + "Z";
  const parsed = Date.parse(stamp);
  return Number.isFinite(parsed) && parsed <= Date.now() + 5 * 60000 && Date.now() - parsed <= 3 * 3600000 ? stamp : null;
}
function boundedReading(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}
async function fillWatchAir() {
  const points = watchData?.places || [];
  if (!points.length || points.some(p => p.air?.available)) return;
  let rows;
  try {
    const response = await fetch("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" + points.map(p => p.lat).join(",") + "&longitude=" + points.map(p => p.lng).join(",") + "&current=pm2_5,pm10,us_aqi&timezone=UTC", { signal: AbortSignal.timeout(8000) });
    rows = await readApi(response);
  } catch (e) { return; }
  if (!Array.isArray(rows)) return;
  points.forEach((point, i) => {
    const row = rows[i];
    const stamp = freshStamp(row?.current?.time);
    const units = row?.current_units || {};
    const near = row?.utc_offset_seconds === 0 && !!stamp && Number.isFinite(row?.latitude) && Number.isFinite(row?.longitude) && Math.hypot((row.latitude-point.lat)*111,(row.longitude-point.lng)*110.4) <= 35;
    const pm25 = near && (units.pm2_5 === "μg/m³" || units.pm2_5 === "µg/m³") ? boundedReading(row.current?.pm2_5, 0, 1000) : null;
    const pm10 = near && (units.pm10 === "μg/m³" || units.pm10 === "µg/m³") ? boundedReading(row.current?.pm10, 0, 1000) : null;
    const usAqi = near && units.us_aqi === "USAQI" ? boundedReading(row.current?.us_aqi, 0, 500) : null;
    point.air = { available: pm25 != null || usAqi != null, pm25, pm10, usAqi, validAt: near ? stamp : null, source: "Open-Meteo / CAMS", tier: "model-estimate" };
  });
  const dirtiest = points.filter(p => p.air?.usAqi != null && p.air.usAqi >= 151).sort((a, b) => b.air.usAqi - a.air.usAqi)[0];
  if (dirtiest && !(watchData.notices || []).some(n => n.topic === "air")) {
    watchData.notices.push({ topic: "air", placeId: dirtiest.id, action: "People should limit long outdoor exertion while this sample stays at or above US AQI 151. An administrator should open the aerosol layer. This point is a model, not a street monitor." });
  }
}
async function refreshCityWatch(force) {
  if (force) liveCache.delete("/api/atlas/watch");
  const data = await fetchLive("/api/atlas/watch", 120);
  watchData = data && Array.isArray(data.places) && Array.isArray(data.notices) ? data : null;
  await fillWatchAir();
  renderCityWatch();
}
function focusWatch(topic) {
  stopMapMotion();
  const layer = { flood: "surface-water", air: "aerosol", wind: "himawari" }[topic];
  const select = document.getElementById("atlas-environment-layer");
  if (layer && select) { select.value = layer; applyEnvironmentOverlay(); }
  const place = watchPlace(topic);
  if (place && mapInstance) {
    mapInstance.flyTo({ center: [place.lng, place.lat], zoom: topic === "flood" ? 11 : 13, pitch: currentView === "2d" ? 0 : 55, bearing: currentView === "2d" ? 0 : -18, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 300, essential: false });
  }
  document.getElementById("atlas-map")?.scrollIntoView({ block: "start" });
}
function setupEnvironmentControls() {
  document.getElementById('atlas-view')?.addEventListener('change', event => setMapView(event.target.value));
  document.getElementById('atlas-basemap')?.addEventListener('change', event => setBasemap(event.target.value));
  // From the power menu, jump straight to the transport answer. It is a lens,
  // but the question gets asked from here, so it is reachable from here.
  document.getElementById('atlas-haze-transport')?.addEventListener('click', () => {
    selectCityLens('haze');
    document.getElementById('atlas-menu')?.removeAttribute('open');
    document.getElementById('atlas-lens-evidence')?.scrollIntoView({ block: 'nearest' });
  });
  document.getElementById('atlas-rainfall-rows')?.addEventListener('click', event => {
    const id = event.target.closest('[data-rain-point]')?.dataset.rainPoint;
    const point = rainfallData?.points.find(p => p.id === id);
    if (point && mapInstance) { stopMapMotion(); mapInstance.jumpTo({ center: [point.lng, point.lat], zoom: 12, pitch: 0, bearing: 0 }); document.getElementById('atlas-map').scrollIntoView({ block: 'start' }); }
  });
  ['atlas-environment-layer', 'atlas-radar-frame', 'atlas-radar-coverage', 'atlas-satellite-date'].forEach(id => document.getElementById(id)?.addEventListener('change', applyEnvironmentOverlay));
  document.getElementById('atlas-environment-opacity')?.addEventListener('input', event => { if (mapInstance?.getLayer('environment-overlay')) mapInstance.setPaintProperty('environment-overlay', 'raster-opacity', Number(event.target.value) / 100); });
  document.getElementById('atlas-environment-overview')?.addEventListener('click', () => { stopMapMotion(); mapInstance?.jumpTo({ center: [106.83, -6.20], zoom: 9, pitch: 0, bearing: 0 }); document.getElementById('atlas-map').scrollIntoView({ block: 'start' }); });
  document.getElementById('atlas-environment-refresh')?.addEventListener('click', () => { refreshEnvironment(true); refreshRainfall(true); refreshCityWatch(true); });
  document.getElementById('atlas-watch')?.addEventListener('click', event => {
    const topic = event.target.closest('[data-watch]')?.dataset.watch;
    if (topic) focusWatch(topic);
  });
  document.getElementById('atlas-environment-export')?.addEventListener('click', () => { if (environmentData) downloadEvidence('jakarta-environment-sources.json', JSON.stringify({ ...environmentData, selectedProduct: selectedEnvironmentProduct(), exportedAt: new Date().toISOString() }, null, 2), 'application/json'); });
  document.getElementById('atlas-rainfall-export')?.addEventListener('click', () => {
    if (!rainfallData) return;
    const fieldKeys = ['location', 'latitude', 'longitude', 'precipitation_mm', 'interval_seconds', 'next24h_mm', 'forecast_from_utc', 'forecast_to_utc', 'valid_at_utc', 'source', 'tier', 'fetched_at_utc'];
    const idHeaders = ['Lokasi', 'Lintang', 'Bujur', 'Presipitasi (mm)', 'Interval (detik)', '24 jam ke depan (mm)', 'Awal prakiraan (UTC)', 'Akhir prakiraan (UTC)', 'Waktu berlaku (UTC)', 'Sumber', 'Jenis data', 'Waktu pengambilan (UTC)'];
    const headers = uiLanguage() === 'id' ? fieldKeys.map((key, i) => idHeaders[i] + ' [' + key + ']') : fieldKeys;
    const csv = [headers, ...rainfallData.points.map(p => [uiLanguage() === 'id' ? p.name_id : p.name, p.lat, p.lng, p.precipitationMm, p.intervalSeconds, p.next24hMm, p.forecastFromUtc, p.forecastToUtc, p.validAt, rainfallData.source, rainfallData.tier, rainfallData.fetchedAt])].map(row => row.map(v => '"' + String(v ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n');
    downloadEvidence('jakarta-rainfall.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8');
  });
  if (mapInstance) {
    mapInstance.on('error', event => { if (['environment-overlay', 'radar-coverage'].includes(event.sourceId)) { environmentTileError = true; setToggleLabel('atlas-environment-status', 'Imagery request failed. Missing pixels do not mean clear skies or dry ground.'); } });
    mapInstance.on('sourcedata', event => { if (event.sourceId === 'environment-overlay' && event.isSourceLoaded && !environmentTileError) setToggleLabel('atlas-environment-status', 'Imagery loaded; blank areas may be missing observations.'); });
  }
  refreshEnvironment(); refreshRainfall(); refreshCityWatch(); refreshAirQuality();
  setInterval(() => { refreshEnvironment(); refreshRainfall(); refreshCityWatch(); }, 600000);
}

// ── Boot ──────────────────────────────────────────────────────────────────
function setupResponsiveControls() {
  // MapLibre 6 starts compact attribution expanded; keep its native disclosure on demand.
  const attribution = document.querySelector('.maplibregl-ctrl-attrib');
  if (attribution) {
    attribution.removeAttribute('open');
    attribution.classList.remove('maplibregl-compact-show');
  }
  const shell = document.getElementById('atlas-watch-shell');
  if (shell) shell.open = false;
  // HUD readings open only on demand at every width; resizing never expands them.
  document.getElementById('atlas-menu')?.addEventListener('click', event => {
    const link=event.target.closest('a');
    if(link){
      if(['#atlas-data','#atlas-environment'].includes(link.getAttribute('href')))document.querySelector('.atlas-embedded-drawer').open=true;
      document.getElementById('atlas-menu').open=false;
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const selectors = '.atlas-menu[open], .atlas-about[open], .atlas-extra-controls[open], .atlas-environment-details[open], .atlas-watch-notices[open], .atlas-watch-shell[open], .atlas-embedded-drawer[open], #atlas-lens-evidence[open], .atlas-quick-details[open], .atlas-layers details[open]';
    document.querySelectorAll(selectors).forEach(details => {
      const focused = details.contains(document.activeElement);
      details.open = false;
      if (focused) details.querySelector('summary')?.focus();
    });
  });
}

async function boot() {
  setupResponsiveControls();
  try {
    const r = await fetch(ATLAS_BASE + "/jakarta-areas.json", { cache: "no-store" });
    if (!r.ok) throw new Error("areas fetch failed");
    areasDoc = await r.json();
  } catch (e) {
    console.error("Failed to load areas", e);
    showToast("Quick jump unavailable. You can still explore the map.", 4000);
    areasDoc = { areas: [] };
  }

  renderAreaGrid();
  setupEnvironmentControls();
  if (!mapInstance) {
    setToggleLabel("atlas-map-status", "3D map unavailable. Use the text data below or reload to retry.");
    return;
  }
  setupInspect();

  function onMapReady() {
    try {
      applyAllLayers();
    } catch (e) {
      console.error("[atlas] applyAllLayers failed", e);
    }
    setupLayerToggles();
    mapInstance.on('click','fire-hotspots',event=>{
      const f=event.features?.[0];if(!f||activeLens!=='haze')return;
      renderLensEvidence();
      const p=f.properties||{},coordinates=f.geometry.coordinates;
      const row=document.createElement('p');row.className='network-location';
      row.textContent=coordinates[1].toFixed(6)+', '+coordinates[0].toFixed(6)+' · WGS84 · '+formatLocal(p.observedAt)+' · FRP '+(Number.isFinite(p.frp)?fmtNum(p.frp,1)+' MW':lensText('unknown','tidak diketahui'))+' · '+p.confidence+' · '+(p.sensor||'NOAA-20 VIIRS')+' · '+(p.product||'375 m Collection 2')+' · '+lensText('version ','versi ')+(p.version||lensText('not supplied','tidak tersedia'));
      document.getElementById('atlas-lens-body').prepend(row);document.getElementById('atlas-lens-evidence').open=true;
    });
    setBasemap(currentBasemap);
    const view = new URLSearchParams(window.location.search).get("view");
    if (view === "2d") setMapView("2d");
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("area");
    if (initial) flyToArea(initial, { updateHash: false, instant: true });
    refreshAirQuality();
    applySunLight();
    applyMapLanguage();
    setInterval(applySunLight, 60000);
    ["mousedown", "touchstart", "wheel", "keydown"].forEach(function (ev) {
      document.addEventListener(ev, armIdleOrbit, { passive: true, capture: true });
    });
    armIdleOrbit();

    // Self-test + handshake. Count the layers + sources we just added.
    // If PMTiles failed silently (range 416, CORS block, missing tile
    // header) the source will exist but have 0 features -- emit a console
    // error so the failure is loud, not a silently-blank map. Then tell
    // the parent dashboard "ready" + which build is actually loaded so
    // the dashboard can show a stale-bundle warning when iframe atlas
    // version != the dashboard's pinned BUILD_ID.
    const srcIds = mapInstance.getStyle().sources
      ? Object.keys(mapInstance.getStyle().sources)
      : [];
    const layerIds = mapInstance.getStyle().layers
      ? mapInstance.getStyle().layers.map(function (l) { return l.id; })
      : [];
    const hasBuildings = layerIds.indexOf("jkt-buildings") !== -1;
    if (!hasBuildings) {
      console.error(
        "[atlas] jkt-buildings layer is missing after onMapReady -- PMTiles may have failed",
      );
    }
    postMsg("ready", {
      version: ATLAS_BUILD_TAG,
      sources: srcIds,
      layers: layerIds,
      buildingsPresent: hasBuildings,
    });
  }
  // Add layers when the style object exists. `loaded()` waits for every
  // satellite tile, so a slow Esri response never reaches onMapReady and
  // the buildings, buses, and sensor labels never appear. `isStyleLoaded`
  // is the warm path; `style.load` is the cold path.
  styleReady.then(onMapReady);

  const flyoverBtn = document.getElementById("atlas-flyover-btn");
  if (flyoverBtn) {
    flyoverBtn.addEventListener("click", function () {
      if (flyoverTimer) stopFlyover();
      else startFlyover();
    });
  }

  $$(".atlas-basemap-btn").forEach(function (b) {
    b.addEventListener("click", function () { setBasemap(b.dataset.bas); });
  });
}

boot().catch(function (e) {
  console.warn("[atlas] startup failed:", e.message);
  setToggleLabel("atlas-map-status", "Map startup failed. Reload to retry; use the text data below.");
});
refreshAirQuality();
loadReferenceText();
setInterval(refreshAirQuality, 300000);
setInterval(() => { if (activeLens === "haze" || layerVisibility["fire-hotspots"]) refreshFires(false); }, 900000);
document.getElementById("atlas-orbit-btn")?.addEventListener("click", function (e) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { showToast("Orbit paused for reduced motion."); return; }
  if (currentView === "2d") setMapView("3d");
  orbitEnabled = !orbitEnabled;
  e.currentTarget.setAttribute("aria-pressed", String(orbitEnabled));
  e.currentTarget.textContent = orbitEnabled ? "Pause orbit" : "Enable orbit";
  if (!orbitEnabled && mapInstance) mapInstance.stop();
  armIdleOrbit();
});
window.addEventListener('atlas:language', function () {
  postMsg('language', { language: uiLanguage() });
  renderAreaGrid(); applyMapLanguage(); renderRainfall(); renderCityWatch(); renderRadarFrames(true); renderSatelliteDates(selectedEnvironmentProduct());
  renderEnvironmentEvidence(selectedEnvironmentProduct()); refreshAirQuality();
});

// Recompute the available map viewport when text, language or window size changes.
(function sizeAtlasViewport() {
  if (typeof ResizeObserver === 'undefined') return;
  const header = document.querySelector('.atlas-header');
  const toolbar = document.getElementById('atlas-environment');
  const watch = document.getElementById('atlas-watch');
  const viewport = document.querySelector('.atlas-map-wrap');
  const viewportSize = () => { const rect=viewport?.getBoundingClientRect(); return rect?rect.width+'×'+rect.height:''; };
  if (mapInstance) mapInstance.resize();
  let lastViewportSize=viewportSize();
  const observer = new ResizeObserver(function () {
    if (header) document.documentElement.style.setProperty('--atlas-header-height', header.getBoundingClientRect().height + 'px');
    if (toolbar) document.documentElement.style.setProperty('--atlas-toolbar-height', toolbar.getBoundingClientRect().height + 'px');
    if (watch) document.documentElement.style.setProperty('--atlas-watch-height', watch.getBoundingClientRect().height + 'px');
    const nextSize=viewportSize();
    if (mapInstance && nextSize!==lastViewportSize) { mapInstance.resize();lastViewportSize=nextSize; }
    if (header) postMsg('layout', { headerHeight: header.getBoundingClientRect().height });
  });
  if (header) observer.observe(header);
  if (toolbar) observer.observe(toolbar);
  if (watch) observer.observe(watch);
  if (viewport) observer.observe(viewport);
})();

// ── Insight lenses ──────────────────────────────────────────────────────────
// Four views derived from dated public assets already baked into this project:
// flood exposure, height confidence, green space and flood-monitoring coverage.
// Nothing here invents a number. Each view keeps its own source and date, and
// an area the publisher does not describe is reported as unknown, never as zero.

const INSIGHT_ASSET = '/data/jakarta-v1/insight.json';
const INSIGHT_LENSES = ['exposure', 'confidence', 'green', 'coverage'];
let activeLens = 'city', lensRequest = 0;
let observationController = null, observationPending = null;
async function loadObservationController() {
  if (observationController) return observationController;
  if (!observationPending) observationPending = import('./water-traffic.js?v=' + encodeURIComponent(ATLAS_BUILD_TAG))
    .then(module => { observationController = module.createController(mapInstance, {text:lensText,active:()=>activeLens,buildTag:ATLAS_BUILD_TAG}); return observationController; })
    .finally(() => { observationPending = null; });
  return observationPending;
}
let greenSpaceController = null, greenSpacePending = null;
async function loadGreenSpace() {
  if (greenSpaceController) return greenSpaceController;
  if (!greenSpacePending) greenSpacePending = import('./green-space.js?v=' + encodeURIComponent(ATLAS_BUILD_TAG))
    .then(module => { greenSpaceController = module.createGreenSpace(mapInstance, {text:lensText,active:()=>activeLens,buildTag:ATLAS_BUILD_TAG}); return greenSpaceController; })
    .finally(() => { greenSpacePending = null; });
  return greenSpacePending;
}
// One shared particle canvas for every wind lens. Loaded once; a lens that
// cannot load it still draws its arrows and paths.
let flowCanvas = null, flowCanvasPending = null;
function loadFlow() {
  if (flowCanvas || !mapInstance) return Promise.resolve(flowCanvas);
  return flowCanvasPending ||= import('./flow-canvas.js?v=' + encodeURIComponent(ATLAS_BUILD_TAG))
    .then(module => (flowCanvas = module.createFlowCanvas(mapInstance)))
    .catch(() => null);
}
let windFieldController = null, windFieldPending = null;
async function loadWindField() {
  if (windFieldController) return windFieldController;
  if (!windFieldPending) windFieldPending = import('./wind-field.js?v=' + encodeURIComponent(ATLAS_BUILD_TAG))
    .then(module => loadFlow().then(flow => { windFieldController = module.createWindField(mapInstance, {text:lensText,active:()=>activeLens,buildTag:ATLAS_BUILD_TAG,flow}); return windFieldController; }))
    .finally(() => { windFieldPending = null; });
  return windFieldPending;
}
let hazeTransportController = null, hazeTransportPending = null;
async function loadHazeTransport() {
  if (hazeTransportController) return hazeTransportController;
  if (!hazeTransportPending) hazeTransportPending = import('./haze-transport.js?v=' + encodeURIComponent(ATLAS_BUILD_TAG))
    .then(module => loadFlow().then(flow => { hazeTransportController = module.createHazeTransport(mapInstance, {text:lensText,active:()=>activeLens,buildTag:ATLAS_BUILD_TAG,flow,onFires:applyCurrentFires}); return hazeTransportController; }))
    .finally(() => { hazeTransportPending = null; });
  return hazeTransportPending;
}
let synopticController = null, synopticPending = null;
async function loadSynoptic() {
  if (synopticController) return synopticController;
  if (!synopticPending) synopticPending = import('./synoptic.js?v=' + encodeURIComponent(ATLAS_BUILD_TAG))
    .then(module => loadFlow().then(flow => { synopticController = module.createSynoptic(mapInstance, {text:lensText,active:()=>activeLens,buildTag:ATLAS_BUILD_TAG,flow}); return synopticController; }))
    .finally(() => { synopticPending = null; });
  return synopticPending;
}
let airTimelineController = null, airTimelinePending = null;
async function loadAirTimeline() {
  if (airTimelineController) return airTimelineController;
  if (!airTimelinePending) airTimelinePending = import('./air-timeline.js?v=' + encodeURIComponent(ATLAS_BUILD_TAG))
    .then(module => { airTimelineController = module.createAirTimeline(mapInstance, {text:lensText,active:()=>activeLens,buildTag:ATLAS_BUILD_TAG}); return airTimelineController; })
    .finally(() => { airTimelinePending = null; });
  return airTimelinePending;
}
let insightData = null, insightPending = null, buildingShare = null, stationGeometryState = null;

function lensText(en, id) { return uiLanguage() === 'id' ? id : en; }

function loadInsight() {
  if (insightData) return Promise.resolve(insightData);
  if (insightPending) return insightPending;
  insightPending = fetch(INSIGHT_ASSET + '?v=' + encodeURIComponent(ATLAS_BUILD_TAG), { headers: { accept: 'application/json' } })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('insight ' + r.status)))
    .then(data => { insightData = data; return data; })
    .catch(() => null)
    .finally(() => { insightPending = null; });
  return insightPending;
}

function insightAsset(file, ext) {
  return '/data/jakarta-v1/' + file + '.' + (ext || 'geojson') + '?v=' + encodeURIComponent(ATLAS_BUILD_TAG);
}

function dropInsightLayer(id) {
  if (!mapInstance) return;
  if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
  if (mapInstance.getSource(id)) mapInstance.removeSource(id);
}

function clearInsightLayers() {
  ['insight-risk', 'insight-green', 'insight-stations'].forEach(dropInsightLayer);
}

// Scale each view on its own measured spread rather than a rounded constant, so
// the legend can never claim a band the data does not reach.
function quantileBands(values, step) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return [];
  const cut = [];
  for (let q = step; q < 1; q += step) cut.push(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]);
  return [...new Set(cut)];
}

function bandOf(value, cuts) {
  let band = 0;
  while (band < cuts.length && value > cuts[band]) band++;
  return band;
}

function removeInsightLayersWhenLeaving(lens) {
  clearInsightLayers();
  if (lens !== 'confidence' && buildingPaintMode === 'confidence') { buildingPaintMode = 'height'; applyMapTheme(); }
  buildingShare = null;
}

async function renderExposureLens(request) {
  const data = await loadInsight();
  if (request !== lensRequest || !data) return null;
  const rows = data.exposure.kelurahan;
  const cuts = quantileBands(rows.map(r => r.exposureScore), 0.25);
  const geo = await fetch(insightAsset('risk'), { headers: { accept: 'application/json' } }).then(readStatic).catch(() => null);
  if (request !== lensRequest) return null;
  if (!geo) { showToast(lensText('Flood-risk geometry is unavailable. See Data & sources.', 'Geometri rawan banjir tidak tersedia. Lihat Data & sumber.')); return null; }
  // The published geometry writes the neighbourhood code as 31.71.03.1008 while
  // the aggregate uses 3171011001. Add the digits-only key rather than editing
  // the published value, so the join is explicit and reversible.
  const features = geo.features.map(f => ({
    ...f,
    properties: { ...f.properties, __code: String(f.properties.kelurahanCode || '').replace(/\D/g, '') },
  }));
  const byCode = ['match', ['get', '__code']];
  const hazard = mapTheme().hazard;
  rows.forEach(r => byCode.push(r.kelurahanCode, hazard[bandOf(r.exposureScore, cuts)]));
  byCode.push(hazard[0]);
  dropInsightLayer('insight-risk');
  mapInstance.addSource('insight-risk', { type: 'geojson', data: { type: 'FeatureCollection', features } });
  mapInstance.addLayer({
    id: 'insight-risk', type: 'fill', source: 'insight-risk',
    paint: { 'fill-color': byCode, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.25, 13, 0.7] },
  });
  return { cuts };}

async function loadGreenGeometry(request) {
  const geo = await fetch(insightAsset('green'), { headers: { accept: 'application/json' } }).then(readStatic).catch(() => null);
  if (request !== lensRequest || !geo) return false;
  dropInsightLayer('insight-green');
  mapInstance.addSource('insight-green', { type: 'geojson', data: geo });
  mapInstance.addLayer({
    id: 'insight-green', type: 'fill', source: 'insight-green',
    paint: { 'fill-color': mapTheme().green, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.35, 14, 0.6] },
  });
  return true;
}

async function loadStationGeometry(request) {
  const files = ['awlr', 'arr', 'pumps'];
  const parts = await Promise.all(files.map(f => fetch(insightAsset(f), { headers: { accept: 'application/json' } }).then(readStatic).catch(() => null)));
  if (request !== lensRequest) return false;
  stationGeometryState = files.filter((file, i) => !parts[i]?.features);
  const data = { type: 'FeatureCollection', features: parts.flatMap((part, i) => (part?.features ? part.features.map(f => ({ ...f, properties: { ...f.properties, __kind: i < 2 ? i : ({'Pompa':2,'Pintu Air':3,'Waduk & Embung':4}[f.properties.kind] ?? 5) } })) : [])) };
  const theme = mapTheme();
  dropInsightLayer('insight-stations');
  mapInstance.addSource('insight-stations', { type: 'geojson', data });
  mapInstance.addLayer({
    id: 'insight-stations', type: 'circle', source: 'insight-stations',
    paint: {
      // Water level, rain and pumps keep the meanings the project already uses
      // for them elsewhere: water, gauge accent, and the sensor green.
      'circle-radius': ['match', ['get', '__kind'], 0, 5, 1, 4, 2, 6, 3, 3, 8],
      'circle-color': ['match', ['get', '__kind'], 0, theme.water, 1, theme.accent, 2, theme.sensor, 3, theme.civic, theme.green],
      'circle-opacity': 0.9,
      'circle-stroke-color': '#0f1b33', 'circle-stroke-width': 1.5,
    },
  });
  return true;
}

function buildingConfidenceShare() {
  if (!mapInstance || !mapInstance.getLayer('jkt-buildings')) return null;
  const rows = mapInstance.queryRenderedFeatures(undefined, { layers: ['jkt-buildings'], filter: ['has', 'hs'] });
  const tally = {};
  for (const row of rows) {
    const key = row.properties.hs;
    tally[key] = (tally[key] || 0) + 1;
  }
  const total = rows.length;
  if (!total) return null;
  return { total, tally };
}

function lensPanelBody() {
  const body = document.getElementById('atlas-lens-body');
  body.replaceChildren();
  return body;
}

function lensNoteLine(text, cls) {
  const p = document.createElement('p');
  p.className = cls ? 'lens-note ' + cls : 'lens-note';
  p.textContent = text;
  return p;
}

function lensTable() {
  const table = document.createElement('div');
  table.className = 'lens-table';
  return table;
}

function lensRow(label, value, extra) {
  const row = document.createElement('div');
  row.className = 'lens-row';
  const left = document.createElement('span');
  left.textContent = label;
  const right = document.createElement('strong');
  right.textContent = value;
  row.append(left, right);
  if (extra) {
    const sub = document.createElement('span');
    sub.className = 'lens-sub';
    sub.textContent = extra;
    row.append(sub);
  }
  return row;
}

function lensSource(text) {
  const p = document.createElement('p');
  p.className = 'lens-source';
  p.textContent = text;
  return p;
}

function renderExposurePanel(data) {
  const body = lensPanelBody();
  body.append(lensNoteLine(lensText(
    'Area-weighted population proxy: neighbourhood residents × severe share of mapped risk land. Assumes uniform density within mapped land; not located residents or people currently flooded.',
    'Proksi penduduk berbobot luas: penduduk kelurahan × porsi lahan risiko terpetakan pada kelas berat. Mengasumsikan kepadatan merata di lahan terpetakan; bukan lokasi penduduk atau jumlah warga yang sedang kebanjiran.')));
  const table = lensTable();
  const detail = lensNoteLine('');
  detail.className = 'lens-note lens-note--detail';
  for (const row of data.exposure.kelurahan.slice(0, 12)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lens-row lens-row--button';
    const name = document.createElement('span');
    name.textContent = (row.kelurahan || '—') + ' · ' + String(row.kota || '').replace('Kota Adm. Jakarta ', '');
    const value = document.createElement('strong');
    value.textContent = fmtNum(row.population.residentsOnSevere, 0) + ' ' + lensText('population proxy', 'proksi penduduk');
    button.append(name, value);
    button.addEventListener('click', () => {
      if (Array.isArray(row.center)) mapInstance?.flyTo({ center: row.center, zoom: 12.8, pitch: currentView === '2d' ? 0 : 45 });
      detail.textContent = (row.kelurahan || '') + ' — ' + lensText('mapped risk', 'risiko terpetakan') + ' ' + fmtNum(row.riskAreaHa, 0) + ' ha · ' +
        lensText('severe share', 'porsi berat') + ' ' + row.beratSharePct + '% · ' +
        lensText('residents', 'penduduk') + ' ' + fmtNum(row.population.wni, 0) +
        ' (' + lensText('children', 'anak') + ' ' + fmtNum(row.population.children, 0) +
        ', ' + lensText('aged 60+', 'usia 60+') + ' ' + fmtNum(row.population.elderly60, 0) + ')';
    });
    table.append(button);
  }
  body.append(table, detail);
  body.append(lensSource('Jakarta Satu flood-risk reference · population ' + data.exposure.populationPeriod + ' · ' + (data.checkedAt || 'undated')));
}

function renderGreenPanel(data) {
  const body = lensPanelBody();
  body.append(lensNoteLine(lensText(
    'Green-space area is computed from published polygon geometry, not a publisher-declared total. This is a reference inventory, not every park in the city.',
    'Luas ruang hijau dihitung dari geometri poligon yang dipublikasikan, bukan total resmi penerbit. Ini inventaris referensi, bukan semua taman di kota.')));
  const table = lensTable();
  for (const row of data.green.byBorough) {
    table.append(lensRow(
      row.kota.replace('Kota Adm. Jakarta ', ''),
      fmtNum(row.greenHa, 0) + ' ha',
      Number.isFinite(row.greenSharePct)
        ? row.greenSharePct + '% ' + lensText('of borough area', 'luas borough') + ' · ' + row.polygons + ' ' + lensText('polygons', 'poligon')
        : lensText('no borough area published', 'luas borough tidak dipublikasikan')));
  }
  body.append(table);
  body.append(lensSource('Jakarta Satu green-space reference · ' + data.checkedAt +
    ' · ' + data.green.unknownKindPolygons + ' ' + lensText('polygons with an unstated category', 'poligon tanpa kategori') +
    ' · ' + data.green.unresolvedFeatures + ' ' + lensText('rows not placed in any borough', 'baris tidak masuk borough mana pun')));
}

function renderCoveragePanel(data) {
  const body = lensPanelBody();
  body.append(lensNoteLine(lensText(
    'A neighbourhood with no published station is not a cleared neighbourhood. This is the inventory the publisher publishes, not a survey of what exists.',
    'Kelurahan tanpa stasiun yang dipublikasikan bukan kelurahan yang aman. Ini inventaris yang dipublikasikan penerbit, bukan survei apa yang ada.')));
  renderCoverageSeeAlso(body);
  const table = lensTable();
  for (const row of data.coverage.byBorough) {
    table.append(lensRow(
      row.kota.replace('Kota Adm. Jakarta ', ''),
      row.kelurahanWithPublishedPump + ' / ' + row.kelurahanWithRiskMapping,
      lensText('mapped neighbourhoods with a published pump', 'kelurahan terpetakan dengan pompa terpublikasi') + ' · ' +
      lensText('water-level stations', 'stasiun tinggi air') + ' ' + row.awlrStations + ' · ' +
      lensText('rain gauges', 'curah hujan') + ' ' + row.arrGauges + ' · ' +
      lensText('pumps', 'pompa') + ' ' + row.pumps +
      (row.floodgates === null
        ? ' · ' + lensText('floodgates not placed by borough', 'pintu air tidak terpetakan per borough')
        : ' · ' + lensText('floodgates', 'pintu air') + ' ' + row.floodgates)));
  }
  body.append(table);
  body.append(lensNoteLine(lensText('Select a map point to read its published name and coordinates. Inventory locations, not live operating status.', 'Pilih titik peta untuk membaca nama dan koordinat terpublikasi. Lokasi inventaris, bukan status operasi langsung.')));
  const legend=lensTable();
  const palette=mapTheme();
  const types=[[0,'Water-level stations','Pos tinggi air',palette.water],[1,'Rain gauges','Pos curah hujan',palette.accent],[2,'Pumps','Pompa',palette.sensor],[3,'Floodgates','Pintu air',palette.civic],[4,'Reservoirs','Waduk/embung',palette.green]];
  for(const [kind,en,id,color] of types){const row=lensRow(lensText(en,id),'●');row.children[1].style.color=color;legend.append(row);}
  body.append(legend);
  if(stationGeometryState?.length)body.append(lensNoteLine(lensText('Map inventory unavailable: ', 'Inventaris peta tidak tersedia: ')+stationGeometryState.join(', ')));
  body.append(lensSource('Jakarta Satu monitoring network · checked ' + (data.checkedAt || 'undated') +
    ' · ' + lensText('water-level and rain records publish no neighbourhood', 'stasiun tinggi air dan hujan tidak menyebut kelurahan')));
}

// The flood-monitoring lens is about what the network does and does not reach.
// So the overlays here are exactly the instruments that see past it — each one
// paired with what it adds, and each carrying its own date. None of them is a
// substitute for a gauge, and none is called one.
function renderCoverageSeeAlso(body) {
  const products = environmentData?.products || [];
  const find = (id) => products.find((p) => p.id === id);
  const radar = environmentData?.radar;
  const frames = radar?.frames || [];

  const head = document.createElement('h3');
  head.className = 'lens-subhead';
  head.textContent = lensText('What else sees this', 'Apa lagi yang melihat ini');
  body.append(head);

  const stack = document.createElement('div'); stack.className = 'synoptic-toggles';
  const pick = (product, en, id) => {
    const b = document.createElement('button'); b.type = 'button';
    b.textContent = lensText(en[0], en[1]); b.dataset.coverageProduct = id;
    b.setAttribute('aria-pressed', String(document.getElementById('atlas-environment-layer')?.value === product));
    b.addEventListener('click', () => {
      const selector = document.getElementById('atlas-environment-layer');
      if (!selector) return;
      selector.value = product;
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      renderLensEvidence();
    });
    stack.append(b);
  };
  pick('radar', ['Radar', 'Radar'], 'radar');
  pick('surface-water', ['Satellite water', 'Air dari satelit'], 'surface-water');
  pick('satellite-rain', ['Satellite rain', 'Hujan satelit'], 'satellite-rain');
  pick('himawari', ['Cloud tops', 'Puncak awan'], 'himawari');
  body.append(stack);

  // The map switcher can only pick imagery. The rows below are the record:
  // what each source actually is, when it was measured, and at what scale.
  const seen = lensTable();
  const row = (name, when, extra) => {
    const r = lensRow(name, when, extra);
    seen.append(r);
    return r;
  };
  const water = find('surface-water');
  if (water?.available) row(lensText('Standing water', 'Air tergenang'),
    water.date + ' · ' + water.resolution,
    lensText('Satellite classification. Sees water where no station is published — and clouds can hide it.',
      'Klasifikasi satelit. Melihat air di tempat tanpa stasiun terpublikasi — dan awan dapat menyembunyikannya.'));
  else row(lensText('Standing water', 'Air tergenang'), lensText('unavailable', 'tidak tersedia'),
    lensText('No dated classification from the provider. No water is assumed, and none is ruled out.',
      'Tidak ada klasifikasi bertanggal dari penyedia. Air tidak diasumsikan, dan tidak juga disingkirkan.'));

  if (radar?.available && frames.length) row(lensText('Rain, last 2 hours', 'Hujan, 2 jam terakhir'),
    formatLocal(frames[frames.length - 1].observedAt) + ' · ' + frames.length + ' ' + lensText('frames', 'frame'),
    lensText('Radar composite. Sees rain beyond every published gauge. No echo is not proof of no rain outside coverage.',
      'Komposit radar. Melihat hujan di luar setiap pos terpublikasi. Tidak ada gema bukan bukti tidak hujan di luar cakupan.'));
  else row(lensText('Rain, last 2 hours', 'Hujan, 2 jam terakhir'), lensText('unavailable', 'tidak tersedia'),
    lensText('No radar frames returned. Absence of echo is not an all-clear.',
      'Tidak ada frame radar. Tidak adanya gema bukan berarti aman.'));

  const imerg = find('satellite-rain');
  if (imerg?.available) row(lensText('Satellite rain estimate', 'Perkiraan hujan satelit'),
    imerg.date + ' · ' + imerg.resolution,
    lensText('A satellite rate, not a ground radar. Rainfall estimate over areas with no gauge.',
      'Laju dari satelit, bukan radar darat. Perkiraan hujan di area tanpa pos.'));
  else row(lensText('Satellite rain estimate', 'Perkiraan hujan satelit'), lensText('unavailable', 'tidak tersedia'),
    lensText('No dated estimate from the provider. No rain is assumed.', 'Tidak ada perkiraan bertanggal. Hujan tidak diasumsikan.'));

  const ir = find('himawari');
  if (ir?.available) row(lensText('Cloud tops', 'Puncak awan'),
    formatLocal(ir.date) + ' · ' + ir.resolution,
    lensText('Infrared cloud-top temperature, not rainfall. Deep convection shows as cold tops before any gauge sees rain.',
      'Suhu puncak awan inframerah, bukan hujan. Konveksi dalam tampak sebagai puncak dingin sebelum pos mana pun melihat hujan.'));
  else row(lensText('Cloud tops', 'Puncak awan'), lensText('unavailable', 'tidak tersedia'),
    lensText('No dated infrared frame. Nothing is inferred about the sky.', 'Tidak ada frame inframerah bertanggal. Tidak ada yang disimpulkan tentang langit.'));

  const wettest = (rainfallData?.points || []).filter((p) => Number.isFinite(p.next24hMm)).sort((a, b) => b.next24hMm - a.next24hMm)[0];
  row(lensText('Rain, next 24 h', 'Hujan, 24 jam ke depan'),
    wettest ? fmtNum(wettest.next24hMm, 1) + ' mm ' + lensText('wettest of', 'terbasah dari') + ' 5 ' + lensText('points', 'titik') : lensText('unavailable', 'tidak tersedia'),
    lensText('Model forecast at five sample points, one per kota. Not a neighbourhood forecast.',
      'Prakiraan model di lima titik sampel, satu per kota. Bukan prakiraan per kelurahan.'));
  body.append(seen);
  body.append(lensNoteLine(lensText(
    'All five are separate kinds of evidence and none replaces a station. A blank cell in this lens means nobody has published a station there — not that nothing is happening.',
    'Kelima ini adalah bukti yang berbeda dan tidak ada yang menggantikan stasiun. Sel kosong di lensa ini berarti tidak ada stasiun terpublikasi — bukan berarti tidak ada yang terjadi.')));
}

function renderConfidencePanel(data, share) {
  const body = lensPanelBody();
  body.append(lensNoteLine(lensText(
    'Every building states where its height came from. This colours by that source, not by size: it says how well a height is known, not how well a footprint is drawn.',
    'Setiap bangunan menyatakan asal tingginya. Warna menandakan asal itu, bukan ukuran: ini mengatur seberapa baik tinggi diketahui, bukan seberapa baik tapak digambar.')));
  const labels = {
    measured: ['Tagged height', 'Tinggi bertag'],
    landmark: ['Published landmark', 'Landmark terpublikasi'],
    google: ['Satellite, per building', 'Satelit, per bangunan'],
    floors: ['Floor count × 3.3 m', 'Jumlah lantai × 3,3 m'],
    ghsl: ['100 m area average', 'Rata-rata area 100 m'],
    estimated: ['Unknown height · flat footprint', 'Tinggi tidak diketahui · tapak datar'],
  };
  const table = lensTable();
  for (const key of data.confidence.order) {
    const count = share ? share.tally[key] : 0;
    table.append(lensRow(
      labels[key] ? lensText(labels[key][0], labels[key][1]) : key,
      share ? (count ? fmtNum(100 * count / share.total, 0) + '%' : lensText('none on screen', 'tidak ada di layar')) : '—',
      data.confidence.sources[key]));
  }
  body.append(table);
  body.append(lensSource((share
    ? fmtNum(share.total, 0) + ' ' + lensText('buildings on screen', 'bangunan di layar')
    : lensText('Move the map to count buildings', 'Geser peta untuk menghitung bangunan')) +
    ' · ' + lensText('simplified rendered footprints, not a census', 'tapak terender yang disederhanakan, bukan sensus') +
    ' · ' + lensText('checked', 'diperiksa') + ' ' + (data.checkedAt || lensText('undated', 'tanpa tanggal'))));
}

function renderHazeEvidence(body) {
  body.append(lensNoteLine(lensText('NASA NOAA-20 VIIRS thermal detections, nominal 375 m. Only valid records within 24 hours are admitted. Clouds and satellite coverage can hide activity; an empty result does not mean no fire or clean air.', 'Deteksi termal NASA NOAA-20 VIIRS, nominal 375 m. Hanya rekaman valid dalam 24 jam yang ditampilkan. Awan dan cakupan satelit dapat menyembunyikan aktivitas; hasil kosong bukan berarti tanpa kebakaran atau udara bersih.')));
  const count=lensNoteLine(firesData?fmtNum(firesData.features.length,0)+' '+lensText('detections on map · retrieved ','deteksi pada peta · diambil ')+formatLocal(firesData.fetchedAt):lensText('No current thermal count available.','Jumlah termal terkini belum tersedia.'));
  count.id='haze-thermal-status';body.append(count);
  body.append(lensNoteLine(lensText('Select a detection for acquisition time, coordinates and radiative power. Radiative power is not emitted particle mass. Visible imagery has its own date.','Pilih deteksi untuk waktu akuisisi, koordinat dan daya radiasi. Daya radiasi bukan massa partikel yang dilepaskan. Citra tampak memiliki tanggal sendiri.')));
  const source=document.createElement('a');source.href='https://firms.modaps.eosdis.nasa.gov/';source.target='_blank';source.rel='noopener';source.textContent=lensText('NASA FIRMS source ↗','Sumber NASA FIRMS ↗');body.append(source);
  const archive=document.createElement("details"),summary=document.createElement("summary");
  summary.textContent=lensText("Historical Jakarta ISPU · monthly record","ISPU Jakarta historis · catatan bulanan");archive.append(summary);body.append(archive);renderOfficialIspu(archive);
}
// Official ISPU record from the five DLH SPKU stations, read from the same
// dated ispu-reference.json the dashboard observations use — one bake, one
// source. A monthly-published baseline, never a live reading.
let ispuReference = null, ispuReferenceLoad = null;
function loadIspuReference() {
  if (!ispuReferenceLoad) ispuReferenceLoad = fetch(insightAsset('ispu-reference', 'json'), { headers: { accept: 'application/json' } })
    .then(readStatic)
    .then(d => { if (!d || !Array.isArray(d.monthly)) { ispuReferenceLoad = null; return null; } ispuReference = d; if (activeLens === 'haze') renderLensEvidence(); return d; })
    .catch(() => { ispuReferenceLoad = null; return null; });
  return ispuReferenceLoad;
}
function renderOfficialIspu(body) {
  body.append(lensNoteLine(lensText('Official record · DLH stations (ISPU, Indonesia\'s index)', 'Catatan resmi · stasiun DLH (ISPU, indeks Indonesia)'), 'lens-haze-guidance'));
  if (!ispuReference) { loadIspuReference(); body.append(lensNoteLine(lensText('Official ISPU station record unavailable or loading.', 'Catatan ISPU stasiun resmi tidak tersedia atau sedang dimuat.'))); return; }
  const monthName = m => new Date(m + '-01T00:00:00Z').toLocaleDateString(uiLanguage() === 'id' ? 'id-ID' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const octobers = [...new Set(ispuReference.monthly.filter(m => m.month.endsWith('-10')).map(m => m.month))].sort();
  for (const st of ispuReference.stations) {
    const latest = ispuReference.monthly.find(m => m.station === st.code && m.month === ispuReference.latestMonth);
    const octs = ispuReference.monthly.filter(m => m.station === st.code && octobers.includes(m.month));
    const octText = octs.map(m => monthName(m.month) + ': ' + fmtNum(m.unhealthyDays, 0) + '/' + m.days + lensText(' unhealthy days', ' hari tidak sehat')).join(' · ');
    const latestText = latest ? monthName(latest.month) + ': ' + lensText('median PM2.5 ISPU ', 'median ISPU PM2.5 ') + (latest.pm25Median ?? '—') + ', ' + fmtNum(latest.unhealthyDays, 0) + '/' + latest.days + lensText(' unhealthy days', ' hari tidak sehat') : lensText('no recent month', 'tidak ada bulan terbaru');
    body.append(lensNoteLine(st.code + ' ' + st.name + ' · ' + latestText + (octText ? ' · ' + lensText('Octobers ', 'Oktober-Oktober ') + octText : '')));
  }
  body.append(lensNoteLine(lensText('Unhealthy = ISPU category Tidak Sehat or worse. Published monthly by DLH DKI Jakarta through Satu Data Jakarta; the record runs through ' + ispuReference.observedAt.latestPeriod + ' and is not live. Live readings: udara.jakarta.go.id and BMKG.', 'Tidak sehat = kategori ISPU Tidak Sehat atau lebih buruk. Diterbitkan bulanan oleh DLH DKI Jakarta melalui Satu Data Jakarta; catatan berlaku hingga ' + ispuReference.observedAt.latestPeriod + ' dan bukan data langsung. Pembacaan langsung: udara.jakarta.go.id dan BMKG.'), 'lens-haze-limits'));
}

function renderLensEvidence() {
  const titles = {
    waterways: ['Mapped waterways, incoming-water evidence', 'Alur air terpetakan, bukti air masuk'],
    traffic: ['Public street cameras, with source access', 'Kamera jalan publik dengan akses sumber'],
    radar: ['Rain echoes, with coverage', 'Gema hujan radar dan cakupannya'],
    cloud: ['Watch the cloud system', 'Pantau sistem awan'],
    arrival: ['Upstream → Jakarta · an adjustable scenario', 'Hulu → Jakarta · skenario yang dapat diatur'],
    city: ['Read the city, from skyline to street', 'Baca kota, dari cakrawala hingga jalan'],
    rain: ['The rain system, from city to region', 'Sistem hujan, dari kota ke kawasan'],
    water: ['Water the satellite can see', 'Air yang terlihat dari satelit'],
    recurring: ['Where water has recurred', 'Di mana genangan berulang'],
    air: ['Wind field, air model timeline and satellite aerosol', 'Medan angin, linimasa model udara dan aerosol satelit'],
    night: ['The city at night', 'Kota pada malam hari'],
    haze: ['Regional haze evidence', 'Bukti kabut asap kawasan'],
    exposure: ['Population and severe-risk land', 'Penduduk dan lahan risiko berat'],
    confidence: ['How well each height is known', 'Seberapa baik setiap tinggi diketahui'],
    green: ['Where the city keeps its green', 'Di mana kota menyimpan ruang hijaunya'],
    coverage: ['Where Jakarta is instrumented, and where it is not', 'Di mana Jakarta terukur, dan di mana tidak']
  };
  const descriptions = {
    waterways: ['Mapped drainage, observed levels and predicted discharge stay distinct. Open evidence for volume assumptions and NASA/JAXA comparison.', 'Drainase terpetakan, tinggi teramati, dan prediksi debit tetap dipisahkan. Buka bukti untuk asumsi volume dan perbandingan NASA/JAXA.'],
    traffic: ['Published camera locations and on-demand provider players. Availability is unverified; camera coverage is not measured congestion.', 'Lokasi kamera terpublikasi dan pemutar penyedia sesuai permintaan. Ketersediaan belum terverifikasi; cakupan kamera bukan kemacetan terukur.'],
    radar: ['RainViewer radar · no echo is not proof of no rain outside radar coverage.', 'Radar RainViewer · tidak ada gema bukan bukti tidak hujan di luar cakupan radar.'],
    cloud: ['Himawari infrared · cloud-top temperature, not rainfall intensity. Check the observation time.', 'Inframerah Himawari · suhu puncak awan, bukan intensitas hujan. Periksa waktu pengamatan.'],
    arrival: ['Illustrative travel time, not a flood forecast. Admitted segments follow mapped Ciliwung geometry; gaps remain schematic. Open evidence to play or change assumptions.', 'Waktu tempuh ilustratif, bukan prakiraan banjir. Segmen lolos mengikuti geometri Ciliwung terpetakan; celah tetap berupa skema. Buka bukti untuk memutar atau mengubah asumsi.'],
    city: ['Choose a map lens. Sources and valid times stay with the evidence.', 'Pilih lensa peta. Sumber dan waktu berlaku selalu menyertai data.'],
    rain: ['Compare radar, satellite rain and cloud tops. Open the regional pressure and wind controls below; select a city point for its hourly outlook.',
      'Bandingkan radar, hujan satelit dan puncak awan. Buka kontrol tekanan dan angin regional di bawah; pilih titik kota untuk prakiraan per jam.'],
    water: ['NASA MODIS · cyan: water; red: detected flood; yellow: recurring flood. Clouds can hide water. Check the observation day.', 'NASA MODIS · biru muda: air; merah: banjir terdeteksi; kuning: banjir berulang. Awan dapat menutupi air. Periksa hari pengamatan.'],
    recurring: ['NASA MODIS · yellow marks recurring flood in the satellite classification. This is not a prediction of how long water will remain.', 'NASA MODIS · kuning menandai banjir berulang dalam klasifikasi satelit. Ini bukan prakiraan berapa lama air bertahan.'],
    air: ['An animated 10 m wind field, the CAMS model timeline and NASA atmospheric aerosol are three distinct kinds of evidence. Motion shows wind speed and bearing between the provider\'s own model cells — it is not a pollution plume and carries no concentration.', 'Medan angin 10 m yang bergerak, linimasa model CAMS, dan aerosol atmosfer NASA adalah tiga jenis bukti yang berbeda. Gerak menunjukkan kecepatan dan arah angin antar sel model penyedia — ini bukan sebaran polusi dan tidak membawa konsentrasi.'],
    night: ['Corrected Black Marble radiance with its product date. Open Layer settings to compare the 2016 composite, VIIRS aerosol or OMPS index. These products do not quantify city growth.', 'Radiansi Black Marble terkoreksi dengan tanggal produk. Buka Pengaturan lapisan untuk membandingkan komposit 2016, aerosol VIIRS atau indeks OMPS. Produk ini tidak mengukur pertumbuhan kota.'],
    haze: ['Satellite visible imagery and dated thermal detections. A hot pixel is not a confirmed fire or proof of Jakarta pollution.', 'Citra satelit tampak dan deteksi termal bertanggal. Piksel panas bukan kebakaran terkonfirmasi atau bukti polusi Jakarta.'],
    exposure: ['Jakarta Satu flood-risk classes · shaded by weighted risk-class mix (Ringan 1, Sedang 3, Berat 6). Population figures are area-weighted proxies, not located residents.', 'Kelas rawan banjir Jakarta Satu · diarsir menurut campuran kelas berbobot (Ringan 1, Sedang 3, Berat 6). Angka penduduk adalah proksi berbobot luas, bukan penduduk yang terlokasi.'],
    confidence: ['Overture footprints · coloured by height source. Bright is tagged or published; unmeasured defaults remain flat footprints.', 'Tapak Overture · diwarnai menurut asal tinggi. Terang berarti bertag atau terpublikasi; tinggi tanpa sumber tetap berupa tapak datar.'],
    green: ['Jakarta Satu green-space reference · area computed from the published polygons. This is not every park, and not an official green-space total.', 'Referensi ruang hijau Jakarta Satu · luas dihitung dari poligon yang dipublikasikan. Ini bukan semua taman, dan bukan total resmi ruang hijau.'],
    coverage: ['Jakarta Satu monitoring network · stations, gauges and pumps as published. An area with none published is not a cleared area.', 'Jaringan pemantauan Jakarta Satu · stasiun, alat ukur dan pompa sesuai yang dipublikasikan. Area tanpa satupun yang dipublikasikan bukan area yang aman.']
  };
  document.getElementById('atlas-lens-title').textContent = lensText(...titles[activeLens]);
  document.getElementById('atlas-lens-description').textContent = lensText(...descriptions[activeLens]);
  const body = document.getElementById('atlas-lens-body');
  if (['waterways','traffic'].includes(activeLens)) { if (!observationController) body.textContent=lensText('Loading mapped evidence…','Memuat bukti terpetakan…'); return; }
  body.replaceChildren();
  if (activeLens === 'air') {
    // Wind field first, then the timeline: same order as selectCityLens builds
    // them, so a repaint here does not reorder what the user is reading. Each
    // controller renders its own loading state inside show(), so a repaint must
    // not append another placeholder or the panel grows a line every refresh.
    if (windFieldController) windFieldController.render(body);
    if (airTimelineController) airTimelineController.render(body);
    else if (!windFieldController) body.textContent = lensText('Loading the model timeline…', 'Memuat linimasa model…');
    return;
  }
  if (activeLens === 'haze') {
    renderHazeEvidence(body);
    // Repaint-safe: this branch runs after body.replaceChildren(), so the
    // transport panel is rebuilt here or it vanishes on every repaint.
    if (hazeTransportController) hazeTransportController.render(body);
    return;
  }
  if (activeLens === 'arrival') { renderWaterScenario(); return; }
  if (INSIGHT_LENSES.includes(activeLens)) {
    if (!insightData) {
      const wanted = activeLens;
      body.textContent = lensText('Loading the derived view…', 'Memuat tampilan turunan…');
      loadInsight().then(loaded => {
        if (activeLens === wanted && loaded) renderLensEvidence();
        else if (activeLens === wanted) body.textContent = lensText('This derived view is unavailable. See Data & sources.', 'Tampilan turunan ini tidak tersedia. Lihat Data & sumber.');
      });
      return;
    }
    if (activeLens === 'exposure') renderExposurePanel(insightData);
    else if (activeLens === 'green') {
      // The derived borough table and the map layers answer different questions:
      // hectares per borough from published polygons, and what the satellite
      // actually sees. Both belong on this lens, table first.
      renderGreenPanel(insightData);
      if (greenSpaceController) greenSpaceController.render(body);
    }
    else if (activeLens === 'coverage') { renderCoveragePanel(insightData); if (synopticController) synopticController.render(document.getElementById('atlas-lens-body')); }
    else renderConfidencePanel(insightData, buildingShare);
    return;
  }
  if (activeLens === 'rain') {
    // What the lens actually shows, as buttons rather than a hidden dropdown:
    // radar measured by an instrument that sees precipitation, Himawari
    // cloud-top temperature, and IMERG's satellite rainfall estimate. Three
    // different things, each with its own date, so each is named here.
    const stack = document.createElement('div'); stack.className = 'synoptic-toggles';
    const pick = (product, en, id) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = lensText(en[0], en[1]); b.dataset.rainProduct = id;
      b.setAttribute('aria-pressed', String(document.getElementById('atlas-environment-layer')?.value === product));
      b.addEventListener('click', () => {
        const selector = document.getElementById('atlas-environment-layer');
        if (!selector) return;
        selector.value = product;
        selector.dispatchEvent(new Event('change', { bubbles: true }));
        renderLensEvidence();
      });
      stack.append(b);
    };
    pick('radar', ['Radar', 'Radar'], 'radar');
    pick('himawari', ['Himawari IR', 'IR Himawari'], 'himawari');
    pick('satellite-rain', ['IMERG satellite rain', 'Hujan satelit IMERG'], 'satellite-rain');
    const city = document.createElement('button'); city.type = 'button'; city.textContent = lensText('City view', 'Tampilan kota');
    city.addEventListener('click', () => mapInstance?.flyTo({ center: [106.83, -6.20], zoom: 10.6, pitch: currentView === '2d' ? 0 : 45, bearing: 0 }));
    stack.append(city);
    body.append(stack);
    // Repaint-safe: this branch runs after body.replaceChildren(), so the
    // synoptic panel is re-rendered here or it disappears on every repaint.
    if (synopticController) synopticController.render(body);
    else body.append(document.createTextNode(lensText('Loading the pressure model…', 'Memuat model tekanan…')));
    for (const p of rainfallData?.points || []) {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = (uiLanguage() === 'id' ? p.name_id : p.name) + ' · ' + (Number.isFinite(p.next24hMm) ? fmtNum(p.next24hMm, 1) + ' mm / 24 h' : lensText('Unavailable', 'Tidak tersedia'));
      button.addEventListener('click', () => {
        mapInstance?.flyTo({ center: [p.lng, p.lat], zoom: 12.5, pitch: currentView === '2d' ? 0 : 55 });
        const detail = document.createElement('p');
        detail.textContent = formatLocal(p.forecastFromUtc) + ' → ' + formatLocal(p.forecastToUtc) + ' · Open-Meteo · ' + lensText('model forecast', 'prakiraan model');
        body.querySelectorAll('.lens-hourly').forEach(el => el.remove()); detail.className = 'lens-hourly'; body.append(detail);
        const hours = document.createElement('div'); hours.className = 'lens-hourly lens-hours';
        for (const hour of p.forecast || []) { const cell = document.createElement('span'); cell.textContent = new Date(hour.validAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit' }) + 'h · ' + fmtNum(hour.precipitationMm, 1) + ' mm'; hours.append(cell); }
        body.append(hours);
      });
      body.append(button);
    }
    if (!rainfallData?.points?.length) body.append(document.createTextNode(lensText('Rainfall unavailable. No zero rainfall is assumed.', 'Data hujan tidak tersedia. Tidak diasumsikan hujan nol.')));
  } else {
    const product = selectedEnvironmentProduct();
    body.textContent = activeLens === 'city' ? lensText('Building heights mix tagged measurements and derived estimates. Unknown heights stay flat. Explore Data & sources below.', 'Tinggi bangunan memadukan pengukuran bertag dan perkiraan turunan. Tinggi yang tidak diketahui tetap datar. Lihat Data & sumber di bawah.') : (product?.source || 'NASA GIBS') + ' · ' + lensText('See the observation time and legend in the map evidence panel.', 'Lihat waktu pengamatan dan legenda di panel bukti peta.');
  }
}
const ALL_LENSES = ['city','waterways','traffic','arrival','exposure','confidence','green','coverage','rain','radar','cloud','water','recurring','air','haze','night'];
async function selectCityLens(lens) {
  if (!ALL_LENSES.includes(lens)) return;
  stopWaterPlayback();
  observationController?.clear();
  airTimelineController?.clear();
  windFieldController?.clear();
  hazeTransportController?.clear();
  synopticController?.clear();
  greenSpaceController?.clear();
  flowCanvas?.setField(null);
  ['water-scenario-labels', 'water-scenario-route', 'water-scenario-front', 'water-scenario-stations'].forEach(dropInsightLayer);
  document.getElementById('water-scenario-location')?.remove();
  document.getElementById('monitoring-location')?.remove();
  document.body.dataset.lens = lens;
  activeLens = lens; const request = ++lensRequest;
  const shareUrl = new URL(window.location.href); shareUrl.searchParams.set('lens', lens);
  history.replaceState(null, '', shareUrl.toString());
  document.querySelectorAll('[data-lens]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lens === lens)));
  const selector = document.getElementById('atlas-environment-layer');
  // Rain is rain radar first: it is the only product here measured by an
  // instrument that sees precipitation directly. Himawari infrared and IMERG
  // remain one button away in the lens panel.
  selector.value = {radar:'radar',cloud:'himawari',water:'surface-water',recurring:'surface-water',air:'aerosol',haze:'true-colour',night:'night-lights',rain:'radar',coverage:'radar'}[lens] || 'none';
  selector.dispatchEvent(new Event('change', {bubbles:true}));
  removeInsightLayersWhenLeaving(lens);
  renderLensEvidence();
  await styleReady;
  if (request !== lensRequest || !mapInstance) return;
  // A synoptic system is hundreds of kilometres across, so the rain lens has
  // to be allowed out to regional scale or the isobars have nothing to show.
  mapInstance.setMinZoom?.(lens === 'haze' ? 4 : lens === 'rain' ? 5 : lens === 'night' ? 7 : 9);
  setLayerVisible('fire-hotspots', lens === 'haze');
  setLayerVisible('rain-model-samples', lens === 'rain');
  if (lens === 'rain') {
    await refreshRainfall(false);
    if (request !== lensRequest) return;
    // renderLensEvidence() already ran above, before the forecast points had
    // arrived, so the lens showed no points at all. Repaint now that they are
    // in, and the synoptic slot is rebuilt inside the same pass.
    renderLensEvidence();
    try { const controller = await loadSynoptic(); if (request !== lensRequest) return; controller.show(document.getElementById('atlas-lens-body')); }
    catch { if (request === lensRequest) { /* the synoptic panel reports its own failure; the point list below still renders */ } }
    if (request !== lensRequest) return;
    setLayerVisible('rain-model-samples', true);
    // The synoptic panel carries the grid spacing, the low's pressure and its
    // tendency — the numbers that make the isobars readable. Folded shut behind
    // "Explore evidence" the map shows lines nobody can interpret, so it opens
    // on desktop. On a phone it stays folded so the map keeps the screen.
    openLensEvidenceOnDesktop();
    // ~7.2 is about 900 km across: wide enough to hold a low-pressure system,
    // and the same frame the synoptic grid was requested over.
    mapInstance.flyTo({center:[106.8,-6.0], zoom:7.2, pitch:currentView === '2d' ? 0 : 30, bearing:0});
  } else if (['waterways','traffic'].includes(lens)) {
    // The water product is a number, and the number is in the panel: the mapped
    // feature count and its legend, the gauge inventory, the polder budget. The
    // map alone cannot say any of it, so folded shut behind "Explore evidence"
    // the lens showed hydrography and nothing else — including on the deep link
    // the water-recovery receipt publishes. Open it on desktop, the way rain,
    // haze, air and flood monitoring already do, and open it NOW rather than
    // after the fetch: the panel opens and fills in front of the reader.
    // On a phone it stays folded so the map keeps the screen.
    openLensEvidenceOnDesktop();
    try { const controller=await loadObservationController(); if(request!==lensRequest)return; await controller.show(lens,document.getElementById('atlas-lens-body')); }
    catch { if(request===lensRequest)document.getElementById('atlas-lens-body').textContent=lensText('Mapped evidence is unavailable.','Bukti terpetakan tidak tersedia.'); }
    if(request!==lensRequest)return;
  } else if (lens === 'arrival') {
    await showWaterScenario(request);
    if (request !== lensRequest) return;
    openLensEvidenceOnDesktop();
  } else if (lens === 'haze') {
    await refreshFires(false);
    loadIspuReference();
    if (request !== lensRequest) return;
    // Where the wind would carry it. Reachable from the haze lens and from the
    // Controls menu, because the question is asked from the power panel too.
    try { const controller = await loadHazeTransport(); if (request !== lensRequest) return; controller.show(document.getElementById('atlas-lens-body')); }
    catch { if (request === lensRequest) { /* the transport panel reports its own failure; the fire evidence below still renders */ } }
    if (request !== lensRequest) return;
    openLensEvidenceOnDesktop();
    mapInstance.flyTo({center:[106.83,-3.5],zoom:5,pitch:0,bearing:0});
  } else if (lens === 'air') {
    try { const controller = await loadWindField(); if (request !== lensRequest) return; controller.show(document.getElementById('atlas-lens-body')); }
    catch { if (request === lensRequest) document.getElementById('atlas-lens-body').textContent = lensText('The wind model is unavailable.', 'Model angin tidak tersedia.'); }
    // The wind panel carries the cell count and the wind-not-pollution rule, so it
    // must be visible, not folded shut behind "Explore evidence". On a phone it stays
    // folded so the map keeps the screen; the lens description carries the rule there.
    if (request === lensRequest) openLensEvidenceOnDesktop();
    // A 10 km AOD retrieval is one value per square; at full strength a single high
    // pixel reads as a solid block and competes with the wind. Soften, never hide.
    { const o = document.getElementById('atlas-environment-opacity'); if (o && Number(o.value) > 45) { o.value = '45'; o.dispatchEvent(new Event('input')); } }
    if (request !== lensRequest) return;
    try { const controller = await loadAirTimeline(); if (request !== lensRequest) return; controller.show(document.getElementById('atlas-lens-body')); }
    catch { if (request === lensRequest) document.getElementById('atlas-lens-body').textContent = lensText('The model timeline is unavailable.', 'Linimasa model tidak tersedia.'); }
    mapInstance.flyTo({center:[106.83,-6.20], zoom:9.3, pitch:currentView === '2d' ? 0 : 35, bearing:0});
  } else if (lens === 'confidence') {
    buildingPaintMode = 'confidence';
    applyMapTheme();
    buildingShare = buildingConfidenceShare();
    // The building layer is an extrusion, so this lens is only legible in 3D.
    if (currentView === '2d') setMapView('3d');
    openLensEvidenceOnDesktop();
    mapInstance.flyTo({center:[106.83,-6.20], zoom:13.2, pitch:currentView === '2d' ? 0 : 60, bearing:0});
  } else if (lens === 'exposure') {
    await renderExposureLens(request);
    if (request !== lensRequest) return;
    openLensEvidenceOnDesktop();
    mapInstance.flyTo({center:[106.83,-6.20], zoom:9.8, pitch:0, bearing:0});
  } else if (lens === 'green') {
    // The published polygons stay as the atlas's own insight-green layer, with
    // its click handling; this module chooses which satellite view sits above it.
    await loadGreenGeometry(request);
    if (request !== lensRequest) return;
    try { const controller = await loadGreenSpace(); if (request !== lensRequest) return; controller.show(document.getElementById('atlas-lens-body')); }
    catch { if (request === lensRequest) document.getElementById('atlas-lens-body').textContent = lensText('The green-space evidence is unavailable.', 'Bukti ruang hijau tidak tersedia.'); }
    if (request !== lensRequest) return;
    openLensEvidenceOnDesktop();
    // Close enough that the published polygons are more than a pixel wide: the
    // median site is about four metres across, so at a city-wide zoom this
    // layer is empty by construction and looks broken rather than absent.
    mapInstance.flyTo({center:[106.83,-6.20], zoom:13.2, pitch:currentView === '2d' ? 0 : 40, bearing:0});
  } else if (lens === 'coverage') {
    await loadStationGeometry(request);
    if (request !== lensRequest) return;
    // The forecast row and the pressure field are the "what else sees this"
    // half of this lens. Both are cached fetches shared with the rain lens.
    await refreshRainfall(false);
    if (request !== lensRequest) return;
    try { const controller = await loadSynoptic(); if (request !== lensRequest) return; controller.show(document.getElementById('atlas-lens-body')); }
    catch { /* the panel reports its own failure; the inventory below still renders */ }
    if (request !== lensRequest) return;
    openLensEvidenceOnDesktop();
    mapInstance.flyTo({center:[106.83,-6.20], zoom:9.6, pitch:0, bearing:0});
  } else if (lens === 'night') {
    mapInstance.flyTo({center:[106.83,-6.20], zoom:9, pitch:0, bearing:0});
  } else if (['radar','cloud','water','recurring'].includes(lens)) {
    mapInstance.flyTo({center:[106.83,-6.20], zoom:9.3, pitch:currentView === '2d' ? 0 : 35, bearing:0});
  } else flyToArea('sudirman-thamrin', {updateHash:false});
  renderLensEvidence();
}
document.querySelectorAll('[data-lens]').forEach(button => button.addEventListener('click', () => selectCityLens(button.dataset.lens)));
window.addEventListener('atlas:language', () => {renderLensEvidence(); if(['waterways','traffic'].includes(activeLens))observationController?.rerender(document.getElementById('atlas-lens-body')); if(activeLens==='air')airTimelineController?.render(document.getElementById('atlas-lens-body'));});
window.addEventListener('atlas:theme', () => { if (activeLens === 'coverage') renderLensEvidence(); });
// The confidence lens reports what is on screen, so the count follows the camera.
mapInstance?.on('moveend', () => {
  if (activeLens !== 'confidence') return;
  const share = buildingConfidenceShare();
  if (!share) return;
  buildingShare = share;
  renderLensEvidence();
});
if (new URLSearchParams(window.location.search).get('showcase') === '1') {
  document.body.classList.add('atlas-showcase');
  document.getElementById('atlas-watch-shell').open = false;
  document.querySelector('.atlas-menu-body')?.append(document.getElementById('atlas-watch'));
}
styleReady.then(() => { setLayerVisible('rain-model-samples', false); if (document.querySelector('.atlas-lenses')) {
  renderLensEvidence();
  const lens = new URLSearchParams(window.location.search).get('lens');
  if (lens) selectCityLens(lens);
} });

// The public provider can remain reachable from a user's network when edge IPs
// are unavailable. Apply the same UTC/unit/completeness gates to this fallback.
// Lightweight preparedness scenario. Timing never transfers gauge heights:
// each gauge has a separate datum, and the route has no hydraulic geometry.
let waterScenario = null, waterScenarioLoad = null, waterPlayback = null;
const waterState = { hours: 0, factor: 1, station: 0, levelCm: 100, riseCmH: 10 };
let waterRouteAssets = null, waterRouteLoad = null;
function loadWaterRoute() {
  if (!waterRouteLoad) waterRouteLoad = Promise.all([
    fetch(insightAsset('ciliwung-route'), { headers: { accept: 'application/json' } }).then(readStatic),
    fetch(insightAsset('ciliwung-manifest', 'json'), { headers: { accept: 'application/json' } }).then(readStatic)
  ]).then(([route, manifest]) => {
    if (!route || !manifest || !Array.isArray(route.features) || !Array.isArray(manifest.segments)) { waterRouteLoad = null; return null; }
    waterRouteAssets = { route, manifest };
    return waterRouteAssets;
  }).catch(() => { waterRouteLoad = null; return null; });
  return waterRouteLoad;
}
// Segment polylines in scenario order; null where no geometry was admitted.
function waterRoutePolylines() {
  if (!waterRouteAssets || waterScenario?.stations?.length !== waterRouteAssets.manifest.segments.length + 1) return null;
  return waterRouteAssets.manifest.segments.map((seg, i) => {
    if (!seg.admitted) return null;
    const want = waterScenario.stations[i].name + '→' + waterScenario.stations[i + 1].name;
    const f = waterRouteAssets.route.features.find(f => f.properties?.segment === want);
    return f?.geometry?.type === 'LineString' && f.geometry.coordinates.length >= 2 ? f.geometry.coordinates : null;
  });
}
const waterPolylineCumulative = new WeakMap();
function pointAlongPolyline(coords, t) {
  let cum = waterPolylineCumulative.get(coords);
  if (!cum) {
    cum = [0];
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
      const dx = (coords[i][0] - coords[i - 1][0]) * 111320 * Math.cos(coords[i][1] * Math.PI / 180);
      const dy = (coords[i][1] - coords[i - 1][1]) * 110540;
      total += Math.hypot(dx, dy); cum.push(total);
    }
    waterPolylineCumulative.set(coords, cum);
  }
  const target = Math.max(0, Math.min(1, t)) * cum[cum.length - 1];
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= target) lo = mid; else hi = mid; }
  const span = cum[hi] - cum[lo] || 1;
  const f = (target - cum[lo]) / span;
  return [coords[lo][0] + (coords[hi][0] - coords[lo][0]) * f, coords[lo][1] + (coords[hi][1] - coords[lo][1]) * f];
}
function stopWaterPlayback() { if (waterPlayback !== null) clearInterval(waterPlayback); waterPlayback = null; const play=document.getElementById('water-play');if(play){play.textContent=lensText('Play scenario · 1 h/s','Putar skenario · 1 jam/detik');play.setAttribute('aria-pressed','false');} }
function waterPosition(hours, factor, data, polylines) {
  const durations = data.baselineHours.map(h => h * factor);
  const elapsed = Math.max(0, Math.min(hours, durations[0] + durations[1]));
  const segment = elapsed <= durations[0] ? 0 : 1;
  const progress = Math.min(1, (elapsed - (segment ? durations[0] : 0)) / durations[segment]);
  const poly = Array.isArray(polylines) ? polylines[segment] : null;
  const coordinates = poly ? pointAlongPolyline(poly, progress)
    : data.stations[segment].coordinates.map((n, i) => n + (data.stations[segment + 1].coordinates[i] - n) * progress);
  return { coordinates, segment, progress, elapsed, total: durations[0] + durations[1] };
}
function waterGaugeLevel(hours, initial, rise) { return initial + Math.max(0, hours) * rise; }
// A lens whose product lives in the evidence panel opens it on desktop; folded
// shut behind "Explore evidence" the map shows a layer nobody can read. On a
// phone it stays folded so the map keeps the screen.
function openLensEvidenceOnDesktop() {
  if (window.matchMedia('(max-width: 700px)').matches) return;
  const ev = document.getElementById('atlas-lens-evidence'); if (ev) ev.open = true;
}
async function showWaterScenario(request) {
  if (!waterScenarioLoad) waterScenarioLoad = fetch('/data/jakarta-v1/water-scenario.json?v=' + encodeURIComponent(ATLAS_BUILD_TAG))
    .then(readStatic).then(d => { waterScenario = d; if (!d) waterScenarioLoad = null; return d; })
    .catch(() => { waterScenarioLoad = null; return null; });
  const [data] = await Promise.all([waterScenarioLoad, loadWaterRoute()]);
  if (request !== lensRequest || !data || !mapInstance) { if(request === lensRequest) renderWaterScenario(); return; }
  const polylines = waterRoutePolylines();
  const routeFeatures = data.stations.slice(0, -1).map((s, i) => ({
    type: 'Feature',
    properties: { segment: s.name + '→' + data.stations[i + 1].name, mapped: Boolean(polylines?.[i]) },
    geometry: { type: 'LineString', coordinates: polylines?.[i] || [s.coordinates, data.stations[i + 1].coordinates] }
  }));
  const route = {type:'FeatureCollection',features:routeFeatures};
  mapInstance.addSource('water-scenario-route', {type:'geojson',data:route});
  mapInstance.addLayer({id:'water-scenario-route',type:'line',source:'water-scenario-route',paint:{'line-color':mapTheme().water,'line-width':3,'line-dasharray':[2,2]}});
  mapInstance.addSource('water-scenario-stations', {type:'geojson',data:{type:'FeatureCollection',features:data.stations.map(s=>({type:'Feature',properties:{name:s.name},geometry:{type:'Point',coordinates:s.coordinates}}))}});
  mapInstance.addLayer({id:'water-scenario-stations',type:'circle',source:'water-scenario-stations',paint:{'circle-color':mapTheme().accent,'circle-radius':6,'circle-stroke-width':2,'circle-stroke-color':mapTheme().water}});
  mapInstance.addLayer({id:'water-scenario-labels',type:'symbol',source:'water-scenario-stations',layout:{'text-field':['get','name'],'text-font':['Open Sans Regular'],'text-size':12,'text-offset':[0,1.5],'text-anchor':'top','text-allow-overlap':true},paint:{'text-color':'#a32125','text-halo-color':'#fff6ef','text-halo-width':2}});
  mapInstance.addSource('water-scenario-front', {type:'geojson',data:{type:'FeatureCollection',features:[]}});
  mapInstance.addLayer({id:'water-scenario-front',type:'circle',source:'water-scenario-front',paint:{'circle-color':mapTheme().water,'circle-radius':10,'circle-stroke-width':3,'circle-stroke-color':mapTheme().accent}});
  mapInstance.fitBounds([[106.80,-6.65],[106.88,-6.18]],{padding:{top:45,right:60,bottom:140,left:60},pitch:0,bearing:0});
  const location = document.createElement('div'); location.id='water-scenario-location'; location.className='water-scenario-location';
  document.querySelector('.atlas-map-wrap').append(location);
  renderWaterScenario(); updateWaterScenario();
}
function updateWaterScenario() {
  if (!waterScenario || activeLens !== 'arrival') return;
  const p = waterPosition(waterState.hours, waterState.factor, waterScenario, waterRoutePolylines());
  mapInstance?.getSource('water-scenario-front')?.setData({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:p.coordinates}}]});
  const station = waterScenario.stations[waterState.station];
  const node = document.getElementById('water-scenario-location');
  if(node) node.textContent = station.name + ' · ' + station.coordinates[1].toFixed(6) + ', ' + station.coordinates[0].toFixed(6) + ' · WGS84';
  const output = document.getElementById('water-scenario-output');
  if(output) output.textContent = lensText('Scenario elapsed', 'Waktu skenario')+' '+fmtNum(waterState.hours,1)+' h · '+lensText('arrival at Manggarai', 'tiba di Manggarai')+' '+fmtNum(p.total,1)+' h · '+lensText('assumed local gauge level', 'tinggi pos asumsi')+' '+fmtNum(waterGaugeLevel(waterState.hours,waterState.levelCm,waterState.riseCmH),1)+' cm';
}
function renderWaterScenario() {
  const body = lensPanelBody();
  if(!waterScenario) { body.textContent = lensText('Scenario source unavailable or loading. No water level assumed.', 'Sumber skenario tidak tersedia atau sedang dimuat. Tidak diasumsikan tinggi air.'); return; }
  const polylines = waterRoutePolylines();
  const mapped = waterRouteAssets && polylines && polylines.filter(Boolean).length;
  const lengthNote = mapped
    ? lensText('Route follows published OpenStreetMap river geometry for the ' + mapped + ' verified ' + (mapped === 1 ? 'segment' : 'segments') + (polylines.some(p => !p) ? '; the unverified segment stays a straight schematic connection' : '') + '. The 3 h / 6 h timing is BPBD 2021 historical guidance, not a speed derived from the mapped length. No flood extent or street depth predicted.',
               'Rute mengikuti geometri sungai OpenStreetMap terpublikasi untuk ' + mapped + ' ' + (mapped === 1 ? 'segmen terverifikasi' : 'segmen terverifikasi') + (polylines.some(p => !p) ? '; segmen yang belum terverifikasi tetap berupa garis lurus skema' : '') + '. Waktu 3 jam / 6 jam adalah panduan historis BPBD 2021, bukan kecepatan yang dihitung dari panjang terpetakan. Tidak memprediksi luas banjir atau kedalaman jalan.')
    : lensText('PREPAREDNESS SCENARIO · BPBD 2021 approximate travel time: Katulampa → Depok 3 h; Depok → Manggarai 6 h. Straight dashed connections are schematic, not river geometry. No flood extent or street depth predicted.',
               'SKENARIO KESIAPSIAGAAN · Waktu tempuh perkiraan BPBD 2021: Katulampa → Depok 3 jam; Depok → Manggarai 6 jam. Garis lurus putus-putus adalah skema, bukan geometri sungai. Tidak memprediksi luas banjir atau kedalaman jalan.');
  body.append(lensNoteLine(lengthNote));
  function control(label, tag, id, value, attrs, change) {
    const wrapper=document.createElement('label'); wrapper.className='water-scenario-control';
    const caption=document.createElement('span'); caption.textContent=label;
    const input=document.createElement(tag); input.id=id;
    Object.entries(attrs||{}).forEach(([k,v])=>input.setAttribute(k,String(v)));
    input.value=String(value); input.addEventListener('input',()=>{change(input.value);updateWaterScenario();});
    wrapper.append(caption,input);body.append(wrapper);return input;
  }
  control(lensText('Travel-time factor (0.5–2× reference)', 'Faktor waktu tempuh (0,5–2× referensi)'), 'input','water-factor',waterState.factor,{type:'range',min:0.5,max:2,step:0.1},v=>waterState.factor=Number(v));
  control(lensText('Elapsed scenario time · h', 'Waktu skenario · jam'), 'input','water-hours',waterState.hours,{type:'range',min:0,max:18,step:0.1},v=>{stopWaterPlayback();waterState.hours=Number(v);});
  const select=control(lensText('Local gauge (separate datum)', 'Pos lokal (datum masing-masing)'), 'select','water-station',waterState.station,{},v=>{waterState.station=Number(v);renderWaterScenario();});
  waterScenario.stations.forEach((s,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=s.name;select.append(o);});select.value=String(waterState.station);
  control(lensText('Assumed starting level · cm', 'Tinggi awal asumsi · cm'), 'input','water-level',waterState.levelCm,{type:'number',min:-100,max:2000,step:10},v=>{const n=Number(v);if(Number.isFinite(n))waterState.levelCm=Math.max(-100,Math.min(2000,n));});
  control(lensText('Assumed local rise · cm/h', 'Kenaikan lokal asumsi · cm/jam'), 'input','water-rise',waterState.riseCmH,{type:'number',min:0,max:100,step:1},v=>{const n=Number(v);if(Number.isFinite(n))waterState.riseCmH=Math.max(0,Math.min(100,n));});
  const play=document.createElement('button');play.type='button';play.id='water-play';play.setAttribute('aria-pressed',String(waterPlayback!==null));play.textContent=waterPlayback!==null?lensText('Pause scenario', 'Jeda skenario'):lensText('Play scenario · 1 h/s', 'Putar skenario · 1 jam/detik');
  play.addEventListener('click',()=>{if(waterPlayback!==null)stopWaterPlayback();else{if(waterState.hours>=18)waterState.hours=0;waterPlayback=setInterval(()=>{if(document.hidden)return;waterState.hours=Math.min(18,waterState.hours+0.1);updateWaterScenario();const input=document.getElementById('water-hours');if(input)input.value=String(waterState.hours);if(waterState.hours>=18)stopWaterPlayback();},100);}play.textContent=waterPlayback!==null?lensText('Pause scenario','Jeda skenario'):lensText('Play scenario · 1 h/s','Putar skenario · 1 jam/detik');play.setAttribute('aria-pressed',String(waterPlayback!==null));});body.append(play);
  const output=document.createElement('p');output.id='water-scenario-output';output.className='lens-note';body.append(output);
  const station=waterScenario.stations[waterState.station];
  body.append(lensNoteLine(station.name+' · '+station.siaga.map(b=>'SIAGA '+b.level+' '+b.original).join(' · ')));
  body.append(lensNoteLine(lensText('Gauge rise is a user assumption, independent of the moving marker. Heights cannot be transferred between station datums. No measured water speed, discharge, terrain, tide or pump capacity is available to this scenario.', 'Kenaikan pos adalah asumsi pengguna, terpisah dari titik bergerak. Tinggi tidak dapat dipindahkan antar-datum pos. Skenario ini tidak memiliki kecepatan air terukur, debit, medan, pasut atau kapasitas pompa.')));
  const source=lensSource(lensText('Jakarta Satu station coordinates / thresholds · retrieved ', 'Koordinat / ambang pos Jakarta Satu · diambil ')+formatLocal(waterScenario.stationRetrievedAt)+(waterRouteAssets?lensText(' · OSM river geometry · ODbL, retrieved ',' · geometri sungai OSM · ODbL, diambil ')+formatLocal(waterRouteAssets.route.retrievedAt):''));
  const link=document.createElement('a');link.href=waterScenario.sourceUrl;link.target='_blank';link.rel='noopener';link.textContent=lensText('BPBD 2021 timing reference ↗ (PDF currently blocked)', 'Referensi waktu BPBD 2021 ↗ (PDF saat ini diblokir)');source.append(document.createElement('br'),link);body.append(source);updateWaterScenario();
}
window.addEventListener('atlas:theme',()=>{for(const id of ['water-scenario-route','water-scenario-front','water-scenario-stations'])if(mapInstance?.getLayer(id))mapInstance.setPaintProperty(id,id==='water-scenario-route'?'line-color':'circle-color',id==='water-scenario-stations'?mapTheme().accent:mapTheme().water);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopWaterPlayback();if(activeLens==='arrival')renderWaterScenario();}});

function showMonitoringLocation(feature) {
  const coords=feature?.geometry?.coordinates;
  if(feature?.geometry?.type!=='Point'||!Array.isArray(coords)||!coords.every(Number.isFinite))return;
  let node=document.getElementById('monitoring-location');
  if(!node){node=document.createElement('div');node.id='monitoring-location';node.className='water-scenario-location';document.querySelector('.atlas-map-wrap').append(node);}
  const p=feature.properties||{};
  node.textContent=(p.name||'—')+' · '+(p.kind||'')+' · '+coords[1].toFixed(6)+', '+coords[0].toFixed(6)+' · WGS84 · '+lensText('reference location','lokasi referensi');
}
mapInstance?.on('click','insight-stations',e=>{if(activeLens==='coverage'&&e.features?.[0])showMonitoringLocation(e.features[0]);});

// Place context loads reference geometry only when requested; existing lenses remain intact.
let placeContext, placeContextLoading;
async function openPlaceContext(point) {
  try {
    if (!placeContext) {
      placeContextLoading ||= import('/place-context.js?v=' + ATLAS_BUILD_TAG).then(async module => {
        await styleReady;
        return module.createPlaceContext(mapInstance, {language: uiLanguage, build: ATLAS_BUILD_TAG,
          accent: () => mapTheme().accent, ground: () => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), lens: selectCityLens, toast: showToast});
      }).catch(error => { placeContextLoading = null; throw error; });
      placeContext = await placeContextLoading;
    }
    placeContext.show(point);
  } catch (error) { showToast(lensText('Place references are unavailable. Try again.', 'Referensi lokasi tidak tersedia. Coba lagi.')); }
}
document.getElementById('place-open')?.addEventListener('click', () => {
  if (mapInstance) openPlaceContext(mapInstance.getCenter());
});

// Local reference search loads only when Quick jump is opened.
let cityToolsPromise = null;
document.querySelector('#atlas-areas details')?.addEventListener('toggle', event => {
  if (!event.currentTarget.open || !mapInstance || cityToolsPromise) return;
  cityToolsPromise = import('./city-tools.js?v=' + encodeURIComponent(ATLAS_BUILD_TAG)).then(module => module.createCityTools(mapInstance, {
    language: uiLanguage, build: ATLAS_BUILD_TAG, place: openPlaceContext,
    snapshot: () => ({ build: ATLAS_BUILD_TAG, lens: activeLens, product: selectedEnvironmentProduct(), areas: areasDoc, air: lastAirQuality, fires: firesData,
      selection: mapInstance.getStyle().sources['place-context']?.data || mapInstance.getStyle().sources['jkt-dashboard-selection']?.data || null })
  })).catch(() => {
    cityToolsPromise = null;
    showToast(lensText('Place search is unavailable. Open Quick jump to retry.', 'Pencarian tempat tidak tersedia. Buka Lompat cepat untuk mencoba lagi.'));
  });
});

async function fetchBrowserRainfall() {
  const points = [
    {id:'pusat',name:'Central Jakarta',name_id:'Jakarta Pusat',lat:-6.18,lng:106.83},
    {id:'utara',name:'North Jakarta',name_id:'Jakarta Utara',lat:-6.12,lng:106.88},
    {id:'barat',name:'West Jakarta',name_id:'Jakarta Barat',lat:-6.17,lng:106.75},
    {id:'selatan',name:'South Jakarta',name_id:'Jakarta Selatan',lat:-6.27,lng:106.81},
    {id:'timur',name:'East Jakarta',name_id:'Jakarta Timur',lat:-6.23,lng:106.90}
  ];
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude',points.map(p=>p.lat).join(','));
    url.searchParams.set('longitude',points.map(p=>p.lng).join(','));
    url.searchParams.set('current','precipitation');
    url.searchParams.set('hourly','precipitation,precipitation_probability');
    url.searchParams.set('forecast_days','3'); url.searchParams.set('timezone','UTC');
    const response = await fetch(url, {signal:AbortSignal.timeout(20000)});
    const rows = await readApi(response);
    if (!Array.isArray(rows) || rows.length !== points.length) return null;
    const stamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value) ? value+'Z' : null;
    const validNumber = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
    return {source:'Open-Meteo weather models',tier:'model-estimate-and-forecast',fetchedAt:new Date().toISOString(),points:points.map((point,i)=>{
      const row=rows[i],validAt=stamp(row?.current?.time),time=Date.parse(validAt);
      const available=row?.utc_offset_seconds===0 && row?.current_units?.precipitation==='mm' && row?.hourly_units?.precipitation==='mm' && Number.isFinite(time) && Date.now()-time>=0 && Date.now()-time<3*3600000 && Number.isFinite(row.latitude) && Number.isFinite(row.longitude) && Math.hypot((row.latitude-point.lat)*111,(row.longitude-point.lng)*110.4)<=20;
      const start=Math.ceil(time/3600000)*3600000;
      const forecast=available ? (row.hourly?.time||[]).flatMap((value,index)=>{
        const validAt=stamp(value),hour=Date.parse(validAt),precipitationMm=row.hourly?.precipitation?.[index];
        return hour>start && hour<=start+24*3600000 && validNumber(precipitationMm) ? [{validAt,precipitationMm,probabilityPct:row.hourly?.precipitation_probability?.[index]??null}] : [];
      }) : [];
      const complete=forecast.length===24 && forecast.every((hour,index)=>Date.parse(hour.validAt)===start+(index+1)*3600000);
      return {...point,available,validAt:available?validAt:null,intervalSeconds:row?.current?.interval??null,precipitationMm:available&&validNumber(row.current.precipitation)?row.current.precipitation:null,forecast,next24hMm:complete?forecast.reduce((sum,hour)=>sum+hour.precipitationMm,0):null,forecastFromUtc:available?new Date(start).toISOString():null,forecastToUtc:available?new Date(start+24*3600000).toISOString():null};
    })};
  } catch (e) { if (e && e.refused) throw e; return null; }
}
