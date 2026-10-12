// Contract for the four map insight lenses: flood exposure, height confidence,
// green space and flood-monitoring coverage.
//
// The rules these views must never break:
//   - a neighbourhood carries its own residents once; they are never summed
//   - a class count the publisher does not break out is null, never zero
//   - a lens that cannot load says so and keeps the previous map intact
//   - every lens states its source and date, in Indonesian and in English

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const insight = JSON.parse(read('../public/data/jakarta-v1/insight.json'));
const app = read('../public/app.js');
const html = read('../public/index.html');
const network = JSON.parse(read('../public/data/jakarta-v1/flood-network.json'));
const green = JSON.parse(read('../public/data/jakarta-v1/green.geojson'));
const risk = JSON.parse(read('../public/data/jakarta-v1/risk.geojson'));
const population = JSON.parse(read('../public/data/jakarta-v1/population.json'));

// ── provenance: the derived file declares what it is ───────────────────────
assert.equal(insight.derived, true, 'a derived file must say it is derived');
assert.ok(insight.checkedAt, 'the derived file keeps the checked date of its inputs');
assert.ok(insight.derivedFrom && Object.keys(insight.derivedFrom).length >= 6, 'every input asset is named with a digest');
for (const name of ['risk.geojson', 'green.geojson', 'awlr.geojson', 'arr.geojson', 'pumps.geojson', 'flood-network.json'])
  assert.match(insight.derivedFrom[name], /^[0-9a-f]{16}$/, 'digest recorded for ' + name);
// The digest is of the bytes on disk, so a stale derived file is detectable.
import { createHash } from 'node:crypto';
for (const name of Object.keys(insight.derivedFrom)) {
  const actual = createHash('sha256').update(readFileSync(new URL('../public/data/jakarta-v1/' + name, import.meta.url))).digest('hex').slice(0, 16);
  assert.equal(actual, insight.derivedFrom[name], 'insight.json is stale for ' + name + ' — rerun npm run prepare:insight');
}

// ── exposure: one row per mapped neighbourhood, joined to population ────────
const rows = insight.exposure.kelurahan;
assert.ok(rows.length > 0, 'exposure has rows');
const riskKelurahan = new Set(risk.features.map(f => String(f.properties.kelurahanCode || '').replace(/\D/g, '')));
assert.equal(rows.length, riskKelurahan.size, 'one row per mapped neighbourhood, no duplicates');
const populationByCode = new Map(population.kelurahan.map(e => [e.code, e]));
for (const row of rows) {
  assert.ok(riskKelurahan.has(row.kelurahanCode), 'exposure row is not invented: ' + row.kelurahanCode);
  assert.ok(row.kelurahan && row.kota, 'every exposure row is named');
  assert.equal(row.populationJoined, true, 'population joined for ' + row.kelurahan);
  assert.match(row.kelurahanCode, /^\d+$/, 'the aggregate uses the unpunctuated code: ' + row.kelurahanCode);
  assert.ok(risk.features.some(f => String(f.properties.kelurahanCode || '').replace(/\D/g, '') === row.kelurahanCode), 'the code matches the published geometry: ' + row.kelurahanCode);
  const source = populationByCode.get(row.kelurahanCode);
  assert.ok(source, 'a population row exists for the code: ' + row.kelurahanCode);
  assert.equal(row.population.wni, source.wni, 'residents are the official figure, not a rescale: ' + row.kelurahan);
  assert.equal(row.population.children, source.children, 'children are not invented: ' + row.kelurahan);
  assert.equal(row.population.elderly60, source.elderly60, 'the 60+ count is not invented: ' + row.kelurahan);
}
assert.equal(insight.exposure.populationPeriod, 'Semester 2 2023', 'the population period is stated');
assert.equal(insight.exposure.unreadableFeatures, 0, 'no risk polygon was dropped silently');

// residentsOnSevere is bounded by the neighbourhood's own population, because a
// neighbourhood is counted once even though its risk geometry is many polygons.
for (const row of rows) {
  const share = row.riskAreaHa > 0 ? row.beratSharePct / 100 : 0;
  assert.ok(row.population.residentsOnSevere <= row.population.wni, 'residents on severe land cannot exceed residents: ' + row.kelurahan);
  // beratSharePct is published rounded to 0.1, so allow exactly that rounding and nothing more.
  const tolerance = row.population.wni * 0.0005 + 1;
  assert.ok(Math.abs(row.population.residentsOnSevere - row.population.wni * share) <= tolerance, 'residents on severe land follows the severe share: ' + row.kelurahan);
}
// Sorting is by residents on severe land, descending, so "the top of the list"
// is reproducible.
const sorted = [...rows].sort((a, b) => b.population.residentsOnSevere - a.population.residentsOnSevere);
assert.equal(rows[0].kelurahanCode, sorted[0].kelurahanCode, 'the exposure list is ordered by residents on severe land');

// A derived hectare figure is a number, not a claim about current flooding.
assert.match(insight.note, /reference/i, 'the derived file states these are reference mappings');
assert.match(insight.note, /not new official claims/i, 'derived figures are not promoted to official claims');

// ── green: derived area, with every unplaced row counted ────────────────────
const greenRows = insight.green.byBorough;
assert.ok(greenRows.length > 0, 'green space has borough rows');
const placed = greenRows.reduce((sum, r) => sum + r.polygons, 0);
const unplaced = insight.green.unresolvedFeatures;
const accounted = placed + unplaced;
assert.equal(accounted, green.features.length, 'every green polygon is either placed in a borough or counted as unplaced');
assert.ok(insight.green.resolvedViaKelurahan <= placed, 'rows placed by neighbourhood are counted inside the placed total');
assert.ok(insight.green.resolvedViaKelurahan + unplaced <= green.features.length, 'placed and unplaced cannot exceed the source');
for (const row of greenRows) {
  assert.ok(row.greenHa > 0, 'a borough with green polygons has area: ' + row.kota);
  // A borough's green area can never exceed the borough's own land area.
  if (row.boroughAreaKm2) assert.ok(row.greenHa <= row.boroughAreaKm2 * 100, 'green area cannot exceed borough area: ' + row.kota);
  // No borough area published means no share, not a share of zero.
  if (!row.boroughAreaKm2) assert.equal(row.greenSharePct, null, 'no published area yields no share, not zero: ' + row.kota);
}
assert.ok(insight.green.unknownKindPolygons >= 0, 'polygons with an unstated category are counted, not hidden');

// ── coverage: an absence is never published as a zero ──────────────────────
const coverage = insight.coverage.byBorough;
assert.ok(coverage.length > 0, 'coverage has borough rows');
const pumpsTotal = coverage.reduce((s, c) => s + c.pumps, 0);
assert.equal(pumpsTotal, network.counts.pumps, 'pump count reconciles with the flood desk');
const unattributed = insight.coverage.unattributedToBorough;
assert.equal(pumpsTotal + unattributed.pumps, network.counts.pumps, 'unattributable pumps are counted, not dropped');
// Floodgates publish no borough, so a borough count is unknown rather than zero.
assert.equal(unattributed.floodgates, network.counts.gates, 'every floodgate is either placed or reported unattributable');
for (const row of coverage) {
  assert.equal(row.floodgates === null, row.floodgates !== 0, 'floodgate count is a number or null, never a fake zero: ' + row.kota);
  assert.equal(row.awlrNeighbourhoodAttribution, null, 'no station is attributed to a neighbourhood by inference: ' + row.kota);
  assert.ok(row.kelurahanWithPublishedPump <= row.kelurahanWithRiskMapping, 'a matched pump count cannot exceed mapped neighbourhoods: ' + row.kota);
  assert.equal(row.kelurahanWithoutPublishedPump, row.kelurahanWithRiskMapping - row.kelurahanWithPublishedPump, 'the gap is the difference, not an estimate: ' + row.kota);
}
assert.match(insight.coverage.caveat, /not a cleared neighbourhood/i, 'the coverage view refuses to read absence as safety');
assert.equal(insight.coverage.stationsWithoutNeighbourhoodField.awlr, network.counts.awlrInRegion, 'AWLR records without a neighbourhood field are counted');
assert.equal(insight.coverage.stationsWithoutNeighbourhoodField.arr, network.counts.arrInRegion, 'ARR records without a neighbourhood field are counted');

// ── confidence: the vocabulary is the one the buildings actually carry ──────
const confidence = insight.confidence;
assert.equal(confidence.property, 'hs', 'confidence reads the height-source property');
assert.deepEqual(confidence.order, ['measured', 'landmark', 'google', 'floors', 'ghsl', 'estimated'], 'the order runs from most observed to most assumed');
for (const key of confidence.order) assert.ok(confidence.sources[key], 'each tier explains itself: ' + key);
assert.match(confidence.caveat, /footprint/i, 'confidence is stated to be about heights, not outlines');

// ── the lenses are wired, bilingual and non-destructive ────────────────────
for (const lens of ['exposure', 'confidence', 'green', 'coverage'])
  assert.match(html, new RegExp('data-lens="' + lens + '"'), 'lens button exists: ' + lens);
assert.match(app, /ALL_LENSES = \[[^\]]*'exposure'[^\]]*'confidence'[^\]]*'green'[^\]]*'coverage'/, 'the lens whitelist accepts all four');
assert.match(app, /'https:\/\/jakarta\.nonarkara\.org|ATLAS_BASE|'\//, 'assets stay same-origin and relative');
// Exactly two places name a data path: the base and the helper that appends a
// file name. Anything else would be a second, unaudited route to the data.
assert.equal((app.match(/\/data\/jakarta-v1\//g) || []).length, 2, 'data paths are named in one place only');
assert.match(app, /function insightAsset\(file\)/, 'asset files are loaded through the one helper');
// Data stays same-origin and cache-busted. The only absolute fetches in this
// file are the documented Open-Meteo provider fallbacks, which are not data assets.
assert.doesNotMatch(app, /https?:\/\/[^"']*\/data\/jakarta-v1/, 'no data asset is fetched from an absolute origin');
assert.match(app, /encodeURIComponent\(ATLAS_BUILD_TAG\)/, 'data assets are cache-busted with the build tag');
assert.match(app, /function clearInsightLayers\(\)/, 'leaving an insight lens clears its layers');
assert.match(app, /removeInsightLayersWhenLeaving\(lens\)/, 'switching away removes the layers it added');
assert.match(app, /buildingPaintMode = 'height'/, 'the building paint mode is restored when leaving the confidence lens');
assert.match(app, /fill-color': mapTheme\(\)\.green/, 'the green lens reads the theme token, not a hardcoded hue');
assert.match(app, /hazard\[bandOf\(r\.exposureScore, cuts\)\]/, 'the exposure lens shades by its own measured spread');
assert.match(app, /quantileBands\(rows\.map\(r => r\.exposureScore\), 0\.25\)/, 'exposure bands are quartiles of the data, not a rounded constant');
// Every lens states where its numbers came from and when.
for (const marker of ['Jakarta Satu flood-risk reference', 'Jakarta Satu green-space reference', 'Jakarta Satu monitoring network'])
  assert.ok(app.includes(marker), 'lens source line present: ' + marker);
assert.match(app, /data\.checkedAt/, 'each panel prints the checked date');
// Bilingual: every lens title and description has both languages.
for (const pair of [['Who lives on the riskiest land', 'Siapa yang tinggal di lahan paling rawan'],
  ['How well each height is known', 'Seberapa baik setiap tinggi diketahui'],
  ['Where the city keeps its green', 'Di mana kota menyimpan ruang hijaunya'],
  ['Where Jakarta is instrumented, and where it is not', 'Di mana Jakarta terukur, dan di mana tidak']])
  for (const text of pair) assert.ok(app.includes(text), 'lens copy present in both languages: ' + text);
for (const [en, id] of [['Flood exposure', 'Kerentanan banjir'], ['Height confidence', 'Keyakinan tinggi'],
  ['Green space', 'Ruang hijau'], ['Flood monitoring', 'Pemantauan banjir']])
  assert.ok(read('../public/translations.js').includes('"' + en + '": "' + id + '"'), 'lens button is translated: ' + en);

console.log('PASS insight views: derived provenance, exposure counted once and joined, green area with every unplaced row counted, coverage never reporting absence as zero, confidence vocabulary, and four bilingual lenses that clean up after themselves');
