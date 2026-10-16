// Lazy air lens module: the validated CAMS 48-hour timeline from the Worker,
// plus a user-started uniform-wind transport illustration. Every figure is
// model output; the moving marker is speed × elapsed time along one bearing —
// never a concentration, plume or smoke attribution.
export function windTransportPoint(start, windFromDeg, speedMs, elapsedS) {
  if (!Array.isArray(start) || start.length < 2 || !Number.isFinite(start[0]) || !Number.isFinite(start[1])
    || !Number.isFinite(windFromDeg) || !Number.isFinite(speedMs) || speedMs < 0
    || !Number.isFinite(elapsedS) || elapsedS < 0) return null;
  const bearing = ((windFromDeg + 180) % 360 + 360) % 360; // FROM + 180 = the direction it blows toward
  const distanceM = speedMs * elapsedS;
  const rad = Math.PI / 180;
  const phi1 = start[1] * rad, lambda1 = start[0] * rad, theta = bearing * rad, delta = distanceM / 6371000;
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
  const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
  return [((lambda2 / rad + 540) % 360 - 180), phi2 / rad];
}

// Piecewise trajectory (HYSPLIT-lite illustration): scenario hour k follows
// windHours[k] for one hour of travel. An hour with unknown wind pauses the
// marker — unknown stays unknown, never calm. Uniform winds reduce to the
// straight bearing; differing hours bend the path.
export function windTrajectoryPoint(start, windHours, elapsedS) {
  if (!Array.isArray(start) || start.length < 2 || !Number.isFinite(start[0]) || !Number.isFinite(start[1])
    || !Array.isArray(windHours) || !Number.isFinite(elapsedS) || elapsedS < 0) return null;
  const totalHours = elapsedS / 3600;
  let point = [start[0], start[1]];
  let lastWind = null, moved = 0;
  for (const hour of windHours) {
    if (moved >= totalHours) break;
    const usable = Number.isFinite(hour?.windMs) && hour.windMs >= 0 && Number.isFinite(hour?.windFromDeg);
    if (usable) {
      const step = windTransportPoint(point, hour.windFromDeg, hour.windMs, 3600);
      if (step) { point = step; lastWind = hour; }
    }
    moved += 1;
  }
  return { coordinates: point, lastWind, hours: Math.min(totalHours, windHours.length) };
}

export function createAirTimeline(map, {text: t, active, buildTag}) {
  let data = null, load = null, epoch = 0;
  let timer = null, startedAt = 0, anchor = null, hiddenListener = null, locationNode = null;
  const pending = new Set();
  async function get(path) {
    const c = new AbortController();
    const timeout = setTimeout(() => c.abort(new Error('timeout')), 12000);
    pending.add(c);
    try {
      const response = await fetch(path, { headers: { accept: 'application/json' }, signal: c.signal });
      if (!response.ok) throw new Error('source ' + response.status);
      return await response.json();
    } finally { clearTimeout(timeout); pending.delete(c); }
  }
  const el = (tag, content, cls) => { const node = document.createElement(tag); if (content !== undefined) node.textContent = content; if (cls) node.className = cls; return node; };
  const number = (n, d = 1) => Number.isFinite(n) ? n.toLocaleString(t('en-GB', 'id-ID'), { maximumFractionDigits: d }) : '—';
  const time = v => v ? new Date(v).toLocaleString(t('en-GB', 'id-ID'), { timeZone: 'Asia/Jakarta' }) + ' WIB' : t('Unknown', 'Tidak diketahui');

  function stopTransport() {
    if (timer !== null) clearInterval(timer); timer = null; startedAt = 0;
    const button = document.getElementById('air-transport-button');
    if (button) { button.textContent = t('Start transport · 1 s = 1 h, up to 6 h', 'Mulai transpor · 1 dtk = 1 jam, hingga 6 jam'); button.setAttribute('aria-pressed', 'false'); }
  }
  function clear() {
    epoch++;
    stopTransport();
    for (const c of pending) c.abort(new Error('lens closed'));
    pending.clear();
    if (hiddenListener) { document.removeEventListener('visibilitychange', hiddenListener); hiddenListener = null; }
    if (map.getLayer('air-transport-marker')) map.removeLayer('air-transport-marker');
    if (map.getSource('air-transport-marker')) map.removeSource('air-transport-marker');
    locationNode?.remove(); locationNode = null;
  }

  function transportSection(body, row) {
    const section = el('div', undefined, 'air-transport');
    section.append(el('h3', t('Wind transport · illustration', 'Transpor angin · ilustrasi')));
    const windHours = (data?.times || []).map(r => ({ windMs: r.windMs, windFromDeg: r.windFromDeg }));
    const wind = windHours.some(h => Number.isFinite(h.windMs) && Number.isFinite(h.windFromDeg));
    section.append(el('p', wind
      ? t('The marker follows each modelled hour\'s wind in turn (1 real s = 1 scenario h, up to 6 h): distance = that hour\'s speed × one hour, along its downwind bearing. An hour with unknown wind pauses the marker. No concentration, plume width or smoke attribution is computed.', 'Penanda mengikuti angin tiap jam model secara bergantian (1 dtk nyata = 1 jam skenario, hingga 6 jam): jarak = kecepatan jam itu × satu jam, pada arah turun anginnya. Jam dengan angin tidak diketahui menghentikan penanda sementara. Tidak ada konsentrasi, lebar asap atau atribusi asap yang dihitung.')
      : t('No usable wind value in the model window; the transport illustration stays unavailable rather than assume calm.', 'Tidak ada nilai angin terpakai pada jendela model; ilustrasi transpor tetap tidak tersedia daripada mengasumsikan tenang.'), 'note'));
    if (wind) {
      const start = [data.sample.lng, data.sample.lat];
      anchor = start;
      const button = el('button', t('Start transport · 1 s = 1 h, up to 6 h', 'Mulai transpor · 1 dtk = 1 jam, hingga 6 jam'));
      button.type = 'button'; button.id = 'air-transport-button'; button.setAttribute('aria-pressed', 'false');
      hiddenListener = () => { if (document.hidden) { stopTransport(); render(); } };
      document.addEventListener('visibilitychange', hiddenListener);
      button.addEventListener('click', () => {
        const myEpoch = epoch;
        if (timer !== null) { stopTransport(); return; }
        startedAt = Date.now();
        button.textContent = t('Stop wind transport', 'Hentikan transpor angin');
        button.setAttribute('aria-pressed', 'true');
        if (!map.getSource('air-transport-marker')) {
          map.addSource('air-transport-marker', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          map.addLayer({ id: 'air-transport-marker', type: 'circle', source: 'air-transport-marker', paint: { 'circle-color': '#d74841', 'circle-radius': 7, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
        }
        timer = setInterval(() => {
          if (myEpoch !== epoch) { stopTransport(); return; }
          const elapsedS = Math.min(6 * 3600, Math.max(0, Date.now() - startedAt) * 3.6);
          const step = windTrajectoryPoint(start, windHours, elapsedS);
          if (!step) { stopTransport(); return; }
          map.getSource('air-transport-marker')?.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: step.coordinates } }] });
          if (!locationNode) { locationNode = el('div', undefined, 'water-scenario-location'); document.querySelector('.atlas-map-wrap')?.append(locationNode); }
          const currentHour = windHours[Math.min(windHours.length - 1, Math.max(0, Math.floor(elapsedS / 3600)))];
          locationNode.textContent = t('marker', 'penanda') + ' · ' + step.coordinates[1].toFixed(6) + ', ' + step.coordinates[0].toFixed(6) + ' · WGS84 · ' + number(elapsedS / 3600, 1) + t(' scenario h · hour wind ', ' jam skenario · angin jam ') + (Number.isFinite(currentHour?.windMs) ? number(currentHour.windMs, 1) + ' m/s' : t('unknown', 'tidak diketahui')) + ' · '+t('1 real s = 1 scenario h','1 dtk nyata = 1 jam skenario');
          if (elapsedS >= 6 * 3600) stopTransport();
        }, 100);
      });
      section.append(button);
    }
    body.append(section);
  }

  function render(body) {
    if (!body || active() !== 'air') return;
    stopTransport();
    if (hiddenListener) { document.removeEventListener('visibilitychange',hiddenListener);hiddenListener=null; }
    body.querySelector('#air-timeline-section')?.remove();
    // Folded by default: the wind section leads the air lens and the map keeps the
    // screen (surgical-table rule). The CAMS table opens on request.
    const section = el('details', undefined, 'air-timeline');
    section.id = 'air-timeline-section';
    section.append(el('summary', t('CAMS 48-hour model timeline', 'Linimasa model CAMS 48 jam')));
    if (!data) {
      section.append(el('p', t('Loading the model timeline…', 'Memuat linimasa model…'), 'note'));
      body.append(section); return;
    }
    if (!data.available) {
      section.append(el('p', t('The model timeline is unavailable or failed validation. Nothing is shown as zero.', 'Linimasa model tidak tersedia atau gagal validasi. Tidak ada yang ditampilkan sebagai nol.'), 'note'));
      const retry=el('button',t('Retry model timeline','Coba lagi linimasa model'));retry.type='button';retry.addEventListener('click',()=>show(body));section.append(retry);
      body.append(section); return;
    }
    section.append(el('h3', t('CAMS 48-hour model timeline', 'Linimasa model CAMS 48 jam')));
    section.append(el('p', t('Model cell ', 'Sel model ') + data.grid.air.lat.toFixed(4) + ', ' + data.grid.air.lng.toFixed(4) + ' · ' + t('wind cell', 'sel angin') + ' ' + (data.grid.wind ? data.grid.wind.lat.toFixed(4) + ', ' + data.grid.wind.lng.toFixed(4) : t('unavailable','tidak tersedia')) + ' · ' + data.resolution, 'meta'));
    section.append(el('p', t('Valid ', 'Berlaku ') + time(data.firstValidAt) + ' → ' + time(data.lastValidAt) + ' · ' + t('checked', 'diperiksa') + ' ' + time(data.checkedAt) + ' · ' + t('one CAMS cell; dashboard samples may share model cells', 'satu sel CAMS; sampel dasbor dapat berbagi sel model'), 'meta'));
    const peak = data.times.reduce((best, r) => Number.isFinite(r.pm25) && r.pm25 > (best?.pm25 ?? -Infinity) ? r : best, null);
    if (peak) section.append(el('p', t('Peak PM2.5 ', 'Puncak PM2.5 ') + number(peak.pm25, 1) + ' µg/m³ · ' + time(peak.validAt), 'meta'));
    section.append(el('p',t('PM2.5, PM10 and dust: µg/m³. AOD: dimensionless. Wind: m/s and FROM degrees.', 'PM2.5, PM10 dan debu: µg/m³. AOD: tanpa satuan. Angin: m/s dan derajat arah DARI.'),'note'));
    const scroll = el('div', undefined, 'air-tl-scroll');
    const table = el('table'); table.className = 'air-tl-table';
    const head = el('tr');
    for (const label of [t('Hour (WIB)', 'Jam (WIB)'), 'PM2.5', 'PM10', t('Dust', 'Debu'), 'AOD', t('Wind m/s', 'Angin m/s'), t('From °', 'Dari °')]) head.append(el('th', label));
    table.append(head);
    for (const row of data.times) {
      const tr = el('tr');
      tr.append(el('td', new Date(row.validAt).toLocaleTimeString(t('en-GB', 'id-ID'), { timeZone: 'Asia/Jakarta', day:'2-digit', month:'2-digit',hour: '2-digit',minute:'2-digit' })));
      tr.append(el('td', number(row.pm25, 1)));
      tr.append(el('td', number(row.pm10, 1)));
      tr.append(el('td', number(row.dust, 1)));
      tr.append(el('td', number(row.aod, 2)));
      tr.append(el('td', number(row.windMs, 1)));
      tr.append(el('td', number(row.windFromDeg, 0)));
      table.append(tr);
    }
    scroll.append(table); section.append(scroll);
    section.append(el('p', t('CAMS global model: approximately 45 km cells; hourly values interpolate a native three-hourly forecast. AOD describes the atmospheric column, not surface particle concentration.', 'Model global CAMS: sel sekitar 45 km; nilai per jam menginterpolasi prakiraan asli tiga-jam. AOD menggambarkan kolom atmosfer, bukan konsentrasi partikel permukaan.'), 'note'));
    const anchorRow = data.times.find(r => Number.isFinite(r.windMs) && Number.isFinite(r.windFromDeg)) || null;
    transportSection(section, anchorRow);
    body.append(section);
  }

  function show(body) {
    clear();
    const myEpoch = epoch;
    data=null;render(body);
    load = get('/api/atlas/air-timeline')
      .then(d => { if(myEpoch === epoch) data = d; return d; })
      .catch(() => { if(myEpoch === epoch) data = {available:false}; return null; });
    load.then(() => { if (myEpoch === epoch) render(body); });
  }
  return { show, clear, render };
}
