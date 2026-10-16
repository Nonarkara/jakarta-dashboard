import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const client = read('public/green-space.js');
const server = read('src/index.ts');
const app = read('public/app.js');
const meta = JSON.parse(read('public/data/jakarta-v1/worldcover-2021-reference.json'));

// Guards run against comment-stripped code: a negative guard that matches the
// sentence stating the rule always fires, which teaches you to ignore it.
const code = client.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// ── The tile URL ──────────────────────────────────────────────────────────
const mod = await import('../public/green-space.js');
const tile = mod.ndviTile(8, 203, 132, '2026-10-15');
assert.match(tile, /VIIRS_NOAA20_NDVI_8Day/, 'the layer is the NOAA-20 NDVI product');
assert.match(tile, /GoogleMapsCompatible_Level8/, 'the tile matrix must be the one the provider declares');
assert.ok(tile.endsWith('/8/132/203.png'), `row/column order is row-then-column: ${tile}`);

// ── Classification of a transparent tile ──────────────────────────────────
// GIBS NDVI tiles are rectangular over the sea too. Transparent means "no
// observation", and must never be painted as bare ground.
assert.equal(mod.vegetationClass(0, 0, 0, 0), 'none', 'a transparent pixel is no observation');
assert.equal(mod.vegetationClass(10, 10, 10, 5), 'none', 'a nearly transparent pixel is no observation');
// Every band anchor must classify back to itself: that is the property that
// ties the reader's legend to the pixels on the map.
for (const band of mod.ndviBandSwatches()) {
  assert.equal(mod.vegetationClass(band.rgb[0], band.rgb[1], band.rgb[2], 255), band.name,
    `anchor colour must classify to its own band: ${band.name}`);
}
const NAMED = new Set(mod.ndviBandSwatches().map((b) => b.name));
for (const px of [[0, 0, 0], [255, 255, 255], [10, 90, 200], [70, 70, 70], [200, 30, 30]]) {
  const cls = mod.vegetationClass(px[0], px[1], px[2], 255);
  assert.ok(NAMED.has(cls), `opaque pixel classified to a published band: ${cls}`);
}
assert.match(client, /colormaps\/v1\.3\/MODIS_NDVI\.xml/, 'bands are cited to the provider colour map');
assert.match(client, /143 entries/, 'the colormap entry count is recorded, not assumed');

// ── The honesty law ───────────────────────────────────────────────────────
// An index, a land-cover class and a published polygon are three different
// measurements. The lens must never present them as one green-space area.
assert.match(client, /It cannot tell a forest from a lawn and it is not an area of green space/,
  'the NDVI legend must say it is an index, not an area');
assert.match(client, /never added together/,
  'the panel must state that the three sources are not summed');
assert.match(client, /not administrative DKI totals/,
  'class counts must not be presented as official DKI totals');
assert.match(client, /median one is about four metres across/,
  'the empty city view needs explaining rather than leaving the reader stuck');
assert.doesNotMatch(code, /greenSpaceHa|greenAreaHa|totalGreen|sumGreen/i,
  'no green-space area may be derived from the imagery');
assert.doesNotMatch(code, /\bnDVI\s*\*\s*/, 'NDVI must not be multiplied into an area');

// ── The dates must be the layer's own ─────────────────────────────────────
// Borrowing another product's date list requests composites the provider never
// staged, which returns a 400 tile instead of an honest "no data".
assert.match(client, /find\(\(x\) => x\.id === 'ndvi'\)/, 'the scrubber reads the NDVI product dates');
assert.doesNotMatch(client, /id === 'night-lights'/, 'never borrow another layer dates');
assert.match(server, /id: "ndvi", layer: "VIIRS_NOAA20_NDVI_8Day"/, 'NDVI is a declared product with real dates');
assert.match(server, /dateWindow: 60/, 'NDVI keeps a longer history than a daily product');
assert.match(server, /units: "NDVI \(unitless index\)"/, 'units say index, not area');

// ── The land-cover overlay is the carbon pattern ──────────────────────────
// Bake offline, ship the PNG plus its class counts, never re-derive a raster
// in the browser.
assert.match(client, /type: 'image'/, 'the land-cover layer is a pre-baked image overlay');
assert.equal(meta.display.resampling, 'nearest-neighbour 2:1 categorical display only',
  'a categorical raster must not be resampled into a smooth gradient');
assert.ok(meta.classes.some((c) => c.cells > 0), 'the legend has real classes to show');
assert.equal(meta.display.sha256.length, 64, 'the overlay carries a hash');
assert.ok(meta.periodStart.startsWith('2021') && meta.periodEnd.startsWith('2021'),
  'WorldCover is historical and must be labelled as such');
assert.match(client, /ESA WorldCover 2021/, 'the readout names the product and its year');
assert.match(client, /ndviBandSwatches\(\)/, 'the NDVI legend is built from the same anchors used to classify');
assert.match(client, /historical/, 'the historical nature is stated');

// ── Scale, zoom, lifecycle ────────────────────────────────────────────────
// The bug that started this: the polygons were real but ~4 m across, drawn at
// a city-wide zoom, so they were sub-pixel and the lens looked broken.
const greenBranch = app.slice(app.indexOf("} else if (lens === 'green')"), app.indexOf("} else if (lens === 'coverage')"));
assert.match(greenBranch, /zoom:1[0-9]\./, 'the green lens must open close enough to see the polygons');
assert.ok(!/zoom:9\./.test(greenBranch), 'zoom 9.8 was the sub-pixel regression');
assert.match(app, /greenSpaceController\?\.clear\(\)/, 'leaving the lens must drop every green layer');
assert.match(app, /import\('\.\/green-space\.js\?v='/, 'the module loads lazily with the build tag');
assert.match(client, /map\.removeLayer\(id\)/, 'layers are removable');
assert.match(client, /aria-pressed/, 'the mode buttons expose their state');

// Every layer this lens ADDS must be dropped on exit, or leaving the lens leaves
// green raster on the map for the next lens. The polygon layer is NOT this
// module's to remove: the atlas owns it and wires its own click handling.
for (const id of ['green-ndvi', 'green-cover']) {
  assert.match(client, new RegExp("'" + id + "'"), id + ' is created');
}
assert.ok(client.includes("['green-ndvi', 'green-cover'].forEach(drop)"), 'drop list covers both raster layers');
assert.match(client, /setLayoutProperty\('insight-green', 'visibility', 'none'\)/,
  'leaving the lens hides the shared polygon layer instead of removing it');
assert.doesNotMatch(client, /drop\('insight-green'\)|removeLayer\('insight-green'\)/,
  'this module must never destroy the layer it does not own');
assert.match(app, /await loadGreenGeometry\(request\)/, 'the published polygons are still added by the atlas');

console.log('PASS green space: NDVI tile/classification, the never-summed law, own dates, baked-overlay pattern and zoom scale');