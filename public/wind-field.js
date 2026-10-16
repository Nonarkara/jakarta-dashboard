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
    const km = Math.sqrt(dx * dx * 111 * 111 + dy * dy * 110);
    nearest = Math.min(nearest, km);
    if (km > 60) continue;               // too far to call: stays unknown
    const w = 1 / Math.max(km * km, 0.01);
    u += cell.u * w; v += cell.v * w; wsum += w; used++;
  }
  if (!wsum) return null;
  const uu = u / wsum, vv = v / wsum;
  return { u: uu, v: vv, speed: Math.hypot(uu, vv), toward: (Math.atan2(uu, vv) * 180 / Math.PI + 360) % 360, used, nearestKm: nearest };
}

export function createWindField(map, { text: t, active, buildTag }) {
  let wind = null, air = null, epoch = 0;
  let raf = null, source = null, layer = null, markers = null, frameNodes = [];
  let particles = [], reduced = false, hiddenListener = null, visibility = null;
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

  function currentIndex() {
    if (!wind?.hours?.length) return 0;
    const now = Date.now();
    let best = 0, bestDelta = Infinity;
    wind.hours.forEach((h, i) => { const d = Math.abs(Date.parse(h) - now); if (d < bestDelta) { bestDelta = d; best = i; } });
    return best;
  }

  function stop() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    panel.playing = false;
    const b = document.getElementById('wind-play');
    if (b) { b.textContent = t('Play wind field', 'Putar medan angin'); b.setAttribute('aria-pressed', 'false'); }
  }

  function hide() {
    stop();
    if (layer && map.getLayer(layer)) map.removeLayer(layer);
    layer = null;
    if (markers && map.getLayer(markers)) map.removeLayer(markers);
    markers = null;
    if (source && map.getLayer(source + '-p') && map.getLayer(source + '-p')) map.removeLayer(source + '-p');
    if (source && map.getSource(source + '-p')) map.removeSource(source + '-p');
    if (source && map.getSource(source)) map.removeSource(source);
    source = null;
    frameNodes = [];
    particles = [];
  }

  function drawField(index) {
    if (!map || active() !== 'air') return;
    const cells = cellsAt(index);
    if (!cells.length) { hide(); return; }
    const hour = wind.hours[index];
    const feature = {
      type: 'FeatureCollection',
      features: cells.map((c, i) => {
        const rad = c.toward * Math.PI / 180;
        // Arrow length encodes speed: 0.5 degrees per m/s, capped so a gust does
        // not become a city-spanning line.
        const len = Math.min(0.5 * c.speed, 2.2);
        const dx = Math.sin(rad) * len, dy = Math.cos(rad) * len;
        return {
          type: 'Feature',
          properties: { i, speed: c.speed, from: c.from },
          geometry: { type: 'LineString', coordinates: [[c.lng - dx / 2, c.lat - dy / 2], [c.lng + dx / 2, c.lat + dy / 2]] },
        };
      }),
    };
    const data = { arrows: feature, at: hour, cells: cells.length };
    if (source && map.getSource(source)) map.getSource(source).setData(feature);
    else { source = 'wind-field-' + epoch; map.addSource(source, { type: 'geojson', data: feature }); }
    if (!map.getLayer(layer || 'wind-field-line')) {
      layer = layer || 'wind-field-line';
      map.addLayer({ id: layer, type: 'line', source: source, paint: { 'line-color': '#d8a24a', 'line-width': 2.2, 'line-opacity': 0.95 } }, anchor());
    } else map.setPaintProperty(layer, 'line-opacity', 0.95);
    frameNodes.forEach((n) => n.remove());
    frameNodes = [];
    if (!reduced) seedParticles(cells);
    updateReadout(data, cells);
  }

  function seedParticles(cells) {
    const pts = [];
    for (const c of cells) {
      const rad = c.toward * Math.PI / 180;
      for (let k = -2; k <= 2; k++) {
        const off = k * 0.035;
        pts.push([c.lng - Math.sin(rad) * off, c.lat - Math.cos(rad) * off]);
      }
    }
    particles = pts.map((p, i) => ({ lng: p[0], lat: p[1], life: (i * 0.13) % 1 }));
  }

  // Particles are only a reading of the field. They are redrawn from the live
  // cell values on every frame, so they can never outlive the hour they came from.
  function tick() {
    if (active() !== 'air' || document.hidden) { raf = requestAnimationFrame(tick); return; }
    const index = panel.index;
    const cells = cellsAt(index);
    if (cells.length) {
      const next = [];
      for (const p of particles) {
        const f = sampleField(cells, p.lng, p.lat);
        if (!f || f.speed < 0.05) continue;
        const dt = 0.00035; // ~ one animation frame of model advection
        next.push({ lng: p.lng + f.u * dt, lat: p.lat + f.v * dt, life: p.life });
      }
      // Seed around cells when the set thins out, so the field keeps reading.
      if (next.length < cells.length * 4) seedParticles(cells).forEach((p) => next.push(p));
      particles = next.slice(0, 260);
      const line = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'MultiPoint', coordinates: particles.map((p) => [p.lng, p.lat]) } }],
      };
      if (source && map.getSource(source + '-p')) map.getSource(source + '-p').setData(line);
      else {
        map.addSource(source + '-p', { type: 'geojson', data: line });
        map.addLayer({ id: source + '-p', type: 'circle', source: source + '-p', paint: { 'circle-color': '#f1e7d0', 'circle-radius': 1.6, 'circle-opacity': 0.55 } }, anchor());
      }
    }
    raf = requestAnimationFrame(tick);
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
    if (panel.playing && !raf) { panel.index = currentIndex(); raf = requestAnimationFrame(tick); }
    if (!panel.playing) { stop(); }
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
    if (!wind) {
      section.append(el('p', t('Loading the wind model…', 'Memuat model angin…'), 'note'));
      body.append(section); return;
    }
    if (!wind.available) {
      section.append(el('p', t('The wind model is unavailable. No wind is drawn and no calm is implied.', 'Model angin tidak tersedia. Angin tidak digambar dan kondisi tenang tidak disimpulkan.'), 'note'));
      body.append(section); return;
    }
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
    drawField(currentIndex());
    if (!reduced) { raf = requestAnimationFrame(tick); }
  }

  function show(body) {
    hide();
    const myEpoch = ++epoch;
    wind = null; render(body);
    const pending = [
      fetch('/api/atlas/wind-field' + (buildTag ? '?v=' + encodeURIComponent(buildTag) : ''), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12000) })
        .then((r) => (r.ok ? r.json() : { available: false })).catch(() => ({ available: false })),
      fetch('/api/atlas/air-timeline' + (buildTag ? '?v=' + encodeURIComponent(buildTag) : ''), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12000) })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ];
    Promise.all(pending).then(([w, a]) => {
      if (myEpoch !== epoch) return;
      wind = w; air = a;
      render(body);
    });
  }

  function clear() {
    epoch++;
    stop();
    hide();
    if (hiddenListener) { document.removeEventListener('visibilitychange', hiddenListener); hiddenListener = null; }
  }

  // render is exported separately from show so the lens evidence panel can
  // repaint after body.replaceChildren() without refetching the model.
  return { show, render, clear, play, scrubTo };
}