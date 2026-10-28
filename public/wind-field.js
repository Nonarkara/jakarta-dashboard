// Animated wind layer for the air lens.
//
// Two separate things, deliberately kept apart:
//
//   1. The wind FIELD. Real Open-Meteo 10 m values at the model cells the
//      provider actually returned. Particles are advected through an inverse-
//      distance interpolation between those cells. That interpolation is the
//      only synthetic step and it is stated on the panel.
//
//   2. The air TIMELINE. One CAMS cell for all of Jakarta, so it moves through
//      TIME and never across space. Painting a spatial PM2.5 gradient from a
//      single ~45 km model value would invent variation the model does not have.
//
// Nothing here derives a concentration, plume width, source or exposure. Wind
// direction is meteorological FROM; motion uses FROM + 180.

const TAU = Math.PI * 2;

// Arrowhead at the TOWARD end: the data stays FROM-bearing (meteorological
// convention); only the drawing points where the air is going.
import { admitModel, currentHourIndex, admissionMessage, scrubGapMessage } from './temporal-admission.js';
import { readJson, isRefusalError, refusalMessage } from './refusal.js';

export function arrowHead(shaft) {
  const [[x0, y0], [x1, y1]] = shaft.geometry.coordinates;
  const lat = (y0 + y1) / 2, kx = 111.32 * Math.cos(lat * Math.PI / 180), ky = 110.57;
  const ex = (x1 - x0) * kx, ny = (y1 - y0) * ky, len = Math.hypot(ex, ny) || 1;
  const head = Math.min(2.5, len * 0.35), ux = ex / len, uy = ny / len, s = Math.SQRT1_2;
  const barb = (sign) => {
    const bx = -(ux * s - sign * uy * s) * head, by = -(uy * s + sign * ux * s) * head;
    return [x1 + bx / kx, y1 + by / ky];
  };
  return { type: 'Feature', properties: { ...shaft.properties, head: true }, geometry: { type: 'LineString', coordinates: [barb(1), [x1, y1], barb(-1)] } };
}



// One plain sentence for the whole city: the vector mean of the real cells.
// Vector, not bearing, mean: averaging 350° and 10° by number gives 180°, the
// exact opposite of the wind. Calm or opposed cells return a null bearing.
const COMPASS = ['N','NE','E','SE','S','SW','W','NW'];
const COMPASS_ID = ['U','TL','T','TG','S','BD','B','BL'];
export function compassPoint(deg, lang = 'en') {
  if (!Number.isFinite(deg)) return null;
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return (lang === 'id' ? COMPASS_ID : COMPASS)[i];
}
export function citySummary(cells) {
  const ok = (cells || []).filter((c) => Number.isFinite(c?.u) && Number.isFinite(c?.v));
  if (!ok.length) return null;
  const u = ok.reduce((a, c) => a + c.u, 0) / ok.length, v = ok.reduce((a, c) => a + c.v, 0) / ok.length;
  const speed = Math.hypot(u, v);
  const meanSpeed = ok.reduce((a, c) => a + Math.hypot(c.u, c.v), 0) / ok.length;
  if (speed < 0.3) return { calm: true, cells: ok.length, kmh: meanSpeed * 3.6 };
  const toward = (Math.atan2(u, v) * 180 / Math.PI + 360) % 360;
  return { calm: false, cells: ok.length, toward, from: (toward + 180) % 360, kmh: speed * 3.6 };
}

export function flowVector(windFromDeg, windMs) {
  // A meteorological FROM bearing is 0..360. An out-of-range value is a parsing
  // fault, not a direction: letting -1 through yields a confident-looking 179°
  // vector, which is exactly the invented number this layer must never produce.
  if (!Number.isFinite(windFromDeg) || windFromDeg < 0 || windFromDeg > 360) return null;
  if (!Number.isFinite(windMs) || windMs < 0) return null;
  const toward = ((windFromDeg + 180) % 360 + 360) % 360; // FROM + 180
  const rad = toward * Math.PI / 180;
  return { u: Math.sin(rad) * windMs, v: Math.cos(rad) * windMs, toward, speed: windMs, from: windFromDeg };
}

// Inverse-distance weighting over the real cells. Returns null rather than a
// guess when the point is far from every cell, so a particle never coasts on an
// invented vector.
export function sampleField(cells, lng, lat) {
  if (!Array.isArray(cells) || !cells.length) return null;
  let wsum = 0, u = 0, v = 0, nearest = Infinity, used = 0;
  for (const cell of cells) {
    if (!Number.isFinite(cell?.lng) || !Number.isFinite(cell?.lat)) continue;
    const dx = cell.lng - lng, dy = cell.lat - lat;
    const km = Math.hypot(dx * 111.32 * Math.cos(lat * Math.PI / 180), dy * 110.574);
    nearest = Math.min(nearest, km);
    if (km > 60) continue;               // too far to call: stays unknown
    const w = 1 / Math.max(km * km, 0.01);
    u += cell.u * w; v += cell.v * w; wsum += w; used++;
  }
  if (!wsum) return null;
  const uu = u / wsum, vv = v / wsum;
  return { u: uu, v: vv, speed: Math.hypot(uu, vv), toward: (Math.atan2(uu, vv) * 180 / Math.PI + 360) % 360, used, nearestKm: nearest };
}

export function createWindField(map, { text: t, active, buildTag, flow }) {
  let wind = null, air = null, epoch = 0, refusal = null, httpRefusal = null;
  let timer = null, source = null, layer = null, markers = null, frameNodes = [];
  let reduced = false, hiddenListener = null;
  const panel = { playing: false, index: 0 };

  // MapLibre throws if the before-id does not exist in the current style, and
  // the 2D view carries a different layer set. Only anchor to a layer we can see.
  const anchor = () => map.getLayer('network-water-lines') ? 'network-water-lines' : undefined;
  const el = (tag, content, cls) => { const n = document.createElement(tag); if (content !== undefined) n.textContent = content; if (cls) n.className = cls; return n; };
  const number = (n, d = 1) => Number.isFinite(n) ? n.toLocaleString(t('en-GB', 'id-ID'), { maximumFractionDigits: d }) : '—';
  const clock = v => new Date(v).toLocaleString(t('en-GB', 'id-ID'), { timeZone: 'Asia/Jakarta' }) + ' WIB';

  function cellsAt(index) {
    if (!wind?.cells) return [];
    return wind.cells.map((c) => {
      const h = c.hours[index];
      if (!h || !Number.isFinite(h.windMs) || !Number.isFinite(h.windFromDeg)) return null;
      const f = flowVector(h.windFromDeg, h.windMs);
      return f ? { ...c, ...f } : null;
    }).filter(Boolean);
  }

  // The panel opens on the current hour, never on the closest one. -1 means no
  // current hour: the panel states the gap and leaves the scrub on real hours.
  function currentIndex() {
    return currentHourIndex(wind?.hours, Date.now());
  }

  const refused = () => {
    const r = refusal;
    return !!(r && r !== 'no-current-hour');
  };

  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    panel.playing = false;
    const b = document.getElementById('wind-play');
    if (b) { b.textContent = t('Play wind field', 'Putar medan angin'); b.setAttribute('aria-pressed', 'false'); }
  }

  // Phones keep the evidence panel folded, so the rule rides on the map itself.
  function showChip() {
    let chip = document.getElementById('wind-not-pollution-chip');
    const wrap = document.querySelector('.atlas-map-wrap');
    if (!wrap) return;
    if (!chip) { chip = el('div', undefined, 'wind-chip'); chip.id = 'wind-not-pollution-chip'; chip.setAttribute('role', 'note'); wrap.append(chip); }
    chip.textContent = t('Wind, not pollution', 'Angin, bukan pencemaran');
  }

  // A compass on the map itself: the arrow points where the air is going, the
  // words say where it comes from. Desktop and phone alike.
  function showCompass(cells, hour) {
    const wrap = document.querySelector('.atlas-map-wrap');
    if (!wrap) return;
    const sum = citySummary(cells);
    let box = document.getElementById('wind-compass');
    if (!sum) { box?.remove(); return; }
    if (!box) {
      box = el('div', undefined, 'wind-compass'); box.id = 'wind-compass'; box.setAttribute('role', 'status');
      box.innerHTML = '<svg viewBox="-20 -20 40 40" width="40" height="40" aria-hidden="true"><circle r="18" fill="none" stroke="currentColor" stroke-opacity=".35"/><text y="-11" text-anchor="middle" font-size="7" fill="currentColor">N</text><g class="wind-compass-arrow"><line y1="12" y2="-12" stroke="#d8a24a" stroke-width="2.5"/><path d="M-5 -6 L0 -14 L5 -6" fill="none" stroke="#d8a24a" stroke-width="2.5"/></g></svg><span class="wind-compass-text"></span>';
      wrap.append(box);
    }
    const arrow = box.querySelector('.wind-compass-arrow'), label = box.querySelector('.wind-compass-text');
    // The compass is the one wind number drawn straight onto the map, and the
    // lens animates through forecast hours — so without the time it is a bare
    // number with no way to know which hour it belongs to.
    const at = hour ? clock(hour) : '';
    const tail = at ? ' · ' + at : '';
    const kmh = number(sum.kmh, 0), lang = t('en', 'id');
    if (sum.calm) {
      arrow.style.display = 'none';
      label.textContent = t(`Near calm · ${kmh} km/h mean of cells · ${sum.cells} model cells${tail}`, `Hampir tenang · ${kmh} km/jam rerata sel · ${sum.cells} sel model${tail}`);
    } else {
      arrow.style.display = '';
      arrow.setAttribute('transform', `rotate(${sum.toward.toFixed(0)})`);
      label.textContent = t(`Wind from ${compassPoint(sum.from, lang)}, blowing ${compassPoint(sum.toward, lang)} · ${kmh} km/h · city mean of ${sum.cells} model cells${tail}`,
        `Angin dari ${compassPoint(sum.from, lang)}, bertiup ke ${compassPoint(sum.toward, lang)} · ${kmh} km/jam · rerata kota dari ${sum.cells} sel model${tail}`);
    }
  }

  function hide() {
    document.getElementById('wind-not-pollution-chip')?.remove();
    document.getElementById('wind-compass')?.remove();
    stop();
    if (layer && map.getLayer(layer)) map.removeLayer(layer);
    layer = null;
    if (markers && map.getLayer(markers)) map.removeLayer(markers);
    markers = null;
    if (source && map.getSource(source)) map.removeSource(source);
    source = null;
    frameNodes = [];
    if (flow?.label === 'wind10') flow.setField(null);
  }

  function drawField(index) {
    if (!map || active() !== 'air' || refused()) return;
    const cells = cellsAt(index);
    if (!cells.length) { hide(); return; }
    const hour = wind.hours[index];
    const feature = {
      type: 'FeatureCollection',
      features: cells.map((c, i) => {
        // Length is built in KILOMETRES, then converted at this cell's latitude.
        // Working in degrees directly is how a 1.5 m/s wind became a 166 km line
        // across a 50 km city: 0.75° of longitude at 6°S is 83 km.
        const km = 3 + Math.min(c.speed, 6) * 3;            // 3..21 km
        const rad = c.toward * Math.PI / 180;
        const dLat = (Math.cos(rad) * km / 2) / 110.57;
        const dLng = (Math.sin(rad) * km / 2) / (111.32 * Math.cos(c.lat * Math.PI / 180));
        return {
          type: 'Feature',
          properties: { i, speed: c.speed, from: c.from, lengthKm: km },
          geometry: { type: 'LineString', coordinates: [[c.lng - dLng, c.lat - dLat], [c.lng + dLng, c.lat + dLat]] },
        };
      }).flatMap((shaft) => [shaft, arrowHead(shaft)]),
    };
    const data = { arrows: feature, at: hour, cells: cells.length };
    if (source && map.getSource(source)) map.getSource(source).setData(feature);
    else { source = 'wind-field-' + epoch; map.addSource(source, { type: 'geojson', data: feature }); }
    if (!map.getLayer(layer || 'wind-field-line')) {
      layer = layer || 'wind-field-line';
      // The arrows mark where the model actually has a cell; the flow canvas
      // draws the motion between them, so the arrows step back.
      map.addLayer({ id: layer, type: 'line', source: source, paint: { 'line-color': '#d8a24a', 'line-width': 1.4, 'line-opacity': flow ? 0.5 : 0.95 } }, anchor());
    } else map.setPaintProperty(layer, 'line-opacity', flow ? 0.5 : 0.95);
    frameNodes.forEach((n) => n.remove());
    frameNodes = [];
    showChip();
    showCompass(cells, hour);
    // Particles: one shared canvas, reading the same cells (u, v in m/s).
    flow?.setField(cells, { label: 'wind10' });
    updateReadout(data, cells);
  }

  function updateReadout(frame, cells) {
    const nodes = document.querySelectorAll('[data-wind-readout]');
    nodes.forEach((n) => {
      n.textContent = t(`${cells.length} model cells · ${frame.at ? clock(frame.at) : ''}`, `${cells.length} sel model · ${frame.at ? clock(frame.at) : ''}`);
    });
    const bar = document.getElementById('wind-timeline');
    if (bar && air?.times?.length) {
      const row = air.times[Math.min(panel.index, air.times.length - 1)];
      if (row) {
        document.querySelectorAll('[data-air-pm25]').forEach((n) => { n.textContent = number(row.pm25, 1); });
        document.querySelectorAll('[data-air-aod]').forEach((n) => { n.textContent = number(row.aod, 2); });
        document.querySelectorAll('[data-air-valid]').forEach((n) => { n.textContent = clock(row.validAt); });
      }
    }
  }

  function play() {
    if (!wind?.hours?.length) return;
    panel.playing = !panel.playing;
    const b = document.getElementById('wind-play');
    if (b) { b.textContent = panel.playing ? t('Pause', 'Jeda') : t('Play wind field', 'Putar medan angin'); b.setAttribute('aria-pressed', String(panel.playing)); }
    if (!panel.playing) { stop(); return; }
    // Play steps through the forecast hours, one per second, and loops.
    timer = setInterval(() => {
      if (active() !== 'air' || document.hidden) return;
      const next = (panel.index + 1) % wind.hours.length;
      scrubTo(next);
      const range = document.getElementById('wind-timeline');
      if (range) range.value = String(next);
    }, 1000);
  }

  function scrubTo(index) {
    const i = Math.max(0, Math.min(index, (wind?.hours?.length ?? 1) - 1));
    panel.index = i;
    drawField(i);
  }

  function render(body) {
    if (!body || active() !== 'air') return;
    stop();
    if (hiddenListener) { document.removeEventListener('visibilitychange', hiddenListener); hiddenListener = null; }
    hide();
    body.querySelector('#wind-field-section')?.remove();
    const section = el('div', undefined, 'air-timeline wind-field');
    section.id = 'wind-field-section';
    // A refused request was never measured. It is neither a dead provider nor
    // a stale model, and the panel says which one it is.
    if (httpRefusal) {
      section.append(el('p', refusalMessage(httpRefusal.retryAfterSeconds, t), 'note'));
      body.append(section); return;
    }
    // A refusal is stated, not left to look like a pending load.
    // A dead provider keeps this lens's own wording, which names the wind and the
    // calm it refuses to imply. Staleness and gaps get the shared reason, which
    // names the clock.
    if (refusal) {
      const text = refusal === 'unavailable'
        ? t('The wind model is unavailable. No wind is drawn and no calm is implied.', 'Model angin tidak tersedia. Angin tidak digambar dan kondisi tenang tidak disimpulkan.')
        : refusal === 'no-current-hour' ? scrubGapMessage(t) : admissionMessage(refusal, t);
      section.append(el('p', text, 'note'));
      body.append(section); return;
    }
    if (!wind) {
      section.append(el('p', t('Loading the wind model…', 'Memuat model angin…'), 'note'));
      body.append(section); return;
    }
    // An admitted envelope is available and carries cells, so the older
    // !available guard is now unreachable. One admission rule, not two.
    section.append(el('h3', t('Wind field · 10 m', 'Medan angin · 10 m')));
    // The server's cellNote is the authoritative contract text, but it is English
    // and this page defaults to Bahasa. Say it in the reader's language and keep
    // the server sentence as the fallback when the count is unknown.
    section.append(el('p', t(
      `${wind.cellCount} distinct model cells answered ${wind.requestedPoints} requested points. Each cell is one model value covering its whole neighbourhood; nothing here is street-level.`,
      `${wind.cellCount} sel model berbeda menjawab ${wind.requestedPoints} titik yang diminta. Setiap sel adalah satu nilai model untuk seluruh sekitarnya; tidak ada di sini yang setingkat jalan.`), 'note'));
    section.append(el('p', t('Model cell spacing ', 'Jarak sel model ') + (Number.isFinite(wind.spacingKm) ? number(wind.spacingKm, 1) + ' km' : t('unknown', 'tidak diketahui'))
      + ' · ' + t('requested', 'diminta') + ' ' + wind.requestedPoints + ' · ' + t('answered', 'dijawab') + ' ' + wind.cellCount, 'meta'));
    const readout = el('p', '', 'meta'); readout.dataset.windReadout = '1'; section.append(readout);

    const controls = el('div', undefined, 'crm-actions');
    const playBtn = el('button', t('Play wind field', 'Putar medan angin')); playBtn.type = 'button'; playBtn.id = 'wind-play';
    playBtn.setAttribute('aria-pressed', 'false'); playBtn.addEventListener('click', play);
    controls.append(playBtn);
    const nowBtn = el('button', t('Now', 'Sekarang')); nowBtn.type = 'button';
    nowBtn.addEventListener('click', () => scrubTo(currentIndex()));
    controls.append(nowBtn);
    section.append(controls);

    const range = el('input'); range.type = 'range'; range.id = 'wind-timeline'; range.min = '0';
    range.max = String(Math.max(0, wind.hours.length - 1)); range.value = String(currentIndex()); range.step = '1';
    range.setAttribute('aria-label', t('Forecast hour', 'Jam prakiraan'));
    range.addEventListener('input', () => { stop(); scrubTo(Number(range.value)); });
    section.append(range);
    section.append(el('p', t('Drag to step through the forecast hours. Motion shows wind speed and bearing; particles travel between model cells by inverse-distance interpolation, which is the only interpolated quantity here.',
      'Geser untuk menelusuri jam prakiraan. Gerak menunjukkan kecepatan dan arah angin; partikel bergerak antar sel model dengan interpolasi jarak terbalik, satu-satunya kuantitas yang diinterpolasi di sini.'), 'note'));
    section.append(el('p', t('This layer is wind, not pollution. No concentration, plume width, source or exposure is derived from it.',
      'Lapisan ini adalah angin, bukan pencemaran. Tidak ada konsentrasi, lebar plume, sumber, atau paparan yang diturunkan darinya.'), 'note'));
    body.append(section);

    reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    hiddenListener = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hiddenListener);
    panel.index = Math.max(0, currentIndex());
    drawField(panel.index);
  }

  function show(body) {
    hide();
    const myEpoch = ++epoch;
    wind = null; refusal = null; httpRefusal = null; render(body);
    const windFetch = fetch('/api/atlas/wind-field' + (buildTag ? '?v=' + encodeURIComponent(buildTag) : ''), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12000) })
      .then((r) => readJson(r));
    // The air timeline is a second feed for this panel's readout. Its own lens
    // reports a refusal of that feed; a refusal here must not blank the wind.
    const airFetch = fetch('/api/atlas/air-timeline' + (buildTag ? '?v=' + encodeURIComponent(buildTag) : ''), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12000) })
      .then((r) => readJson(r)).catch(() => null);
    Promise.allSettled([windFetch, airFetch]).then(([w, a]) => {
      if (myEpoch !== epoch) return;
      if (w.status === 'rejected') {
        // The request was refused, not answered badly. Nothing was measured.
        if (isRefusalError(w.reason)) httpRefusal = w.reason;
        wind = null; air = null; refusal = httpRefusal ? null : 'unavailable';
        render(body);
        return;
      }
      // Same admission the synoptic and research lenses apply. A stale envelope
      // must not draw a wind field that reads as describing this hour.
      const admission = admitModel(w.value);
      wind = admission.ok ? w.value : null;
      refusal = admission.ok ? null : admission.reason;
      air = a.status === 'fulfilled' ? a.value : null;
      render(body);
    });
  }

  function clear() {
    epoch++;
    wind = null; air = null; refusal = null; httpRefusal = null;
    stop();
    hide();
    if (hiddenListener) { document.removeEventListener('visibilitychange', hiddenListener); hiddenListener = null; }
  }

  // render is exported separately from show so the lens evidence panel can
  // repaint after body.replaceChildren() without refetching the model.
  return { show, render, clear, play, scrubTo };
}