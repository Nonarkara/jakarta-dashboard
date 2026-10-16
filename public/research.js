// Research page. Every figure here is read at load time from the files this
// site ships or from its live API; nothing is typed into the HTML. The live
// panel runs the atlas's own modules (isobars, low centre, particle sampler,
// parcel trajectory) on the real synoptic payload, so what you read about is
// what is running.
import { gridOf, contour, stitch, lowCentre, hoursOf } from './synoptic.js';
import { trajectory } from './haze-transport.js';
import { makeSampler, stepLngLat } from './flow-canvas.js';

const JAKARTA = { lng: 106.8272, lat: -6.1754 };
const root = document.documentElement;
let lang = 'id';
try {
  const q = new URLSearchParams(location.search).get('lang');
  lang = ['id', 'en'].includes(q) ? q : (localStorage.getItem('jakarta-dashboard-lang') === 'en' ? 'en' : 'id');
} catch { /* storage blocked: Indonesian default */ }
const t = (en, id) => (lang === 'en' ? en : id);
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toLocaleString(lang === 'en' ? 'en-GB' : 'id-ID', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—');
const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();
const json = (url) => fetch(url, { signal: AbortSignal.timeout(35000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const renders = [];
function applyLang() {
  root.lang = lang; root.dataset.lang = lang;
  document.title = t('How it is built · JKTx', 'Cara dibuat · JKTx');
  renders.forEach((r) => r());
}
document.getElementById('lang').addEventListener('click', () => {
  lang = lang === 'en' ? 'id' : 'en';
  try { localStorage.setItem('jakarta-dashboard-lang', lang); localStorage.setItem('jakarta-atlas-language', lang); } catch { /* preference only */ }
  const u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u);
  applyLang();
});

// ── Shipped-file figures ─────────────────────────────────────────────────
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const files = Promise.all([
  json('/data/jakarta-v1/buildings-stats.json'),
  json('/data/jakarta-v1/transit.json'),
  json('/data/jakarta-v1/source-catalog.json'),
  json('/data/jakarta-v1/flood-network.json'),
]);
const live = { fires: json('/api/atlas/fires'), syn: json('/api/atlas/synoptic') };

files.then(([buildings, transit, catalog, flood]) => {
  const records = Array.isArray(catalog?.records) ? catalog.records : [];
  const count = (s) => records.filter((r) => r.status === s).length;
  const draw = () => {
    document.getElementById('fig-buildings').textContent = fmt(buildings?.count);
    const fig = document.getElementById('figures'); fig.replaceChildren();
    const cell = (value, label) => { const d = el('div'); d.append(el('b', null, value), el('span', null, label)); fig.append(d); };
    cell(fmt(transit?.routeCount), t('Transjakarta GTFS routes', 'rute GTFS Transjakarta'));
    cell(fmt(flood?.stations?.length ?? flood?.stationCount), t('flood-network stations', 'stasiun jaringan banjir'));
    cell(fmt(count('integrated')), t('sources integrated', 'sumber terintegrasi'));
    cell(fmt(records.length), t('sources assessed', 'sumber dinilai'));

    const st = document.getElementById('src-status'); st.replaceChildren();
    for (const [s, en, id] of [['integrated', 'integrated', 'terintegrasi'], ['candidate', 'candidate', 'kandidat'], ['registration-required', 'needs registration', 'perlu registrasi'], ['blocked', 'blocked', 'terblokir']]) {
      const d = el('div'); d.append(el('b', 'big', fmt(count(s))), el('p', 'eyebrow', t(en, id))); st.append(d);
    }

    // Height sources: shares of the baked archive, read from its stats file.
    const h = buildings?.height || {};
    const parts = [['measured', t('tagged (OSM / survey)', 'bertag (OSM / survei)'), css('--ink')], ['floors', t('floors × 3.3 m', 'lantai × 3,3 m'), css('--lacquer')],
      ['google', t('Google 2.5D satellite, p75', 'satelit Google 2.5D, p75'), css('--accent')], ['ghsl', t('GHSL area average', 'rata-rata area GHSL'), css('--line')], ['estimated', t('type default', 'nilai bawaan tipe'), css('--dim')]];
    const total = parts.reduce((a, [k]) => a + (h[k] || 0), 0);
    const stack = document.getElementById('height-stack'), legend = document.getElementById('height-legend');
    stack.replaceChildren(); legend.replaceChildren();
    if (total) for (const [k, label, colour] of parts) {
      const share = (h[k] || 0) / total;
      const bar = el('i'); bar.style.width = (share * 100) + '%'; bar.style.background = colour; stack.append(bar);
      const li = el('li'); const sw = el('s'); sw.style.background = colour;
      li.append(sw, document.createTextNode(label + ' · ' + fmt(h[k]) + ' · ' + fmt(share * 100, 2) + ' %')); legend.append(li);
    }
    else legend.append(el('li', null, t('Building statistics unavailable.', 'Statistik bangunan tidak tersedia.')));
  };
  renders.push(draw); draw();
});

// ── Live field ───────────────────────────────────────────────────────────
const base = document.getElementById('field'), top = document.getElementById('flow');
const caption = document.getElementById('live-caption');
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

Promise.all([live.syn, live.fires]).then(([syn, fires]) => {
  if (!syn?.available || !syn.cells?.length) {
    const say = () => { caption.textContent = t('The pressure model did not answer. Nothing is drawn in its place.', 'Model tekanan tidak menjawab. Tidak ada yang digambar sebagai gantinya.'); };
    renders.push(say); say(); return;
  }
  const now = Date.now();
  let index = 0, best = Infinity;
  syn.hours.forEach((h, i) => { const d = Math.abs(Date.parse(h) - now); if (d < best) { best = d; index = i; } });
  const cells = hoursOf(syn.cells, index);
  const winds = cells.filter((c) => Number.isFinite(c.u));
  const byHour = syn.hours.map((_, i) => hoursOf(syn.cells, i).filter((c) => Number.isFinite(c.u)));
  const run = trajectory(byHour, index, JAKARTA, 24);
  const low = lowCentre(syn.cells, index);
  const sampler = makeSampler(winds);

  // Equirectangular view of the cell box, aspect corrected by cos(latitude).
  const lats = syn.cells.map((c) => c.lat), lngs = syn.cells.map((c) => c.lng);
  const pad = 0.25, w = Math.min(...lngs) - pad, e = Math.max(...lngs) + pad, s = Math.min(...lats) - pad, n = Math.max(...lats) + pad;
  const aspect = (n - s) / ((e - w) * Math.cos(((n + s) / 2) * Math.PI / 180));
  const W = 1080, H = Math.round(W * aspect);
  for (const c of [base, top]) { c.width = W; c.height = H; }
  base.parentElement.style.aspectRatio = W + ' / ' + H;
  const x = (lng) => ((lng - w) / (e - w)) * W, y = (lat) => ((n - lat) / (n - s)) * H;

  function drawBase() {
    const g = base.getContext('2d'); if (!g) return;
    g.clearRect(0, 0, W, H);
    g.font = '30px ui-monospace, Menlo, monospace'; g.textBaseline = 'middle';
    // Graticule every 2°: orientation without a coastline we do not ship.
    g.strokeStyle = css('--strong'); g.lineWidth = 1; g.fillStyle = css('--dim');
    for (let lng = Math.ceil(w / 2) * 2; lng <= e; lng += 2) { g.beginPath(); g.moveTo(x(lng), 0); g.lineTo(x(lng), H); g.stroke(); g.fillText(lng + '°E', x(lng) + 6, H - 16); }
    for (let lat = Math.ceil(s / 2) * 2; lat <= n; lat += 2) { g.beginPath(); g.moveTo(0, y(lat)); g.lineTo(W, y(lat)); g.stroke(); g.fillText(Math.abs(lat) + '°S', 8, y(lat) - 14); }
    // Isobars every 2 hPa between the pressures the provider returned.
    const rows = gridOf(cells), p = cells.map((c) => c.mslpHpa);
    g.strokeStyle = css('--ink'); g.globalAlpha = 0.55; g.lineWidth = 1.5;
    for (let L = Math.ceil(Math.min(...p) / 2) * 2; L <= Math.floor(Math.max(...p) / 2) * 2; L += 2) {
      for (const line of stitch(contour(rows, L))) {
        g.beginPath(); line.forEach(([lng, lat], i) => (i ? g.lineTo(x(lng), y(lat)) : g.moveTo(x(lng), y(lat)))); g.stroke();
        const mid = line[Math.floor(line.length / 2)];
        g.globalAlpha = 1; g.fillStyle = css('--dim'); g.fillText(String(L), x(mid[0]) + 4, y(mid[1])); g.globalAlpha = 0.55;
      }
    }
    g.globalAlpha = 1;
    // Model cells: where the numbers actually come from.
    g.fillStyle = css('--line');
    for (const c of cells) { g.beginPath(); g.arc(x(c.lng), y(c.lat), 3, 0, Math.PI * 2); g.fill(); }
    if (low?.isLow) { g.fillStyle = css('--lacquer'); g.font = '700 44px -apple-system, Helvetica, sans-serif'; g.fillText('L', x(low.lng) - 10, y(low.lat)); g.font = '30px ui-monospace, Menlo, monospace'; }
    // Fire detections inside the box, sized by radiative power.
    g.fillStyle = css('--lacquer');
    for (const f of fires?.features || []) {
      const [lng, lat] = f.geometry?.coordinates || [];
      if (!(lng >= w && lng <= e && lat >= s && lat <= n)) continue;
      const r = 2 + Math.min(Math.sqrt(Math.max(f.properties?.frp || 0, 0)) / 3, 6);
      g.beginPath(); g.arc(x(lng), y(lat), r, 0, Math.PI * 2); g.fill();
    }
    // The Jakarta parcel, with a tick every 6 hours.
    if (run?.path?.length > 1) {
      g.strokeStyle = css('--accent'); g.lineWidth = 4; g.beginPath();
      run.path.forEach(([lng, lat], i) => (i ? g.lineTo(x(lng), y(lat)) : g.moveTo(x(lng), y(lat)))); g.stroke();
      g.fillStyle = css('--accent');
      run.path.forEach(([lng, lat], i) => { if (i && i % 6 === 0) { g.fillRect(x(lng) - 5, y(lat) - 5, 10, 10); g.fillText('+' + i + 'h', x(lng) + 10, y(lat) - 14); } });
    }
    g.fillStyle = css('--ink'); g.fillRect(x(JAKARTA.lng) - 6, y(JAKARTA.lat) - 6, 12, 12);
    g.fillText('Jakarta', x(JAKARTA.lng) + 12, y(JAKARTA.lat) + 18);
  }

  // Particles over the base, trails fading by destination-in.
  const ctx = top.getContext('2d');
  const metresPerPx = ((e - w) / W) * 111320 * Math.cos(((n + s) / 2) * Math.PI / 180);
  const seconds = sampler ? (1.6 * metresPerPx) / sampler.maxSpeed : 0;
  let particles = [], raf = null;
  const spawn = () => {
    for (let i = 0; i < 6; i++) { const lng = w + Math.random() * (e - w), lat = s + Math.random() * (n - s); if (sampler.sample(lng, lat)) return { lng, lat, age: 0, life: 60 + Math.random() * 80 }; }
    return null;
  };
  const colour = (speed) => (speed / sampler.maxSpeed > 0.66 ? css('--accent') : css('--ink'));
  function frame() {
    raf = null;
    if (document.hidden || !ctx) return;
    ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over'; ctx.lineWidth = 2;
    while (particles.length < 900) { const p = spawn(); if (!p) break; particles.push(p); }
    particles = particles.filter((p) => {
      const f = sampler.sample(p.lng, p.lat); if (!f || p.age > p.life) return false;
      const [lng, lat] = stepLngLat(p.lng, p.lat, f.u, f.v, seconds);
      ctx.strokeStyle = colour(Math.hypot(f.u, f.v)); ctx.globalAlpha = Math.min(1, (p.life - p.age) / 20, p.age / 6 + 0.2);
      ctx.beginPath(); ctx.moveTo(x(p.lng), y(p.lat)); ctx.lineTo(x(lng), y(lat)); ctx.stroke();
      p.lng = lng; p.lat = lat; p.age++; return true;
    });
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  function still() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H); ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
    for (let i = 0; i < 400; i++) {
      const p = spawn(); if (!p) break;
      ctx.beginPath(); ctx.moveTo(x(p.lng), y(p.lat));
      for (let k = 0; k < 16; k++) { const f = sampler.sample(p.lng, p.lat); if (!f) break; [p.lng, p.lat] = stepLngLat(p.lng, p.lat, f.u, f.v, seconds * 2); ctx.strokeStyle = colour(Math.hypot(f.u, f.v)); ctx.lineTo(x(p.lng), y(p.lat)); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const start = () => { if (!sampler) return; if (reduced()) still(); else if (raf === null && !document.hidden) raf = requestAnimationFrame(frame); };
  document.addEventListener('visibilitychange', () => { if (document.hidden && raf !== null) { cancelAnimationFrame(raf); raf = null; } else start(); });

  const say = () => {
    const at = new Date(syn.hours[index]).toLocaleString(lang === 'en' ? 'en-GB' : 'id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
    const parts = [
      t('Model hour', 'Jam model') + ' ' + at + ' WIB',
      winds.length + ' / ' + syn.requestedPoints + ' ' + t('cells answered', 'sel menjawab'),
      t('grid step', 'langkah kisi') + ' ' + fmt(syn.spacingKm) + ' km',
      low ? (low.isLow ? t('closed low', 'pusat rendah tertutup') : t('lowest (open, not a closed low)', 'terendah (terbuka, bukan pusat tertutup)')) + ' ' + fmt(low.mslpHpa) + ' hPa' : null,
      run ? t('Jakarta parcel', 'parsel Jakarta') + ' ' + run.hours + ' h' + (run.stopped ? ' (' + ({ 'left-field': t('left the data', 'keluar dari data'), 'forecast-ends': t('forecast ends', 'prakiraan berakhir'), 'no-wind': t('no wind cell', 'tanpa sel angin') }[run.stopped] || run.stopped) + ')' : '') : null,
      fires?.count != null ? fmt(fires.count) + ' ' + t('FIRMS detections in 24 h (region)', 'deteksi FIRMS dalam 24 jam (wilayah)') : t('FIRMS unavailable', 'FIRMS tidak tersedia'),
      'Open-Meteo · ' + t('model estimate', 'estimasi model'),
    ];
    caption.textContent = parts.filter(Boolean).join(' · ');
    drawBase();
    if (reduced()) still();
  };
  renders.push(say); say(); start();
});

applyLang();
