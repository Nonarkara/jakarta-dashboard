// Research paper, legal basis, about: the Research dialog must read like a
// paper, state the law plainly, and introduce the builder — in both languages,
// with every figure computed from the shipped data files, never typed in.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/dashboard.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/official-data.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/dashboard.css',import.meta.url),'utf8');
const data=n=>JSON.parse(readFileSync(new URL('../public/data/jakarta-v1/'+n,import.meta.url),'utf8'));

// ── structure: three new topics, three new panes, nothing existing moved ──
for(const v of ['projects','flood','plans','paper','legal','about'])
  assert.match(html,new RegExp('<option value="'+v+'"'),'topic option exists: '+v);
for(const id of ['official-projects','official-flood','official-plans','official-paper','official-legal','official-about'])
  assert.match(html,new RegExp('<div id="'+id+'"'),'pane exists: '+id);
assert.match(html,/id="official-heading"/,'dialog heading kept for per-topic retitle');
assert.match(js,/OFFICIAL_TOPICS=\['projects','flood','plans','paper','legal','about'\]/,'topic list is single-sourced');
assert.match(js,/paper:'insight\.json'/,'paper downloads the derived records it charts');
assert.match(js,/dl\.hidden=true/,'topics without source records hide the download, not a dead link');
assert.match(js,/\$\('official-'\+k\)\.hidden=k!==topic/,'every pane hides unless selected');

// ── bilingual: each new English string carries its Indonesian ──
for(const [en,id] of [
 ['How this was built','Cara sistem ini dibuat'],['Legal basis','Dasar hukum'],['About the builder','Tentang pembuat'],
 ['Every number carries source, tier, date','Setiap angka berlabel sumber, tingkat, tanggal'],
 ['That is this dashboard\'s conservation law.','Itulah hukum konservasi dasbor ini.'],
 ['Pantau Banjir live feed, bus positions, congestion. Shown as unavailable, never as zero.','Umpan langsung Pantau Banjir, posisi bus, kemacetan. Ditampilkan sebagai tidak tersedia, bukan nol.'],
 ['Residents on severe-risk land','Penduduk di lahan risiko berat'],
 ['Risk polygons by class','Poligon risiko per kelas'],
 ['Green space by borough','Ruang hijau per kota'],
 ['Monitoring gap by borough','Kesenjangan pantauan per kota'],
 ['What is inside this build','Isi build ini'],
 ['An independent research demo. Not an official government product.','Demo riset independen. Bukan produk resmi pemerintah.'],
 ['No personal data: no reporter identities, complaint text, or photos. CRM counts are not imported. Full third-party notices ship with the source repository.','Tanpa data pribadi: tanpa identitas pelapor, isi aduan, atau foto. Angka CRM tidak diimpor. Catatan pihak ketiga lengkap menyertai repositori sumber.'],
 ['Digital Economy Promotion Agency (DEPA) of Thailand — Senior Expert in Smart City Promotion.','Digital Economy Promotion Agency (DEPA) Thailand — Senior Expert in Smart City Promotion.'],
 ['Builder of this Jakarta dashboard, dedicated to Kiki Yunita of the Jakarta Investment Agency.','Pembuat dasbor Jakarta ini, yang didedikasikan untuk Kiki Yunita dari Jakarta Investment Agency.']])
  assert.ok(html.includes('data-en="'+en+'"')&&html.includes('>'+id+'<'),'bilingual pair present: '+en);
for(const m of html.matchAll(/data-en="([^"]+)"/g)) assert.ok(m[1].trim().length>0,'no empty data-en');

// ── figures are computed from shipped data, not typed in ──
assert.match(js,/\/data\/jakarta-v1\/insight\.json\?v=/,'paper loads the derived insight records');
assert.match(js,/\/data\/jakarta-v1\/flood-network\.json\?v=/,'paper loads the flood-network records');
assert.match(js,/exposure\.kelurahan/,'exposure chart reads the derived rows');
assert.match(js,/population\?\.residentsOnSevere/,'exposure ranks by residents on severe land');
assert.match(js,/green\.byBorough/,'green chart reads the borough aggregates');
assert.match(js,/coverage\.byBorough/,'coverage chart reads the borough gap');
assert.match(js,/riskSummary/,'class mix is summed from the flood desk, not typed');
const flood=data('flood-network.json'),insight=data('insight.json');
const classes={Berat:0,Sedang:0,Ringan:0};
for(const r of flood.riskSummary)for(const k of Object.keys(classes))classes[k]+=Number(r.classes?.[k])||0;
assert.equal(classes.Berat+classes.Sedang+classes.Ringan,flood.counts.riskPolygons,'class mix reconciles with the baked total');
assert.equal(insight.exposure.kelurahan.length,flood.populationJoin.riskKelurahan,'exposure covers every mapped neighbourhood');
const gap=insight.coverage.byBorough.reduce((n,c)=>n+c.kelurahanWithoutPublishedPump,0);
const have=insight.coverage.byBorough.reduce((n,c)=>n+c.kelurahanWithPublishedPump,0);
assert.equal(gap+have,flood.populationJoin.riskKelurahan,'gap plus covered equals mapped neighbourhoods');
const greenTotal=insight.green.byBorough.reduce((n,g)=>n+(Number.isFinite(g.greenHa)?g.greenHa:0),0);
assert.ok(greenTotal>2000&&greenTotal<3000,'green total stays in the derived range, recomputed here: '+greenTotal.toFixed(1));

// ── dynamic strings go through t(), sources carry dates ──
assert.match(js,/t\('turunan bertanggal','dated derived'\)/,'derived panels are labelled derived in both languages');
assert.match(js,/paperInsight\.checkedAt/,'panels print the checked date, not a typed one');
assert.match(js,/populationPeriod/,'population period comes from the file');

// ── builder identity and contact ──
assert.match(html,/mailto:non\.ar@depa\.or\.th/,'builder email present');
assert.match(html,/https:\/\/www\.linkedin\.com\/in\/drnon\//,'builder LinkedIn present');
assert.match(html,/https:\/\/ascn\.nonarkara\.org/,'ASCN link present');
assert.match(html,/target="_blank" rel="noopener" data-en="ASCN work/,'external links open safely');
assert.match(html,/Phuket, Rayong, Chiang Mai/,'network cities named');
// Non-affiliation is stated, not implied.
assert.match(html,/Not affiliated with the Jakarta provincial government/,'non-affiliation stated in English');
assert.match(html,/Tidak berafiliasi dengan Pemerintah Provinsi DKI Jakarta/,'non-affiliation stated in Indonesian');

// ── presentation stays inside the house rules ──
assert.match(css,/\.paper-bar i\{[^}]*background:var\(--accent\)/,'bars use the one accent');
assert.ok(!/\.paper-[^{]*\{[^}]*border-radius/.test(css),'no border-radius on paper styles');
assert.ok(!/\.paper-[^{]*\{[^}]*gradient/.test(css),'no gradients on paper styles');
assert.ok(!/data-en="(delve|vibrant|showcas|pivotal|tapestry|nestled|groundbreaking)"/i.test(html),'no AI-tell adjectives in new copy');
assert.match(css,/\.paper-steps li::before\{[^}]*grid-row:1\s*\/\s*3/,'step number spans both grid rows so the note never collapses into the 2ch column');

console.log('PASS research paper: paper/legal/about panes bilingual, figures computed from shipped data, builder identity with non-affiliation, house presentation rules kept');
