// Synoptic layer for the rain lens: the pressure pattern and mid-level flow
// around Java, at the scale those features actually live on.
//
// Three things are deliberately kept apart:
//
//   1. SURFACE PRESSURE. Real Open-Meteo mean-sea-level pressure at the cells
//      the provider actually returned. Isobars are a contour of that field:
//      an interpolation BETWEEN cells, which is why the panel states the
//      spacing. A contour line is not a measurement.
//
//   2. UPPER-AIR FLOW. 850 hPa wind, roughly 1.5 km up. It is drawn beside
//      Himawari infrared because cold cloud tops are what you actually read
//      for deep convection — but the arrows are model wind. GIBS publishes
//      Himawari as Air Mass, Band 13 infrared and Band 3 red visible only.
//      There is no Himawari wind product, and nothing here is derived from one.
//
//   3. RAIN ITSELF. Not this module. Rain comes from the radar, IMERG and the
//      forecast points already on the lens. A pressure line is not a forecast
//      of rain, and this layer never implies one.
//
// Every length is built in KILOMETRES and converted at the local latitude.
// Working in degrees is how a gentle wind became a 166 km line across a 50 km
// city.

const KM_PER_DEG_LAT = 110.57;

// Contour interval. Synoptic charts run 4 hPa; a 4 hPa step over this box
// gives only a handful of lines, so 2 hPa is used and the value is shown.
const ISOBAR_STEP_HPA = 2;

export function arrowHead(shaft) {
  const [[x0, y0], [x1, y1]] = shaft.geometry.coordinates;
  const lat = (y0 + y1) / 2, kx = 111.32 * Math.cos(lat * Math.PI / 180), ky = KM_PER_DEG_LAT;
  const ex = (x1 - x0) * kx, ny = (y1 - y0) * ky, len = Math.hypot(ex, ny) || 1;
  const head = Math.min(2.5, len * 0.35), ux = ex / len, uy = ny / len, s = Math.SQRT1_2;
  const barb = (sign) => {
    const bx = -(ux * s - sign * uy * s) * head, by = -(uy * s + sign * ux * s) * head;
    return [x1 + bx / kx, y1 + by / ky];
  };
  return { type: 'Feature', properties: { ...shaft.properties, head: true }, geometry: { type: 'LineString', coordinates: [barb(1), [x1, y1], barb(-1)] } };
}

export function flowVector(windFromDeg, windMs) {
  // A meteorological FROM bearing is 0..360. Out of range is a parsing fault:
  // letting -1 through yields a confident 179° vector, which is exactly the
  // invented number this layer must never produce.
  if (!Number.isFinite(windFromDeg) || windFromDeg < 0 || windFromDeg > 360) return null;
  if (!Number.isFinite(windMs) || windMs < 0) return null;
  const toward = ((windFromDeg + 180) % 360 + 360) % 360;
  const rad = toward * Math.PI / 180;
  return { u: Math.sin(rad) * windMs, v: Math.cos(rad) * windMs, toward, speed: windMs, from: windFromDeg };
}

// Rows and columns of the returned cells, sorted. The grid is whatever the
// provider answered; these helpers only organise it, they never add a node.
export function gridOf(cells) {
  const rows = [];
  for (const c of cells || []) {
    if (!Number.isFinite(c?.lat) || !Number.isFinite(c?.lng) || !Number.isFinite(c.mslpHpa)) continue;
    let row = rows.find((r) => Math.abs(r.lat - c.lat) < 1e-3);
    if (!row) { row = { lat: c.lat, cells: [] }; rows.push(row); }
    if (!row.cells.some((x) => Math.abs(x.lng - c.lng) < 1e-3)) row.cells.push(c);
  }
  rows.forEach((r) => r.cells.sort((a, b) => a.lng - b.lng));
  return rows.sort((a, b) => b.lat - a.lat);
}

// Marching squares over the returned cells, one segment per crossing, at every
// level. A cell whose pressure is null is a hole: no segment is produced next
// to it, so a line is never drawn through unknown ground.
export function contour(rows, level) {
  const segments = [];
  for (let r = 0; r < rows.length - 1; r++) {
    const top = rows[r], bot = rows[r + 1];
    // A quad needs c AND c+1, so the column count is the span, not the length.
    // Looping to the length reads one cell past the row end and throws.
    const cols = Math.min(top.cells.length, bot.cells.length);
    // The rows must actually be stacked: same longitudes, same columns. If a
    // cell is missing from the middle of one row, the remaining columns SHIFT,
    // and marching squares would pair the wrong neighbours and bridge the gap
    // with an isobar drawn through a place nothing was measured.
    if (cols < 2) continue;
    let aligned = true;
    for (let c = 0; c < cols; c++) if (Math.abs(top.cells[c].lng - bot.cells[c].lng) > 1e-3) aligned = false;
    if (!aligned) continue;
    for (let c = 0; c + 1 < cols; c++) {
      const a = top.cells[c], b = top.cells[c + 1], d = bot.cells[c + 1], e = bot.cells[c];
      const quad = [a, b, d, e];
      if (quad.some((q) => !Number.isFinite(q.mslpHpa))) continue;
      const pts = [];
      const edges = [[a, b], [b, d], [d, e], [e, a]];
      for (const [p, q] of edges) {
        const pv = p.mslpHpa, qv = q.mslpHpa;
        if ((pv < level && qv >= level) || (pv >= level && qv < level)) {
          const t = (level - pv) / (qv - pv);
          pts.push([p.lng + (q.lng - p.lng) * t, p.lat + (q.lat - p.lat) * t]);
        }
      }
      if (pts.length === 2) segments.push([pts[0], pts[1]]);
    }
  }
  return segments;
}

// Join the loose per-cell segments end to end into real contour lines. Without
// this the map shows a field of disconnected 170 km chords, which reads as
// noise rather than as a pressure pattern.
export function stitch(segments, tol = 1e-6) {
  const open = segments.map((s) => ({ a: s[0], b: s[1], used: false }));
  const lines = [];
  const near = (p, q) => Math.abs(p[0] - q[0]) < tol && Math.abs(p[1] - q[1]) < tol;
  for (const seed of open) {
    if (seed.used) continue;
    seed.used = true;
    const line = [seed.a, seed.b];
    for (let end = 0; end < 2; end++) {
      let grew = true;
      while (grew) {
        grew = false;
        const tip = end === 0 ? line[0] : line[line.length - 1];
        for (const seg of open) {
          if (seg.used) continue;
          if (near(tip, seg.a)) { end === 0 ? line.unshift(seg.b) : line.push(seg.b); seg.used = true; grew = true; }
          else if (near(tip, seg.b)) { end === 0 ? line.unshift(seg.a) : line.push(seg.a); seg.used = true; grew = true; }
        }
      }
      // No reversal here: Array.prototype.reverse returns the SAME array, so
      // "reverse then clear then refill" refills from an already-empty source
      // and every stitched line comes back empty. Direction is irrelevant to
      // drawing a contour anyway.
    }
    if (line.length > 1) lines.push(line);
  }
  return lines;
}

// The lowest pressure the provider actually returned, with how it is changing.
// `tendencyHpa` is null unless BOTH hours exist — a pressure change computed
// from a missing hour is a guess, so it is not computed at all.
export function lowCentre(cells, index) {
  let best = null;
  for (const c of cells || []) {
    const h = c.hours?.[index];
    if (!h || !Number.isFinite(h.mslpHpa)) continue;
    if (!best || h.mslpHpa < best.mslpHpa) best = { lat: c.lat, lng: c.lng, mslpHpa: h.mslpHpa, validAt: h.validAt };
  }
  if (!best) return null;
  const priorIndex = index - 6;
  const prior = priorIndex >= 0 ? cells.find((c) => Math.abs(c.lat - best.lat) < 1e-3 && Math.abs(c.lng - best.lng) < 1e-3)?.hours?.[priorIndex] : null;
  const tendencyHpa = prior && Number.isFinite(prior.mslpHpa) ? Math.round((best.mslpHpa - prior.mslpHpa) * 10) / 10 : null;
  return { ...best, tendencyHpa, tendencyHours: prior ? 6 : null };
}

// Hoists ONE hour's values onto each cell. mslpHpa must be lifted here:
// gridOf() and contour() read it at the top level, and a cell that carries only
// its hours array filters itself out — which is how the isobar field silently
// comes back empty.
export function hoursOf(cells, index) {
  return (cells || []).map((c) => {
    const h = c?.hours?.[index];
    // Pressure and wind are independent measurements. A cell that returned
    // MSLP but no wind still knows its pressure, and must keep it: dropping
    // the whole cell would put a hole in the isobar field over ground the
    // model DID report. The vector is attached only when the wind is real.
    if (!h || !Number.isFinite(h.mslpHpa)) return null;
    const f = flowVector(h.wind850FromDeg, h.wind850Ms);
    return { ...c, ...h, ...(f || {}) };
  }).filter(Boolean);
}

export function createSynoptic(map, { text: t, active, buildTag }) {
  let data = null, epoch = 0;
  let source = null, isoLayer = null, windLayer = null, lowLayer = null;
  const state = { index: 0, isobars: true, wind850: true };

  const el = (tag, content, cls) => { const n = document.createElement(tag); if (content !== undefined) n.textContent = content; if (cls) n.className = cls; return n; };
  const number = (n, d = 1) => Number.isFinite(n) ? n.toLocaleString(t('en-GB', 'id-ID'), { maximumFractionDigits: d }) : '—';
  const clock = (v) => new Date(v).toLocaleString(t('en-GB', 'id-ID'), { timeZone: 'Asia/Jakarta' }) + ' WIB';
  // MapLibre throws if the before-id is not in the current style, and the 2D
  // view carries a different layer set. Only anchor to a layer we can see.
  const anchor = () => map.getLayer('network-water-lines') ? 'network-water-lines' : undefined;

  function nearestIndex() {
    if (!data?.hours?.length) return 0;
    const now = Date.now();
    let best = 0, delta = Infinity;
    data.hours.forEach((h, i) => { const d = Math.abs(Date.parse(h) - now); if (d < delta) { delta = d; best = i; } });
    return best;
  }

  function hide() {
    for (const id of [isoLayer, windLayer, lowLayer]) if (id && map.getLayer(id)) map.removeLayer(id);
    if (source && map.getSource(source)) map.removeSource(source);
    isoLayer = windLayer = lowLayer = source = null;
  }

  function draw() {
    if (!map || active() !== 'rain' || !data?.cells?.length) { hide(); return; }
    const index = Math.max(0, Math.min(state.index, (data.hours?.length || 1) - 1));
    state.index = index;
    const live = hoursOf(data.cells, index);
    const rows = gridOf(live);
    const pressures = rows.flatMap((r) => r.cells.map((c) => c.mslpHpa));

    // Levels span only the pressure the provider actually returned here, so an
    // isobar is never drawn at a level the field never reaches.
    const levels = [];
    if (pressures.length) {
      const lo = Math.ceil(Math.min(...pressures) / ISOBAR_STEP_HPA) * ISOBAR_STEP_HPA;
      const hi = Math.floor(Math.max(...pressures) / ISOBAR_STEP_HPA) * ISOBAR_STEP_HPA;
      for (let v = lo; v <= hi; v += ISOBAR_STEP_HPA) levels.push(v);
    }
    const isoFeatures = [];
    for (const level of levels) for (const line of stitch(contour(rows, level))) {
      isoFeatures.push({ type: 'Feature', properties: { hpa: level }, geometry: { type: 'LineString', coordinates: line } });
    }

    const windFeatures = [];
    if (state.wind850) for (const c of live) {
      if (!Number.isFinite(c.speed)) continue;
      // Length in kilometres. 850 hPa flow of 30 m/s is a strong jet: cap the
      // drawn length so the arrow stays inside the cell spacing it came from.
      const km = Math.max(18, Math.min(c.speed, 45) * 1.4);
      const rad = c.toward * Math.PI / 180;
      const dLat = (Math.cos(rad) * km / 2) / KM_PER_DEG_LAT;
      const dLng = (Math.sin(rad) * km / 2) / (111.32 * Math.cos(c.lat * Math.PI / 180));
      const shaft = {
        type: 'Feature', properties: { speed: c.speed, from: c.from, lengthKm: km },
        geometry: { type: 'LineString', coordinates: [[c.lng - dLng, c.lat - dLat], [c.lng + dLng, c.lat + dLat]] },
      };
      windFeatures.push(shaft, arrowHead(shaft));
    }

    const low = lowCentre(data.cells, index);
    const lowFeatures = low ? [{ type: 'Feature', properties: { hpa: low.mslpHpa }, geometry: { type: 'Point', coordinates: [low.lng, low.lat] } }] : [];

    const bundle = { type: 'FeatureCollection', features: [...isoFeatures, ...windFeatures, ...lowFeatures] };
    const key = 'synoptic-' + epoch;
    if (source && map.getSource(source)) map.getSource(source).setData(bundle);
    else { source = key; map.addSource(source, { type: 'geojson', data: bundle }); }

    const added = [];
    if (state.isobars && !map.getLayer('synoptic-isobars')) {
      map.addLayer({ id: 'synoptic-isobars', type: 'line', source, filter: ['all', ['!', ['has', 'head']], ['!', ['has', 'lengthKm']]], paint: { 'line-color': '#e8eef7', 'line-width': 1.4, 'line-opacity': 0.62 } }, anchor());
      added.push('synoptic-isobars');
    } else if (!state.isobars && map.getLayer('synoptic-isobars')) { map.removeLayer('synoptic-isobars'); isoLayer = null; }
    if (state.wind850 && !map.getLayer('synoptic-wind850')) {
      map.addLayer({ id: 'synoptic-wind850', type: 'line', source, filter: ['has', 'lengthKm'], paint: { 'line-color': '#f0b429', 'line-width': 2, 'line-opacity': 0.9 } }, anchor());
      added.push('synoptic-wind850');
    } else if (!state.wind850 && map.getLayer('synoptic-wind850')) { map.removeLayer('synoptic-wind850'); windLayer = null; }
    if (!map.getLayer('synoptic-low')) {
      map.addLayer({ id: 'synoptic-low', type: 'circle', source, filter: ['has', 'hpa'], paint: { 'circle-radius': 7, 'circle-color': '#e4572e', 'circle-stroke-color': '#fff4e6', 'circle-stroke-width': 2 } }, anchor());
      added.push('synoptic-low');
    }
    isoLayer = map.getLayer('synoptic-isobars') ? 'synoptic-isobars' : null;
    windLayer = map.getLayer('synoptic-wind850') ? 'synoptic-wind850' : null;
    lowLayer = map.getLayer('synoptic-low') ? 'synoptic-low' : null;
    if (added.length) added.forEach(() => {});
    if (low) {
      const pt = [low.lng, low.lat];
      if (!map.getLayer('synoptic-low-label')) {
        map.addLayer({ id: 'synoptic-low-label', type: 'symbol', source, filter: ['has', 'hpa'], layout: { 'text-field': ['concat', 'L ', ['to-string', ['get', 'hpa']]], 'text-size': 12, 'text-offset': [0, 1.6], 'text-anchor': 'top' }, paint: { 'text-color': '#ffd9c2', 'text-halo-color': '#1a1208', 'text-halo-width': 2 } }, anchor());
      }
    }
  }

  function render(body) {
    if (active() !== 'rain' || !body) return;
    // Every control redraws the map and then repaints the panel from the same
    // module, because renderLensEvidence() clears this body wholesale.
    const repaint = () => render(body.parentElement?.querySelector('#atlas-lens-body') || body);
    if (!data) { body.append(el('p', t('Loading the pressure model…', 'Memuat model tekanan…'), 'synoptic-note')); return; }
    if (!data.available) {
      body.append(el('p', t('The pressure model returned no usable field. No isobar is drawn and no low is implied.', 'Model tekanan tidak mengembalikan medan yang dapat dipakai. Tidak ada isobar yang digambar dan tidak ada rendah yang diasumsikan.'), 'synoptic-note'));
      return;
    }
    const hour = data.hours[state.index];
    const section = el('section', undefined, 'synoptic-panel');

    section.append(el('strong', t('Synoptic context · next 24 h', 'Konteks sinoptik · 24 jam ke depan'), 'synoptic-title'));

    const lead = el('p', undefined, 'synoptic-note');
    lead.textContent = t(
      'Surface pressure and 850 hPa wind on a box wide enough to hold a weather system. A low-pressure centre is hundreds of kilometres across, so it cannot be seen from a city view.',
      'Tekanan permukaan dan angin 850 hPa pada kotak yang cukup luas untuk memuat sistem cuaca. Pusat tekanan rendah beratus-ratus kilometer, sehingga tidak terlihat dari tampilan kota.');
    section.append(lead);

    const facts = el('dl', undefined, 'synoptic-facts');
    const fact = (k, v) => { facts.append(el('dt', k)); facts.append(el('dd', v)); };
    fact(t('Valid', 'Berlaku'), hour ? clock(hour) : '—');
    fact(t('Cells', 'Sel'), data.cellCount + ' ' + t('of', 'dari') + ' ' + data.requestedPoints + ' · ' + number(data.spacingKm, 0) + ' km ' + t('grid step', 'langkah kisi'));
    if (data.extentKm) fact(t('Box', 'Kotak'), number(data.extentKm.eastWest, 0) + ' × ' + number(data.extentKm.northSouth, 0) + ' km');
    const low = lowCentre(data.cells, state.index);
    fact(t('Lowest pressure', 'Tekanan terendah'), low
      ? number(low.mslpHpa, 0) + ' hPa ' + (Number.isFinite(low.tendencyHpa)
        ? '(' + (low.tendencyHpa <= 0 ? '▼ ' : '▲ ') + number(Math.abs(low.tendencyHpa), 1) + ' hPa / 6 h ' + t('— deepening', '— menguat') + ')'
        : t('tendency unknown', 'tendensi tidak diketahui'))
      : t('none in this box', 'tidak ada di kotak ini'));
    section.append(facts);

    // Hour scrubber. The lens is "next 24 h", so the field moves through time
    // and every drawn line is redrawn from that hour's own values.
    const scrub = el('div', undefined, 'synoptic-scrub');
    const back = el('button', '−6 h'); back.type = 'button';
    const fwd = el('button', '+6 h'); fwd.type = 'button';
    const label = el('span', undefined, 'synoptic-hour');
    const rel = hour ? Math.round((Date.parse(hour) - Date.now()) / 3600000) : null;
    label.textContent = Number.isFinite(rel)
      ? (rel === 0 ? t('now', 'sekarang') : (rel > 0 ? '+' + rel + ' h' : rel + ' h'))
      : '—';
    back.addEventListener('click', () => { state.index = Math.max(0, state.index - 6); draw(); repaint(); });
    fwd.addEventListener('click', () => { state.index = Math.min((data.hours?.length || 1) - 1, state.index + 6); draw(); repaint(); });
    scrub.append(back, label, fwd);
    section.append(scrub);

    const toggles = el('div', undefined, 'synoptic-toggles');
    // Both languages for BOTH states. lensText(en, id) returns undefined when
    const toggle = (id, off, on, click) => {
      const b = el('button', t(...(state[id] ? on : off))); b.type = 'button';
      b.dataset.synopticToggle = id;
      b.setAttribute('aria-pressed', String(state[id]));
      b.addEventListener('click', click);
      toggles.append(b);
      return b;
    };
    toggle('isobars', ['Isobars', 'Isobar'], ['Isobars on', 'Isobar nyala'], () => { state.isobars = !state.isobars; draw(); repaint(); });
    toggle('wind850', ['850 hPa wind', 'Angin 850 hPa'], ['850 hPa wind on', 'Angin 850 hPa nyala'], () => { state.wind850 = !state.wind850; draw(); repaint(); });
    section.append(toggles);

    section.append(el('p', t(
      'Isobars are interpolated between the model\'s own cells, not measured along the line. 850 hPa is about 1.5 km up and this is model wind — Himawari supplies cloud imagery, not wind, and none of this is a rain forecast.',
      'Isobar diinterpolasi antar sel model, bukan diukur pada garisnya. 850 hPa sekitar 1,5 km di atas permukaan dan ini angin model — Himawari menyediakan citra awan, bukan angin, dan tidak ada di sini yang merupakan prakiraan hujan.'),
      'synoptic-note'));
    body.append(section);
  }

  function show(body) {
    hide();
    const myEpoch = ++epoch;
    data = null; state.index = 0; state.isobars = true; state.wind850 = true;
    render(body);
    fetch('/api/atlas/synoptic' + (buildTag ? '?v=' + encodeURIComponent(buildTag) : ''), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20000) })
      .then((r) => (r.ok ? r.json() : { available: false }))
      .catch(() => ({ available: false }))
      .then((d) => {
        if (myEpoch !== epoch) return;
        data = d;
        state.index = nearestIndex();
        draw();
        render(body);
      });
  }

  function clear() { epoch++; data = null; state.index = 0; hide(); }

  // render is exported separately from show so the lens evidence panel can
  // repaint after body.replaceChildren() without refetching the model.
  return { show, render, clear, scrubTo: (i) => { state.index = i; draw(); } };
}