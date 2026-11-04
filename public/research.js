// Research page. Every figure here is read at load time from the files this
// site ships or from its live API; nothing is typed into the HTML. The live
// panel runs the atlas's own modules (isobars, low centre, particle sampler,
// parcel trajectory) on the real synoptic payload, so what you read about is
// what is running.
import { gridOf, contour, stitch, lowCentre, hoursOf, isobarLevels, ISOBAR_STEP_HPA } from './synoptic.js';
import { trajectory } from './haze-transport.js';
import { makeSampler, stepLngLat } from './flow-canvas.js';
import { labelPosition } from './research-labels.js';
import {currentResearchField,createResearchSession,researchFires} from './research-session.js';
import {readJson,isRefusalError,refusalMessage} from './refusal.js';

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
// One reader for every response. A refused request throws a refusal that
// carries its retry window, so the page below can say what happened instead
// of calling the model unavailable.
const json = (url) => fetch(url, { signal: AbortSignal.timeout(35000) }).then((r) => readJson(r)).catch(() => null);
const renders = [];
function applyLang() {
  root.lang = lang; root.dataset.lang = lang;
  document.title = t('How it is built · JKTx', 'Cara dibuat · JKTx');
  document.querySelectorAll('[data-city-link]').forEach((a) => { const u = new URL(a.href); u.searchParams.set('lang', lang); a.href = u.href; });
  document.getElementById('lang').setAttribute('aria-label', t('Switch to Bahasa Indonesia', 'Ganti bahasa ke Inggris'));
  // The canvas carries a sighted drawing and an English-only accessible name.
  // The atlas translates its accessible attributes; this page must not be the
  // one surface where a screen reader is told the wrong language.
  const field = document.getElementById('field');
  if (field) field.setAttribute('aria-label', t('Isobars, 850 hPa air flow and a 24 hour trajectory from Jakarta', 'Isobar, aliran udara 850 hPa dan lintasan 24 jam dari Jakarta'));
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', t('How the Jakarta atlas is built from open public data, satellites and arithmetic. Every figure is read from the files the site ships.', 'Cara atlas Jakarta dibangun dari data publik terbuka, satelit dan aritmetika. Setiap angka dibaca dari berkas yang dikirim situs ini.'));
  // The prose states the contour interval. Read it from the module that draws
  // it, so the sentence and the canvas cannot disagree in a later release.
  document.querySelectorAll('[data-isobar-step]').forEach((n) => { n.textContent = String(ISOBAR_STEP_HPA); });
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

// A ranked composition chart. One row per thing: name, bar, count, share. The
// bar is the share; the number beside it is the count, so a reader never has to
// estimate from the bar. Rows are content-sized and nothing is framed.
function barChart(host, rows, { total = null } = {}) {
  host.replaceChildren();
  const sum = total ?? rows.reduce((a, r) => a + (r.value || 0), 0);
  if (!sum) { host.append(el('p', 'caption', t('These figures are not available.', 'Angka ini tidak tersedia.'))); return; }
  for (const r of rows) {
    if (!(r.value > 0)) continue;
    const row = el('div', 'row');
    const share = r.value / sum;
    const fill = el('i');
    fill.style.width = (share * 100).toFixed(2) + '%';
    fill.style.background = r.colour || css('--ink');
    // The machine-readable share travels with the bar. An audit must never
    // parse the printed number: "90,9 %" and "90.9 %" are the same value and
    // stripping the wrong separator turned 90.9 into 909.
    row.dataset.share = share.toFixed(6);
    row.dataset.value = String(r.value);
    const meter = el('div', 'meter');
    meter.append(fill);
    const count = el('div', 'count', fmt(r.value));
    count.append(el('small', null, fmt(share * 100, 1) + ' %'));
    row.append(el('div', 'name', r.label), meter, count);
    host.append(row);
  }
}
const files = [
  json('/data/jakarta-v1/buildings-stats.json'),
  json('/data/jakarta-v1/transit.json'),
  json('/data/jakarta-v1/source-catalog.json'),
  json('/data/jakarta-v1/flood-network.json'),
];
const fileState = [null, null, null, null];


function renderFiles([buildings, transit, catalog, flood]) {
  const records = Array.isArray(catalog?.records) ? catalog.records : [];
  const count = (s) => Array.isArray(catalog?.records) ? records.filter((r) => r.status === s).length : null;
  const draw = () => {
    document.getElementById('fig-buildings').textContent = fmt(buildings?.count);
    const fig = document.getElementById('figures'); fig.replaceChildren();
    const cell = (value, label) => { const d = el('div'); d.append(el('b', null, value), el('span', null, label)); fig.append(d); };
    cell(fmt(transit?.routeCount), t('Transjakarta GTFS routes', 'rute GTFS Transjakarta'));
    cell(fmt(flood?.stations?.length ?? flood?.stationCount), t('flood-network stations', 'stasiun jaringan banjir'));
    cell(fmt(count('integrated')), t('sources integrated', 'sumber terintegrasi'));
    cell(fmt(Array.isArray(catalog?.records) ? records.length : null), t('sources assessed', 'sumber dinilai'));

    const st = document.getElementById('src-status'); st.replaceChildren();
    // The catalogue's own status words, not restatements of them. A short name
    // buys the bar its length back: the label column is sized to the longest
    // name, so every extra word is taken straight out of the track.
    const STATUS = [
      ['integrated', t('Integrated', 'Terintegrasi'), css('--ink')],
      ['candidate', t('Candidate', 'Kandidat'), css('--accent')],
      ['registration-required', t('Registration needed', 'Perlu registrasi'), css('--dim')],
      ['blocked', t('Blocked', 'Terblokir'), css('--lacquer')],
    ];
    barChart(st, STATUS.map(([k, label, colour]) => ({ label, value: count(k), colour })), { total: records.length || null });

    // A literal licence-string grouping, not a legal permission verdict. Does
    // the register name one of the listed licences? That is a prefix test on the catalogue's
    // own string, not an interpretation of it — and every licence the test does
    // not catch is still listed in the disclosure below, so nothing is lost.
    const lic = document.getElementById('src-licence');
    const OPEN = /^(CC BY 4\.0|CC BY-NC 4\.0|ODbL|Apache-2\.0)/i;
    const namesOpen = records.filter((r) => OPEN.test(String(r.license ?? '').trim()));
    barChart(lic, [
      { label: t('Rights unresolved', 'Hak belum dipastikan'), value: records.length - namesOpen.length, colour: css('--ink') },
      { label: t('Licence recorded', 'Lisensi tercatat'), value: namesOpen.length, colour: css('--accent') },
    ], { total: records.length || null });

    const detail = document.getElementById('src-licence-detail');
    if (detail) {
      const tally = {};
      for (const r of namesOpen) { const s = String(r.license).trim(); tally[s] = (tally[s] || 0) + 1; }
      const list = el('ul', 'legend');
      for (const [text, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) list.append(el('li', null, fmt(n) + ' × ' + text));
      detail.replaceChildren(list);
    }

    // Height provenance: shares of the baked archive, read from its stats file.
    const h = buildings?.height || {};
    const parts = [['google', t('Google 2.5D satellite, p75', 'satelit Google 2.5D, p75'), css('--accent')],
      ['ghsl', t('GHSL area average', 'rata-rata area GHSL'), css('--ink')],
      ['floors', t('floors × 3.3 m', 'lantai × 3,3 m'), css('--lacquer')],
      ['estimated', t('unknown height · flat', 'tinggi tidak diketahui · datar'), css('--line')],
      ['measured', t('tagged (OSM / survey)', 'bertag (OSM / survei)'), css('--dim')]];
    barChart(document.getElementById('height-bars'), parts.map(([k, label, colour]) => ({ label, value: h[k] || 0, colour })));
  };
  draw();
}
renders.push(() => renderFiles(fileState));
files.forEach((request, index) => request.then((value) => { fileState[index] = value; renderFiles(fileState); }));

// ── Live field ───────────────────────────────────────────────────────────
const base = document.getElementById('field'), top = document.getElementById('flow');
const caption = document.getElementById('live-caption');
const motion = document.getElementById('field-motion');
const refreshButton=document.getElementById('field-refresh');
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
const stageNote=document.getElementById('field-note');

// The frame keeps its place whether or not the model answered. The field is a
// square plot of the model box; when the model does not answer, the frame says
// so instead of vanishing — because a vanished frame left the reading column
// standing alone beside half a screen of nothing.
function showField(drawn, message) {
  base.hidden = !drawn;
  top.hidden = !drawn;
  if (message !== undefined) stageNote.textContent = message;
  stageNote.hidden = !!drawn;
}

function renderField([syn, fires]) {
  if (!currentResearchField(syn)) {
    showField(false, t('The pressure model did not answer. Nothing is drawn in its place.', 'Model tekanan tidak menjawab. Tidak ada yang digambar sebagai gantinya.'));
    motion.hidden = true;
    const say = () => { const m = t('The pressure model did not answer. Nothing is drawn in its place.', 'Model tekanan tidak menjawab. Tidak ada yang digambar sebagai gantinya.'); caption.textContent = m; showField(false, m); };
    renders.push(say); say(); return () => { const i=renders.indexOf(say); if(i>=0)renders.splice(i,1); };
  }
  showField(true); motion.hidden = false;
  fires=researchFires(fires);
  const now = Date.now();
  const index = syn.hours.findIndex(h => Date.parse(h) === Math.floor(now/3600000)*3600000);
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
    g.font = '30px ' + css('--font-sans'); g.textBaseline = 'middle';
    const occupied = [];
    const fixedText = (text, px, py) => { g.fillText(text, px, py); occupied.push({x:px,y:py-18,width:g.measureText(text).width,height:36}); };
    // Graticule every 2°: orientation without a coastline we do not ship.
    g.strokeStyle = css('--strong'); g.lineWidth = 1; g.fillStyle = css('--dim');
    for (let lng = Math.ceil(w / 2) * 2; lng <= e; lng += 2) { g.beginPath(); g.moveTo(x(lng), 0); g.lineTo(x(lng), H); g.stroke(); fixedText(lng + '°E', x(lng) + 6, H - 16); }
    for (let lat = Math.ceil(s / 2) * 2; lat <= n; lat += 2) { g.beginPath(); g.moveTo(0, y(lat)); g.lineTo(W, y(lat)); g.stroke(); fixedText(Math.abs(lat) + '°S', 8, y(lat) - 14); }
    // Isobars at the atlas's own interval. This page documents the atlas, so it
    // must not carry a second, drifting copy of the contour interval — it used
    // to hardcode 2 hPa while the rain lens drew 1 hPa, and the prose below
    // described the wrong number in both languages.
    const rows = gridOf(cells), p = cells.map((c) => c.mslpHpa);
    g.strokeStyle = css('--ink'); g.globalAlpha = 0.55; g.lineWidth = 1.5;
    for (const L of isobarLevels(p)) {
      for (const line of stitch(contour(rows, L))) {
        g.beginPath(); line.forEach(([lng, lat], i) => (i ? g.lineTo(x(lng), y(lat)) : g.moveTo(x(lng), y(lat)))); g.stroke();
        const mid = line[Math.floor(line.length / 2)];
        g.globalAlpha = 1; g.fillStyle = css('--dim');
        const px=x(mid[0]), py=y(mid[1]), text=String(L);
        const box=labelPosition(px,py,g.measureText(text).width+24,44,{width:W,height:H},occupied);
        if(box) { occupied.push(box); g.beginPath(); g.moveTo(px,py); g.lineTo(box.x,box.y+18); g.stroke(); g.fillText(text,box.x,box.y+18); }
        g.globalAlpha = 0.55;
      }
    }
    g.globalAlpha = 1;
    // Model cells: where the numbers actually come from.
    g.fillStyle = css('--line');
    for (const c of cells) { g.beginPath(); g.arc(x(c.lng), y(c.lat), 3, 0, Math.PI * 2); g.fill(); }
    if (low?.isLow) { g.fillStyle = css('--lacquer'); g.font = '700 44px ' + css('--font-sans'); fixedText('L', x(low.lng) - 10, y(low.lat)); g.font = '30px ' + css('--font-sans'); }
    // Fire detections inside the box, sized by radiative power.
    g.fillStyle = css('--lacquer');
    for (const f of fires?.features || []) {
      const [lng, lat] = f.geometry?.coordinates || [];
      if (!(lng >= w && lng <= e && lat >= s && lat <= n)) continue;
      const r = 2 + Math.min(Math.sqrt(Math.max(f.properties?.frp || 0, 0)) / 3, 6);
      g.beginPath(); g.arc(x(lng), y(lat), r, 0, Math.PI * 2); g.fill();
    }
    // Reserve Jakarta's label before placing time labels.
    occupied.push({x:x(JAKARTA.lng)+12,y:y(JAKARTA.lat),width:g.measureText('Jakarta').width,height:36});
    // The Jakarta parcel, with a tick every 6 hours.
    if (run?.path?.length > 1) {
      g.strokeStyle = css('--accent'); g.lineWidth = 4; g.beginPath();
      run.path.forEach(([lng, lat], i) => (i ? g.lineTo(x(lng), y(lat)) : g.moveTo(x(lng), y(lat)))); g.stroke();
      g.fillStyle = css('--accent');
      run.path.forEach(([lng, lat], i) => { if (i && i % 6 === 0) {
        const px=x(lng), py=y(lat), text='+' + i + 'h';
        g.fillRect(px - 5, py - 5, 10, 10);
        const box=labelPosition(px,py,g.measureText(text).width,36,{width:W,height:H},occupied);
        if(box) { occupied.push(box); g.beginPath(); g.moveTo(px,py); g.lineTo(box.x,box.y+18); g.lineWidth=1; g.stroke(); g.fillText(text,box.x,box.y+18); }
      } });
    }
    g.fillStyle = css('--ink'); g.fillRect(x(JAKARTA.lng) - 6, y(JAKARTA.lat) - 6, 12, 12);
    g.fillText('Jakarta', x(JAKARTA.lng) + 12, y(JAKARTA.lat) + 18);
  }

  // Particles over the base, trails fading by destination-in.
  const ctx = top.getContext('2d');
  const metresPerPx = ((e - w) / W) * 111320 * Math.cos(((n + s) / 2) * Math.PI / 180);
  const seconds = sampler ? (1.6 * metresPerPx) / sampler.maxSpeed : 0;
  let particles = [], raf = null, playing = false;
  const spawn = () => {
    for (let i = 0; i < 6; i++) { const lng = w + Math.random() * (e - w), lat = s + Math.random() * (n - s); if (sampler.sample(lng, lat)) return { lng, lat, age: 0, life: 60 + Math.random() * 80 }; }
    return null;
  };
  const colour = (speed) => (speed / sampler.maxSpeed > 0.66 ? css('--accent') : css('--ink'));
  function frame() {
    raf = null;
    if (document.hidden || !ctx || !playing || reduced()) return;
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
  const start = () => { if (!sampler) return; if (reduced() || !playing) still(); else if (raf === null && !document.hidden) raf = requestAnimationFrame(frame); };
  const motionLabel = () => {
    motion.textContent = playing ? t('Pause wind', 'Jeda angin') : t('Play wind', 'Putar angin');
    motion.setAttribute('aria-pressed', String(playing));
  };
  motion.disabled = !sampler || reduced();
  const toggleMotion = () => {
    playing = !playing; motionLabel();
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    start();
  };
  motion.addEventListener('click',toggleMotion);
  renders.push(motionLabel); motionLabel();
  const themeChanged=()=>{drawBase();if(sampler&&(!playing||reduced()))still();};
  window.addEventListener('atlas:theme',themeChanged);

  const say = () => {
    const at = new Date(syn.hours[index]).toLocaleString(lang === 'en' ? 'en-GB' : 'id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
    const parts = [
      t('Model hour', 'Jam model') + ' ' + at + ' WIB',
      t('checked ', 'diperiksa ') + new Date(syn.checkedAt).toLocaleTimeString(lang==='en'?'en-GB':'id-ID',{timeZone:'Asia/Jakarta'})+' WIB · '+t('refresh every 5 min','diperbarui tiap 5 menit'),
      winds.length + ' / ' + syn.requestedPoints + ' ' + t('cells answered', 'sel menjawab'),
      t('grid step', 'langkah kisi') + ' ' + fmt(syn.spacingKm) + ' km',
      low ? (low.isLow ? t('closed low', 'pusat rendah tertutup') : t('lowest (open, not a closed low)', 'terendah (terbuka, bukan pusat tertutup)')) + ' ' + fmt(low.mslpHpa) + ' hPa' : null,
      run ? t('Jakarta parcel', 'parsel Jakarta') + ' ' + run.hours + ' h' + (run.stopped ? ' (' + ({ 'left-field': t('left the data', 'keluar dari data'), 'forecast-ends': t('forecast ends', 'prakiraan berakhir'), 'no-wind': t('no wind cell', 'tanpa sel angin') }[run.stopped] || run.stopped) + ')' : '') : null,
      fires?.count != null ? fmt(fires.count) + ' ' + t('FIRMS detections in 24 h (region)', 'deteksi FIRMS dalam 24 jam (wilayah)') : fireRefusal ? t('Thermal detections','Deteksi termal')+' · '+refusalMessage(fireRefusal.retryAfterSeconds,t) : t('FIRMS unavailable', 'FIRMS tidak tersedia'),
      'Open-Meteo · ' + t('model estimate', 'estimasi model'),
    ];
    caption.textContent = parts.filter(Boolean).join(' · ');
    drawBase();
    if (sampler && (reduced() || !playing)) still();
  };
  renders.push(say); say(); start();
  return () => {
    playing=false;if(raf!==null)cancelAnimationFrame(raf);raf=null;
    motion.setAttribute('aria-pressed','false');motion.disabled=true;
    motion.removeEventListener('click',toggleMotion);window.removeEventListener('atlas:theme',themeChanged);
    for(const fn of [say,motionLabel]){const i=renders.indexOf(fn);if(i>=0)renders.splice(i,1);}
  };
}
let sessionStatus=null;
let httpRefusal=null,fireRefusal=null;
const statusText=state=>{
  sessionStatus=state;
  if(state==='loading'){httpRefusal=null;fireRefusal=null;}
  refreshButton.disabled=state==='loading';
  // A refused request was never measured. It is not an unavailable model, and
  // the page says which one it is.
  const refused=state==='unavailable'&&httpRefusal;
  const refusalText=refused?refusalMessage(httpRefusal.retryAfterSeconds,t):null;
  showField(false, refusalText??(state==='paused'?t('The field is paused.','Medan dijeda.'):state==='unavailable'?t('The model field is unavailable.','Medan model tidak tersedia.'):t('Loading the model field…','Memuat medan model…')));
  motion.hidden=true;
  caption.textContent=refusalText??(state==='paused'?t('View paused. Returning checks the model again before playback.', 'Tampilan dijeda. Saat kembali, model diperiksa lagi sebelum pemutaran.'):state==='unavailable'?t('Model field unavailable. Retry to check the source again.', 'Medan model tidak tersedia. Coba lagi untuk memeriksa sumber.'):t('Refreshing the model field… Last view is paused; no current field is implied.', 'Memperbarui medan model… Tampilan terakhir dijeda; tidak menyiratkan medan terkini.'));
};
const session=createResearchSession({document,
  load: signal=>Promise.all(['/api/atlas/synoptic','/api/atlas/fires'].map(url=>fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(url.endsWith('synoptic')?50000:20000)]),headers:{accept:'application/json'}}).then(r=>readJson(r)).catch(error=>{if(isRefusalError(error)&&!signal.aborted){if(url.endsWith('/synoptic')){httpRefusal=error;return null;}fireRefusal=error;}return null;}))),
  render:value=>{if(httpRefusal){statusText('unavailable');return;}sessionStatus=null;refreshButton.disabled=false;return renderField(value);},status:statusText,
});
renders.push(()=>{if(sessionStatus)statusText(sessionStatus);});
refreshButton.addEventListener('click',()=>session.refresh());
window.addEventListener('pagehide',event=>{if(!event.persisted)session.clear();});
window.addEventListener('pageshow',event=>{if(event.persisted)session.refresh();});

applyLang();
