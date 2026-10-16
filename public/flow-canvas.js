// One canvas, many lenses: animated wind flow drawn from real model cells.
//
// Every particle is a reading of the field, never a source of it. A particle
// moves by the wind the provider returned at the cells around it, interpolated
// by inverse distance from its nearest cells; where no cell lies within reach
// (1.6 x this grid's own spacing) there is no wind to read, so nothing moves and
// nothing is drawn. Speed on screen is proportional to wind speed at every zoom.
// It shows where air is moving, not what it carries: no concentration, plume or
// source is drawn here.
//
// Shared by the air lens (10 m wind), the haze lens (850 hPa) and the rain lens
// (850 hPa): callers hand it cells of {lng, lat, u, v} in m/s (u east, v north)
// and a label, or null to clear.

const R_LAT = 110574;            // metres per degree of latitude
const R_LNG = 111320;            // metres per degree of longitude at the equator

// Inverse-distance weighting over the k nearest cells within reach. Returns null
// rather than extrapolating past the data.
export function makeSampler(cells, k = 4) {
  const pts = (cells || []).filter((c) => [c?.lng, c?.lat, c?.u, c?.v].every(Number.isFinite));
  if (!pts.length) return null;
  const kmBetween = (a, b) => {
    const cos = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
    return Math.hypot((a.lng - b.lng) * R_LNG * cos, (a.lat - b.lat) * R_LAT) / 1000;
  };
  // Grid spacing = median nearest-neighbour distance; reach scales with it so a
  // 10 km city grid and a 250 km regional grid are both read honestly.
  const nn = pts.map((p) => Math.min(...pts.filter((q) => q !== p).map((q) => kmBetween(p, q)), Infinity));
  const finite = nn.filter(Number.isFinite).sort((a, b) => a - b);
  const spacingKm = finite.length ? finite[Math.floor(finite.length / 2)] : 50;
  const reachKm = spacingKm * 1.6;
  const lngs = pts.map((p) => p.lng), lats = pts.map((p) => p.lat);
  const pad = reachKm / 111;
  const bounds = { w: Math.min(...lngs) - pad, e: Math.max(...lngs) + pad, s: Math.min(...lats) - pad, n: Math.max(...lats) + pad };
  const maxSpeed = Math.max(...pts.map((p) => Math.hypot(p.u, p.v)), 0.1);
  function sample(lng, lat) {
    const near = [];
    for (const p of pts) {
      const km = kmBetween(p, { lng, lat });
      if (km > reachKm) continue;
      near.push([km, p]);
    }
    if (!near.length) return null;
    near.sort((a, b) => a[0] - b[0]);
    let u = 0, v = 0, w = 0;
    for (const [km, p] of near.slice(0, k)) {
      const wt = 1 / Math.max(km * km, 1e-6);
      u += p.u * wt; v += p.v * wt; w += wt;
    }
    return { u: u / w, v: v / w };
  }
  return { sample, bounds, spacingKm, reachKm, maxSpeed, count: pts.length };
}

// Geographic step for a particle: metres = wind (m/s) x seconds of model time;
// longitude shrinks with cos(latitude).
export function stepLngLat(lng, lat, u, v, seconds) {
  const cos = Math.max(Math.cos(lat * Math.PI / 180), 1e-6);
  return [lng + (u * seconds) / (R_LNG * cos), lat + (v * seconds) / R_LAT];
}

export function createFlowCanvas(map, { colors = ['#8fb7c9', '#f1e7d0', '#d8a24a', '#e0663d'] } = {}) {
  const container = map.getContainer();
  const canvas = document.createElement('canvas');
  canvas.className = 'flow-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '1' });
  container.append(canvas);
  const ctx = canvas.getContext && canvas.getContext('2d');
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  let sampler = null, particles = [], raf = null, dpr = 1, label = null, key = null;

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = container.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    clear();
  }
  function clear() { ctx?.clearRect(0, 0, canvas.width, canvas.height); }
  function colourFor(speed) {
    const t = Math.min(speed / (sampler?.maxSpeed || 1), 1) * (colors.length - 1);
    return colors[Math.round(t)];
  }
  // Seconds of model time per frame, chosen so a wind of maxSpeed crosses about
  // 1.6 px per frame at the current zoom. Relative speeds stay exact.
  function secondsPerFrame(lat) {
    const metresPerPx = 156543.034 * Math.cos(lat * Math.PI / 180) / 2 ** map.getZoom();
    return (1.6 * metresPerPx) / (sampler?.maxSpeed || 1);
  }
  function spawn() {
    const b = sampler.bounds, view = map.getBounds();
    const w = Math.max(b.w, view.getWest()), e = Math.min(b.e, view.getEast());
    const s = Math.max(b.s, view.getSouth()), n = Math.min(b.n, view.getNorth());
    if (w >= e || s >= n) return null;
    for (let i = 0; i < 6; i++) {
      const lng = w + Math.random() * (e - w), lat = s + Math.random() * (n - s);
      if (sampler.sample(lng, lat)) return { lng, lat, age: 0, life: 50 + Math.random() * 70 };
    }
    return null;
  }
  function population() {
    const area = (canvas.width * canvas.height) / (dpr * dpr);
    return Math.min(850, Math.round(area / 1800));
  }
  function frame() {
    raf = null;
    if (!sampler || !ctx || document.hidden) return;
    // Fade previous strokes into trails, then draw this frame's motion.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1.0 * dpr;
    ctx.lineCap = 'round';
    const target = population();
    while (particles.length < target) { const p = spawn(); if (!p) break; particles.push(p); }
    const next = [];
    for (const p of particles) {
      const f = sampler.sample(p.lng, p.lat);
      if (!f || p.age > p.life) continue;           // left the data, or lived out
      const [lng, lat] = stepLngLat(p.lng, p.lat, f.u, f.v, secondsPerFrame(p.lat));
      const a = map.project([p.lng, p.lat]), b = map.project([lng, lat]);
      ctx.strokeStyle = colourFor(Math.hypot(f.u, f.v));
      ctx.globalAlpha = Math.min(1, (p.life - p.age) / 20, p.age / 6 + 0.15);
      ctx.beginPath(); ctx.moveTo(a.x * dpr, a.y * dpr); ctx.lineTo(b.x * dpr, b.y * dpr); ctx.stroke();
      next.push({ ...p, lng, lat, age: p.age + 1 });
    }
    ctx.globalAlpha = 1;
    particles = next;
    raf = requestAnimationFrame(frame);
  }
  // Reduced motion: one still frame of short streamlines, no animation loop.
  function still() {
    clear();
    if (!sampler || !ctx) return;
    ctx.lineWidth = 1.0 * dpr; ctx.globalAlpha = 0.8;
    for (let i = 0; i < Math.min(180, population()); i++) {
      let p = spawn(); if (!p) break;
      ctx.beginPath(); let a = map.project([p.lng, p.lat]); ctx.moveTo(a.x * dpr, a.y * dpr);
      for (let s = 0; s < 14; s++) {
        const f = sampler.sample(p.lng, p.lat); if (!f) break;
        [p.lng, p.lat] = stepLngLat(p.lng, p.lat, f.u, f.v, secondsPerFrame(p.lat) * 2);
        ctx.strokeStyle = colourFor(Math.hypot(f.u, f.v));
        a = map.project([p.lng, p.lat]); ctx.lineTo(a.x * dpr, a.y * dpr);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function start() {
    if (!sampler) return;
    if (reduced()) { still(); return; }
    if (raf === null && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf !== null) cancelAnimationFrame(raf); raf = null; }

  const onMove = () => { clear(); particles = []; if (reduced()) still(); };
  const onVisibility = () => { if (document.hidden) stop(); else start(); };
  map.on('resize', size);
  map.on('move', onMove);
  document.addEventListener('visibilitychange', onVisibility);
  size();

  return {
    // cells: [{lng, lat, u, v}] in m/s, or null to clear. Returns the sampler
    // summary so the caller can state grid spacing and reach on its panel.
    // opts.key: the same field redrawn (a repaint, a pan) keeps its particles.
    setField(cells, opts = {}) {
      const summary = () => (sampler ? { cells: sampler.count, spacingKm: sampler.spacingKm, reachKm: sampler.reachKm } : null);
      if (cells && opts.key && opts.key === key && opts.label === label) return summary();
      key = cells ? opts.key || null : null;
      stop(); clear(); particles = [];
      sampler = cells ? makeSampler(cells) : null;
      label = sampler ? (opts.label || null) : null;
      canvas.dataset.flow = label || '';
      if (sampler) start();
      return summary();
    },
    get label() { return label; },
    destroy() {
      stop(); map.off('resize', size); map.off('move', onMove);
      document.removeEventListener('visibilitychange', onVisibility); canvas.remove();
    },
  };
}
