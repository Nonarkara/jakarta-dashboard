// Haze transport: where the wind would carry it.
//
// The question this answers is "is the wind taking the haze or our pollution
// somewhere else". The honest form of that answer is a TRAJECTORY: the path a
// parcel of air would follow if it kept meeting the wind the model publishes.
//
// What this is NOT, and the panel says so on the map:
//
//   - Not a plume. Nothing here is a concentration, an optical depth, a mass or
//     a width. A line is a path, not a quantity, and it is never coloured by
//     how much is assumed to be in it.
//   - Not a dispersion forecast. Real HYSPLIT runs depend on boundary-layer
//     depth, stability, mixing and deposition. This has one input: the mean
//     wind at one level. It is the straight-line answer, not the turbulent one.
//   - Not a source of truth on emission. Seeds are places the satellite or the
//     map already says something is there — never invented plumes.
//
// Every position on a path comes from stepping that real wind field one hour at
// a time. The moment a step has no wind to step with, the path stops and says
// so, rather than coasting on an extrapolated vector.

const KM_PER_DEG_LAT = 110.57;
const SECONDS_PER_HOUR = 3600;

// A point further than this from every real cell has no measured wind to step
// with. The synoptic field is ~174 km between cells; 1.6x that is a generous
// envelope, past which "no data" is the answer and the path stops.
const MAX_CELL_REACH_KM = 280;

// The box the provider actually answered. Inside it we are interpolating
// between cells; outside it we would be extrapolating the westernmost cell's
// wind across open ocean forever, which is how a 24 h path reached 697 km out
// while the data stopped at 103°E. A trajectory stops at the edge and says so.
function fieldBounds(cells) {
  if (!Array.isArray(cells) || !cells.length) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const c of cells) {
    if (!Number.isFinite(c?.lat) || !Number.isFinite(c?.lng)) continue;
    minLat = Math.min(minLat, c.lat); maxLat = Math.max(maxLat, c.lat);
    minLng = Math.min(minLng, c.lng); maxLng = Math.max(maxLng, c.lng);
  }
  return Number.isFinite(minLat) ? { minLat, maxLat, minLng, maxLng } : null;
}

export function insideField(bounds, lng, lat) {
  if (!bounds) return false;
  return lng >= bounds.minLng && lng <= bounds.maxLng && lat >= bounds.minLat && lat <= bounds.maxLat;
}

export function kmPerDegLng(lat) {
  return 111.32 * Math.cos((lat * Math.PI) / 180);
}

export function flowVector(windFromDeg, windMs) {
  if (!Number.isFinite(windFromDeg) || windFromDeg < 0 || windFromDeg > 360) return null;
  if (!Number.isFinite(windMs) || windMs < 0) return null;
  const toward = ((windFromDeg + 180) % 360 + 360) % 360;
  const rad = (toward * Math.PI) / 180;
  return { u: Math.sin(rad) * windMs, v: Math.cos(rad) * windMs, toward, speed: windMs, from: windFromDeg };
}

// Inverse-distance weighting over the cells that actually answered at this
// hour. Returns null rather than a guess, so a path never steps on an
// invented vector — the caller stops instead.
export function sampleWind(cells, lng, lat) {
  if (!Array.isArray(cells) || !cells.length) return null;
  let wsum = 0, u = 0, v = 0, used = 0, nearest = Infinity;
  for (const c of cells) {
    if (!Number.isFinite(c?.lng) || !Number.isFinite(c?.lat) || !Number.isFinite(c.u)) continue;
    const dx = (c.lng - lng) * kmPerDegLng(lat), dy = (c.lat - lat) * KM_PER_DEG_LAT;
    const km = Math.hypot(dx, dy);
    nearest = Math.min(nearest, km);
    if (km > MAX_CELL_REACH_KM) continue;
    const w = 1 / Math.max(km * km, 1);
    u += c.u * w; v += c.v * w; wsum += w; used++;
  }
  if (!wsum) return null;
  return { u: u / wsum, v: v / wsum, used, nearestKm: nearest };
}

// Forward-advect one origin through the real hourly wind field.
// Returns the path plus WHY it stopped, or null when it never moved.
export function trajectory(cellsByHour, startIndex, origin, steps) {
  if (!Array.isArray(cellsByHour) || startIndex < 0 || startIndex >= cellsByHour.length) return null;
  const path = [[origin.lng, origin.lat]];
  let stopped = null;
  // The box is taken from the hour being stepped into, so it always describes
  // the data that step is about to use.
  const bounds = fieldBounds(cellsByHour[startIndex]);
  for (let s = 1; s <= steps; s++) {
    const idx = startIndex + s;
    if (idx >= cellsByHour.length) { stopped = 'forecast-ends'; break; }
    const [lng, lat] = path[path.length - 1];
    // Euler step from hour idx-1 to idx uses the wind of the hour the parcel is IN.
    const w = sampleWind(cellsByHour[idx - 1], lng, lat);
    if (!w) { stopped = 'no-wind'; break; }
    const dLat = ((w.v / 1000) * SECONDS_PER_HOUR) / KM_PER_DEG_LAT;
    const dLng = ((w.u / 1000) * SECONDS_PER_HOUR) / kmPerDegLng(lat);
    const next = [lng + dLng, lat + dLat];
    // A parcel must not wander off the edge of the data and keep going.
    if (!Number.isFinite(next[0]) || !Number.isFinite(next[1]) || Math.abs(next[1]) > 90) { stopped = 'off-grid'; break; }
    if (!insideField(bounds, next[0], next[1])) { stopped = 'left-field'; break; }
    path.push(next);
  }
  return { path, stopped, hours: path.length - 1, origin };
}

// Jakarta's own air. The question says "our pollution", so the city itself is
// a seed: these are planning origins, not emission sources, and the panel says
// so. They are the city centre plus the four cardinal districts, so the spread
// of outcomes is visible instead of a single line that implies certainty.
const JAKARTA_ORIGINS = [
  { lat: -6.1754, lng: 106.8272, label: 'Jakarta centre' },
  { lat: -6.12, lng: 106.88, label: 'North Jakarta' },
  { lat: -6.17, lng: 106.75, label: 'West Jakarta' },
  { lat: -6.27, lng: 106.81, label: 'South Jakarta' },
  { lat: -6.23, lng: 106.90, label: 'East Jakarta' },
];

// Only as many paths as a person can read. Saying "12 of 2619" is honest;
// drawing 2619 lines is not.
const MAX_FIRE_PATHS = 12;

// Only fires inside the wind field can be advected; a detection in Borneo with
// no wind cell around it would draw a one-point "path". The strongest (FRP)
// go first, so the capped set is the fires most likely to matter.
export function fireOrigins(features, bounds = null) {
  const list = Array.isArray(features) ? features : [];
  const mapped = list
    .filter((f) => Number.isFinite(f?.geometry?.coordinates?.[1]) && Number.isFinite(f?.geometry?.coordinates?.[0]))
    .filter((f) => !bounds || insideField(bounds, f.geometry.coordinates[0], f.geometry.coordinates[1]))
    .map((f) => ({
      lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
      frp: Number.isFinite(f?.properties?.frp) ? f.properties.frp : null,
      observedAt: f?.properties?.observedAt || null,
      label: 'Thermal detection',
    }))
    .sort((a, b) => (b.frp ?? -1) - (a.frp ?? -1));
  return { paths: mapped.slice(0, MAX_FIRE_PATHS), total: mapped.length, outside: list.length - mapped.length, capped: mapped.length > MAX_FIRE_PATHS };
}

export function createHazeTransport(map, { text: t, active, buildTag, flow }) {
  let synoptic = null, fires = null, epoch = 0;
  let source = null, pathLayer = null, seedLayer = null, hourLayer = null, lastBody = null, fitted = false;
  const state = { origins: 'jakarta', hours: 24 };

  const HOURS_AVAILABLE = () => {
    if (!synoptic?.hours?.length || !synoptic.available) return 0;
    const now = Date.now();
    let best = 0, delta = Infinity;
    synoptic.hours.forEach((h, i) => { const d = Math.abs(Date.parse(h) - now); if (d < delta) { delta = d; best = i; } });
    return Math.max(0, synoptic.hours.length - best - 1); // steps, not hours: N hours give N-1 steps
  };
  const startIndex = () => {
    if (!synoptic?.hours?.length) return 0;
    const now = Date.now();
    let best = 0, delta = Infinity;
    synoptic.hours.forEach((h, i) => { const d = Math.abs(Date.parse(h) - now); if (d < delta) { delta = d; best = i; } });
    return best;
  };
  // The wind, hoisted for one hour, the same shape the synoptic module builds.
  const cellsAt = (index) => (synoptic?.cells || [])
    .map((c) => {
      const h = c.hours?.[index];
      if (!h) return null;
      const f = flowVector(h.wind850FromDeg, h.wind850Ms);
      return f ? { lat: c.lat, lng: c.lng, ...f } : null;
    })
    .filter(Boolean);

  // The module owns one container inside the shared lens body, so repainting
  // clears this and never the product buttons the haze lens puts beside it.
  function slot(body) {
    let host = body.querySelector(':scope > .transport-root');
    if (!host) {
      host = document.createElement('div');
      host.className = 'transport-root';
      body.append(host);
    }
    host.replaceChildren();
    return host;
  }

  function originsNow() {
    if (state.origins === 'fires') {
      const f = fireOrigins(fires?.features, synoptic?.available ? fieldBounds(cellsAt(startIndex())) : null);
      return { list: f.paths, note: f, kind: 'fires' };
    }
    return { list: JAKARTA_ORIGINS, note: { total: JAKARTA_ORIGINS.length, capped: false }, kind: 'jakarta' };
  }

  function build() {
    if (!synoptic?.available) return { lines: [], seeds: [], hours: [], paths: 0 };
    const { list, note, kind } = originsNow();
    if (!list.length) return { lines: [], seeds: [], hours: [], paths: 0, note, kind };
    const byHour = [];
    for (let i = 0; i < synoptic.hours.length; i++) byHour.push(cellsAt(i));
    // A run that never left its seed is not a path; it is counted, not drawn as a dot-line.
    const runs = list.map((o) => trajectory(byHour, startIndex(), o, state.hours)).filter((r) => r && r.path.length > 1);
    const lines = [];
    const seeds = runs.map((r) => ({ type: 'Feature', properties: { role: 'seed', kind }, geometry: { type: 'Point', coordinates: r.path[0] } }));
    const hours = [];
    for (const r of runs) {
      lines.push({
        type: 'Feature', properties: { role: 'path', kind, hours: r.hours, stopped: r.stopped || '' },
        geometry: { type: 'LineString', coordinates: r.path },
      });
      // Mark where the parcel is at +6 h. These are hours, not amounts.
      for (const h of [6, 12, 18, 24]) {
        if (h <= r.hours) hours.push({ type: 'Feature', properties: { role: 'hour', hour: h }, geometry: { type: 'Point', coordinates: r.path[h] } });
      }
    }
    return { lines, seeds, hours, paths: runs.length, note, kind, endedEarly: runs.filter((r) => r.stopped).length };
  }

  function hide() {
    for (const id of [pathLayer, seedLayer, hourLayer]) if (id && map.getLayer(id)) map.removeLayer(id);
    if (source && map.getSource(source)) map.removeSource(source);
    pathLayer = seedLayer = hourLayer = source = null;
    if (flow?.label === 'haze850') flow.setField(null);
  }

  function draw() {
    if (!map || active() !== 'haze' || !synoptic?.available) { hide(); return; }
    const b = build();
    // The air the paths ride on, moving: same 850 hPa cells, current hour.
    flow?.setField(cellsAt(startIndex()), { label: 'haze850', key: synoptic.checkedAt + ':' + startIndex() });
    const bundle = { type: 'FeatureCollection', features: [...b.lines, ...b.seeds, ...b.hours] };
    if (!bundle.features.length) { hide(); renderPanel(); return; }
    if (source && map.getSource(source)) map.getSource(source).setData(bundle);
    else { source = 'haze-transport-' + epoch; map.addSource(source, { type: 'geojson', data: bundle }); }
    const anchor = () => (map.getLayer('network-water-lines') ? 'network-water-lines' : undefined);
    if (!map.getLayer('haze-path')) {
      map.addLayer({ id: 'haze-path', type: 'line', source, filter: ['==', ['get', 'role'], 'path'], paint: { 'line-color': '#f0b429', 'line-width': 2.4, 'line-opacity': 0.9, 'line-dasharray': [2, 1.4] } }, anchor());
      map.addLayer({ id: 'haze-seed', type: 'circle', source, filter: ['==', ['get', 'role'], 'seed'], paint: { 'circle-radius': 5, 'circle-color': '#e4572e', 'circle-stroke-color': '#fff4e6', 'circle-stroke-width': 1.6 } }, anchor());
      map.addLayer({ id: 'haze-hour', type: 'symbol', source, filter: ['==', ['get', 'role'], 'hour'], layout: { 'text-field': ['concat', ['to-string', ['get', 'hour']], 'h'], 'text-size': 11, 'text-offset': [0, 1.1] }, paint: { 'text-color': '#ffd9c2', 'text-halo-color': '#1a1208', 'text-halo-width': 2 } }, anchor());
    }
    pathLayer = map.getLayer('haze-path') ? 'haze-path' : null;
    seedLayer = map.getLayer('haze-seed') ? 'haze-seed' : null;
    hourLayer = map.getLayer('haze-hour') ? 'haze-hour' : null;
    renderPanel();
  }

  // Fit the camera to the paths, once, so the answer is on screen instead of
  // off at the edge of a regional view.
  function fit() {
    if (fitted || !map) return;
    const b = build();
    const pts = b.lines.flatMap((l) => l.geometry.coordinates);
    if (pts.length < 2) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 70, duration: still ? 0 : 900, maxZoom: 8 });
    fitted = true;
  }

  function renderPanel() {
    if (active() !== 'haze' || !lastBody) return;
    const host = slot(lastBody);
    const el = (tag, content, cls) => { const n = document.createElement(tag); if (content !== undefined) n.textContent = content; if (cls) n.className = cls; return n; };
    const section = el('section', undefined, 'transport-panel');
    section.append(el('strong', t('Where the wind would carry it', 'Ke mana angin akan membawanya'), 'synoptic-title'));

    if (!synoptic) { host.append(section); section.append(el('p', t('Loading the wind model…', 'Memuat model angin…'), 'synoptic-note')); return; }
    if (!synoptic.available || !synoptic.cells?.length) {
      section.append(el('p', t('The wind model returned no usable field. No path is drawn and no transport is implied.', 'Model angin tidak mengembalikan medan yang dapat dipakai. Tidak ada jalur yang digambar dan tidak ada transportasi yang diasumsikan.'), 'synoptic-note'));
      host.append(section);
      return;
    }

    const b = build();
    const available = HOURS_AVAILABLE();
    const note = b.note || { total: 0, capped: false };

    const lead = el('p', undefined, 'synoptic-note');
    lead.textContent = t(
      'Each line is the path a parcel of air would follow if it kept meeting the wind the model publishes. It is a path, not a plume: no concentration, optical depth, width or source mass is drawn anywhere on it.',
      'Setiap garis adalah jalur yang akan diikuti oleh seumpan udara jika terus bertemu angin yang diterbitkan model. Itu jalur, bukan plume: tidak ada konsentrasi, optical depth, lebar, atau massa sumber yang digambar di sepanjangnya.');
    section.append(lead);

    const facts = el('dl', undefined, 'synoptic-facts');
    const fact = (k, v) => { facts.append(el('dt', k)); facts.append(el('dd', v)); };
    fact(t('Wind', 'Angin'), '850 hPa · ' + t('about 1.5 km up, not the ground', 'sekitar 1,5 km di atas permukaan'));
    fact(t('Cells', 'Sel'), synoptic.cellCount + ' ' + t('of', 'dari') + ' ' + synoptic.requestedPoints + ' · ' + synoptic.spacingKm + ' km ' + t('grid step', 'langkah kisi'));
    fact(t('Seeds', 'Titik asal'), state.origins === 'fires'
      ? note.total + ' ' + t('thermal detections inside the wind field', 'deteksi termal di dalam medan angin') + (note.outside ? ' (' + note.outside + ' ' + t('outside it, not advected', 'di luar, tidak dilacak') + ')' : '') + ' · ' + t('paths drawn', 'jalur digambar') + ' ' + b.paths + (note.capped ? ' ' + t('strongest by FRP', 'terkuat menurut FRP') : '')
      : b.paths + ' ' + t('Jakarta origins, planning points not emission sources', 'titik asal Jakarta, titik perencanaan bukan sumber emisi'));
    fact(t('Horizon', 'Horizon'), Math.min(state.hours, available) + ' h' + (b.endedEarly ? ' · ' + t('some paths stop sooner where the wind data ends', 'sebagian jalur berhenti lebih awal di tempat data angin berakhir') : ''));
    section.append(facts);

    const toggles = el('div', undefined, 'synoptic-toggles');
    // The label states the current selection and aria-pressed agrees with it,
    // so a sighted reader and a screen reader never disagree about the state.
    const toggle = (id, label, pressed, click) => {
      const btn = el('button', t(label[0], label[1])); btn.type = 'button';
      btn.dataset.transportToggle = id;
      btn.setAttribute('aria-pressed', String(pressed));
      btn.addEventListener('click', click);
      toggles.append(btn);
    };
    const switchTo = (next) => { state.origins = next; fitted = false; draw(); fit(); };
    toggle('origins',
      state.origins === 'jakarta' ? ['Seeds: Jakarta', 'Titik asal: Jakarta'] : ['Seeds: thermal detections', 'Titik asal: deteksi termal'],
      state.origins === 'jakarta',
      () => switchTo(state.origins === 'jakarta' ? 'fires' : 'jakarta'));
    for (const h of [6, 12, 24]) {
      toggle('h' + h, [h + ' h', h + ' j'], state.hours === h, () => { state.hours = h; fitted = false; draw(); fit(); });
    }
    section.append(toggles);

    if (state.origins === 'fires' && !note.total) {
      section.append(el('p', t('No admitted thermal detections in the window, so there is nothing real to carry. No path is invented.', 'Tidak ada deteksi termal lolos dalam rentang itu, jadi tidak ada yang nyata untuk dibawa. Tidak ada jalur yang dikarang.'), 'synoptic-note'));
    }

    section.append(el('p', t(
      'This is a trajectory from mean wind at one level, not a dispersion model. It ignores boundary-layer depth, mixing, stability and deposition, so it shows where air would go — not how much would arrive, or whether it would arrive at all.',
      'Ini adalah trajektori dari angin rata-rata pada satu level, bukan model dispersi. Mengabaikan kedalaman lapisan batas, pencampuran, kestabilan, dan pengendapan, sehingga menunjukkan ke mana udara akan pergi — bukan berapa yang akan tiba, atau apakah akan tiba.'),
      'synoptic-note'));
    host.append(section);
  }

  function show(body) {
    hide();
    const myEpoch = ++epoch;
    synoptic = null; fires = null; fitted = false;
    lastBody = body;
    renderPanel();
    const tag = buildTag ? '?v=' + encodeURIComponent(buildTag) : '';
    const get = (url) => fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20000) })
      .then((r) => (r.ok ? r.json() : { available: false })).catch(() => ({ available: false }));
    Promise.all([get('/api/atlas/synoptic' + tag), get('/api/atlas/fires' + tag)]).then(([s, f]) => {
      if (myEpoch !== epoch) return;
      synoptic = s; fires = f;
      draw(); fit(); renderPanel();
    });
  }

  function clear() {
    epoch++; synoptic = null; fires = null; fitted = false; lastBody = null;
    hide();
  }

  return { show, render: renderPanel, clear };
}