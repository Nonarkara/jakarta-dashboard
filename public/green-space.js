// Green-space lens: three different kinds of "green", kept apart because they
// answer different questions and none of them answers "how much park is here".
//
//   NDVI        NASA VIIRS NOAA-20 8-day normalised difference vegetation index.
//               Live and dated: a vegetation INDEX, i.e. how vigorously plants
//               are photosynthesising. It cannot tell a forest from a lawn, and
//               it is not an area.
//   Land cover  ESA WorldCover 2021 at 10 m, served as the pre-baked categorical
//               PNG the project already ships. Baking offline and overlaying is
//               the carbon.nonarkara.org pattern: never re-derive a raster in the
//               browser, ship the classified image plus its class counts.
//   Named sites The Jakarta Satu reference inventory, 5,842 polygons. Real and
//               named, but the median polygon is about four metres across, so it
//               only becomes visible when the map is close. The lens says so
//               instead of showing an empty city.
//
// Nothing here measures green space area from the imagery, and the three
// sources are never added together.

const NDVI_LAYER = 'VIIRS_NOAA20_NDVI_8Day';
const NDVI_TMS = 'GoogleMapsCompatible_Level8';
const NDVI_ZOOM = 8;
const NDVI_TILE = 256;
const NDVI_MAXZOOM = 13;

export function ndviTile(z, x, y, date) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${NDVI_LAYER}/default/${date}/${NDVI_TMS}/${z}/${y}/${x}.png`;
}

// Band anchors sampled from the provider's own colour map
// (gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_NDVI.xml, 143 entries), one per
// NDVI level. Guessing thresholds would invent a classification the provider
// does not publish; these are the colours it actually renders, so a pixel read
// back out of a tile lands in the band the reader is looking at.
const NDVI_BANDS = [
  { name: 'bare', max: 0.05, rgb: [239, 231, 232] },   // NDVI ~0.02, pale
  { name: 'low', max: 0.15, rgb: [223, 206, 194] },    // NDVI ~0.10, sand
  { name: 'moderate', max: 0.30, rgb: [176, 155, 138] }, // NDVI ~0.20, brown
  { name: 'good', max: 0.45, rgb: [164, 198, 61] },    // NDVI ~0.35, yellow-green
  { name: 'dense', max: 0.62, rgb: [86, 161, 0] },     // NDVI ~0.50, green
  { name: 'very dense', max: Infinity, rgb: [33, 120, 1] }, // NDVI ~0.70, deep green
];

// GIBS renders NDVI below 0 as a transparent fill, so an alpha test is what
// separates "no observation" from "bare ground". Painting no-data as bare would
// draw the whole Java Sea as a desert.
export function vegetationClass(r, g, b, a) {
  if (a !== undefined && a < 24) return 'none';
  const d = (rgb) => (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2;
  let best = NDVI_BANDS[0], bestD = Infinity;
  for (const band of NDVI_BANDS) {
    const dist = d(band.rgb);
    if (dist < bestD) { bestD = dist; best = band; }
  }
  return best.name;
}

export function ndviBandSwatches() {
  return NDVI_BANDS.map((band) => ({ name: band.name, rgb: band.rgb }));
}

export function createGreenSpace(map, { text: t, active, buildTag }) {
  let cover = null, dates = [], epoch = 0;
  let ndviSource = null, coverSource = null, siteLayer = null;
  let mode = 'ndvi', hiddenListener = null;

  const el = (tag, content, cls) => { const n = document.createElement(tag); if (content !== undefined) n.textContent = content; if (cls) n.className = cls; return n; };
  const number = (n, d = 1) => Number.isFinite(n) ? n.toLocaleString(t('en-GB', 'id-ID'), { maximumFractionDigits: d }) : '—';
  const anchor = () => map.getLayer('network-water-lines') ? 'network-water-lines' : undefined;
  const tag = () => (buildTag ? '?v=' + encodeURIComponent(buildTag) : '');

  async function get(path) {
    const c = new AbortController();
    const to = setTimeout(() => c.abort(new Error('timeout')), 15000);
    try {
      const r = await fetch(path, { headers: { accept: 'application/json' }, signal: c.signal });
      if (!r.ok) throw new Error('source ' + r.status);
      return await r.json();
    } finally { clearTimeout(to); }
  }

  function drop(id) {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  }

  function clear() {
    epoch++;
    // `insight-green` is owned by the atlas and carries its own click handling,
    // so this module hides it rather than removing it.
    if (map.getLayer('insight-green')) map.setLayoutProperty('insight-green', 'visibility', 'none');
    ['green-ndvi', 'green-cover'].forEach(drop);
    ndviSource = null; coverSource = null;
    if (hiddenListener) { document.removeEventListener('visibilitychange', hiddenListener); hiddenListener = null; }
  }

  // ── NDVI ────────────────────────────────────────────────────────────────
  function showNdvi(date) {
    drop('green-cover');
    if (map.getLayer('insight-green')) map.setLayoutProperty('insight-green', 'visibility', 'none');
    if (ndviSource) map.getSource('green-ndvi').setTiles([ndviTile('{z}', '{x}', '{y}', date)]);
    else {
      drop('green-ndvi');
      ndviSource = 'green-ndvi';
      map.addSource('green-ndvi', {
        type: 'raster', tiles: [ndviTile('{z}', '{x}', '{y}', date)],
        tileSize: NDVI_TILE, maxzoom: NDVI_MAXZOOM,
        attribution: 'NASA GIBS / VIIRS NOAA-20 NDVI',
      });
      map.addLayer({ id: 'green-ndvi', type: 'raster', source: 'green-ndvi', paint: { 'raster-opacity': 0.72 } }, anchor());
    }
    setReadout('ndvi', date);
  }

  // ── WorldCover classes ──────────────────────────────────────────────────
  function showCover() {
    drop('green-ndvi');
    if (map.getLayer('insight-green')) map.setLayoutProperty('insight-green', 'visibility', 'none');
    if (!cover?.display?.path || !cover.bounds) return;
    const [w, s, e, n] = cover.bounds; // [lngMin, latMin, lngMax, latMax]
    const fc = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', properties: {},
        geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
      }],
    };
    const src = {
      type: 'image',
      url: cover.display.path + tag(),
      coordinates: [[w, n], [e, n], [e, s], [w, s]],
    };
    drop('green-cover');
    coverSource = 'green-cover';
    map.addSource('green-cover', src);
    map.addLayer({ id: 'green-cover', type: 'raster', source: 'green-cover', paint: { 'raster-opacity': 0.78 } }, anchor());
    setReadout('cover', null);
  }

  // ── Named sites ─────────────────────────────────────────────────────────
  // The polygon layer already exists as `insight-green`, added by the atlas and
  // wired to its own click handling. This lens reveals it rather than adding a
  // second copy of the same 5,842 polygons.
  function showSites() {
    drop('green-ndvi');
    drop('green-cover');
    if (map.getLayer('insight-green')) {
      map.setLayoutProperty('insight-green', 'visibility', 'visible');
      map.setPaintProperty('insight-green', 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 11, 0.25, 15, 0.8]);
      setReadout('sites', null);
    } else {
      setReadout('sites-pending', null);
    }
  }

  function setReadout(kind, date) {
    const nodes = document.querySelectorAll('[data-green-readout]');
    let text = '';
    if (kind === 'ndvi') text = t('VIIRS NOAA-20 NDVI · 8-day composite · ', 'NDVI VIIRS NOAA-20 · komposit 8 hari · ') + (date || '—') + ' · ' + t('vegetation index, not an area', 'indeks vegetasi, bukan luas');
    else if (kind === 'cover') text = t('ESA WorldCover 2021 · 10 m classes · ', 'Kelas ESA WorldCover 2021 · 10 m · ') + (cover?.classes?.length ?? 0) + ' ' + t('classes', 'kelas') + ' · ' + t('historical', 'historis');
    else if (kind === 'sites') text = t('Jakarta Satu reference inventory · named sites only', 'Inventaris referensi Jakarta Satu · hanya situs bernama');
    else if (kind === 'sites-pending') text = t('Named sites: loading the published inventory…', 'Situs bernama: memuat inventaris terpublikasi…');
    nodes.forEach((n) => { n.textContent = text; });
  }

  // The legend writes into the box it is handed. Querying the document for it
  // found nothing, because the section is still detached at this point — the
  // legend silently rendered empty while everything else looked fine.
  function legend(wrap, kind) {
    if (!wrap) return;
    wrap.replaceChildren();
    const head = el('b', t('Land cover', 'Tutupan lahan'));
    if (kind === 'ndvi') {
      wrap.append(el('b', t('Vegetation index (NDVI)', 'Indeks vegetasi (NDVI)')));
      const LABELS = {
        bare: t('bare ground', 'tanah terbuka'),
        low: t('very low', 'sangat rendah'),
        moderate: t('moderate', 'sedang'),
        good: t('good cover', 'tutupan baik'),
        dense: t('dense', 'lebat'),
        'very dense': t('very dense', 'sangat lebat'),
      };
      // Swatches come from the same anchors the classifier uses, so the colour
      // beside a number is the colour on the map.
      for (const band of ndviBandSwatches()) {
        const s = el('span'); const i = el('i');
        i.style.background = 'rgb(' + band.rgb.join(',') + ')';
        s.append(i, document.createTextNode(LABELS[band.name] || band.name));
        wrap.append(s);
      }
      wrap.append(el('p', t('NDVI measures how vigorously plants are photosynthesising. It cannot tell a forest from a lawn and it is not an area of green space.', 'NDVI mengukur seberapa vigor tumbuhan berfotosintesis. Tidak dapat membedakan hutan dari rumput dan bukan luas ruang hijau.'), 'note'));
      return;
    }
    if (kind === 'cover' && cover?.classes) {
      wrap.append(head);
      for (const c of cover.classes.filter((c) => c.cells > 0)) {
        const s = el('span'); const i = el('i'); i.style.background = c.color;
        s.append(i, document.createTextNode(t(c.nameEn, c.nameId) + ' · ' + number(c.cells, 0)));
        wrap.append(s);
      }
      wrap.append(el('p', t('Counts are native 10 m cells in a mainland reference rectangle, not administrative DKI totals.',
        'Jumlah adalah sel asli 10 m pada persegi panjang referensi daratan, bukan total administratif DKI.'), 'note'));
      return;
    }
    if (kind === 'sites') {
      wrap.append(el('b', t('Named reference sites', 'Situs referensi bernama')));
      wrap.append(el('p', t('5,842 published polygons. The median one is about four metres across, so this layer is empty at city zoom by design — zoom in to about level 13 to see them. These are the published reference sites, not every park in Jakarta.',
        '5.842 poligon terpublikasi. Yang median berukuran sekitar empat meter, sehingga lapisan ini kosong pada zoom kota secara desain — perbesar ke level sekitar 13 untuk melihatnya. Ini situs referensi yang terpublikasi, bukan setiap taman di Jakarta.'), 'note'));
    }
  }

  function choose(next, body) {
    mode = next;
    document.querySelectorAll('[data-green-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.greenMode === next)));
    const box = document.getElementById('green-legend');
    if (box) legend(box, next);
    apply();
  }

  function render(body) {
    if (!body || active() !== 'green') return;
    body.querySelector('#green-section')?.remove();
    const section = el('div', undefined, 'lens-table green-space');
    section.id = 'green-section';
    section.append(el('h3', t('Three kinds of green', 'Tiga jenis ruang hijau')));

    const bar = el('div', undefined, 'crm-actions');
    for (const [key, label] of [['ndvi', t('Vegetation (live)', 'Vegetasi (langsung)')], ['cover', t('Land cover 2021', 'Tutupan lahan 2021')], ['sites', t('Named sites', 'Situs bernama')]]) {
      const b = el('button', label); b.type = 'button'; b.dataset.greenMode = key;
      b.setAttribute('aria-pressed', String(key === mode));
      b.addEventListener('click', () => choose(key, body));
      bar.append(b);
    }
    section.append(bar);

    const readout = el('p', '', 'meta'); readout.dataset.greenReadout = '1'; section.append(readout);

    if (mode === 'ndvi' && dates.length) {
      const range = el('input'); range.type = 'range'; range.min = '0'; range.max = String(dates.length - 1); range.value = '0'; range.step = '1';
      range.setAttribute('aria-label', t('NDVI composite date', 'Tanggal komposit NDVI'));
      range.addEventListener('input', () => showNdvi(dates[Number(range.value)]));
      section.append(range);
    }

    const legendBox = el('div', undefined, 'green-legend'); legendBox.id = 'green-legend';
    section.append(legendBox);
    legend(legendBox, mode);

    section.append(el('p', t('These three are never added together. An index, a land-cover class and a published polygon answer different questions, and none of them is a measured green-space area.',
      'Ketiganya tidak pernah dijumlahkan. Indeks, kelas tutupan lahan, dan poligon terpublikasi menjawab pertanyaan berbeda, dan tidak ada yang merupakan luas ruang hijau terukur.'), 'note'));
    body.append(section);
    // Apply the mode the panel is advertising. Rendering the controls without
    // putting the layer on the map is how a lens ends up showing three choices
    // and an empty view.
    apply();
  }

  function apply() {
    if (active() !== 'green') return;
    if (mode === 'ndvi') showNdvi(dates[0] || '2026-10-15');
    else if (mode === 'cover') showCover();
    else showSites();
  }

  function show(body) {
    clear();
    const myEpoch = ++epoch;
    dates = []; cover = null;
    render(body);
    get('/data/jakarta-v1/worldcover-2021-reference.json' + tag())
      .then((d) => {
        if (myEpoch !== epoch) return;
        cover = d;
        if (Array.isArray(d.classes)) render(body);
      })
      .catch(() => { if (myEpoch === epoch) render(body); });
    // Date range is discovered from the layer's own availability, not guessed:
    // an NDVI request for a date the provider does not hold returns a 400 tile.
    get('/api/atlas/environment' + tag())
      .then((env) => {
        if (myEpoch !== epoch) return;
        // The NDVI product's OWN dates. Borrowing another layer's date list
        // would request composites the provider may never have staged, which
        // comes back as a 400 tile rather than an honest "no data".
        const p = (env?.products || []).find((x) => x.id === 'ndvi');
        if (p?.dates?.length) dates = p.dates;
        if (myEpoch === epoch) render(body);
      })
      .catch(() => {});
    hiddenListener = () => { /* the NDVI layer is static per date; nothing to stop */ };
    document.addEventListener('visibilitychange', hiddenListener);
  }

  return { show, render, clear, choose };
}