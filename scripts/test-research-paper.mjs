// Research paper, legal basis, about: the Research dialog must read like a
// paper, state the law plainly, and introduce the builder — in both languages,
// with every figure computed from the shipped data files, never typed in.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
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
 ['Area-weighted population proxy','Proksi penduduk berbobot luas'],
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

// ── research opens on the system explanation, with the approved voice ──
assert.match(html,/<option value="paper" selected/,'the Research dialog opens on how the system is built');
for(const [en,id] of [
 ['I built this dashboard so you can read Jakarta through its data and check what each view can actually tell you.','Saya membuat dasbor ini agar Anda bisa membaca Jakarta melalui datanya dan memeriksa apa yang benar-benar bisa dijelaskan oleh setiap tampilan.'],
 ['A water level belongs to a gauge. A forecast belongs to a time. A satellite image has a resolution. I keep those limits visible because putting them on one map does not make them the same measurement.','Tinggi air berlaku di titik pengukurnya. Prakiraan berlaku pada waktunya. Citra satelit punya batas resolusi. Saya menampilkan batas-batas itu karena menyatukannya dalam satu peta tidak membuatnya menjadi pengukuran yang sama.'],
 ['Compare the evidence. Change the assumptions. See what follows — and keep the difference clear.','Bandingkan buktinya. Ubah asumsinya. Lihat hasilnya — dan tetap bedakan keduanya.']])
 assert.ok(html.includes('data-en="'+en+'"')&&html.includes('>'+id+'</p>'),'purpose voice present bilingually: '+en.slice(0,40));
for(const state of ['Refreshing feeds','Model estimates','Scenarios','Dated reference','Unavailable'])assert.ok(html.includes('data-en="'+state+'"'),'evidence state: '+state);
assert.equal((html.match(/<h3 data-en="[^"]+">[^<]+<\/h3><p data-en=/g)||[]).length>=5,true,'five distinct evidence states rendered');

// ── charts say what they encode, in both languages ──
assert.match(js,/Berat:t\('Berat','Heavy'\)/,'risk classes translate for display while publisher identifiers stay intact');
assert.match(js,/Sedang:t\('Sedang','Moderate'\)/,'moderate class translates');
assert.match(js,/Ringan:t\('Ringan','Light'\)/,'light class translates');
assert.match(js,/100\*c\.kelurahanWithPublishedPump\/c\.kelurahanWithRiskMapping/,'the pump bar encodes the displayed coverage fraction');
for(const c of insight.coverage.byBorough){assert.ok(c.kelurahanWithPublishedPump<=c.kelurahanWithRiskMapping,'pump presence cannot exceed mapped neighbourhoods: '+c.kota);}

// Exercise the real renderer so percentage bars and missing sources cannot hide behind green string checks.
const nodes=new Map();
const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',value:id==='official-topic'?'paper':'',dataset:{},hidden:false,addEventListener(){}});return nodes.get(id);};
const context=vm.createContext({lang:'en',DASHBOARD_BUILD:'test',$:node,window:{CivicLanguage:{text:v=>v,cost:v=>v}},t:(id,en)=>context.lang==='en'?en:id,esc:v=>String(v??''),num:v=>String(v),date:v=>v||'Unavailable',evidence:()=>'',unavailable:()=>'<p>Unavailable</p>',fixtures:{insight,flood,projects:data('projects.json'),annual:data('flood-reference.json'),city:data('city-context.json'),references:Object.fromEntries(['waterways-manifest.json','traffic-cameras-manifest.json','hydrology-reference.json','toll-cameras.json','ispu-reference.json','official-drainage-manifest.json','official-polders-manifest.json'].map(file=>[file,data(file)]))}});
vm.runInContext(js.slice(0,js.indexOf("$('official-topic').addEventListener")),context);
vm.runInContext('paperInsight=fixtures.insight;paperFlood=fixtures.flood;officialProjects=fixtures.projects;officialFlood=fixtures.annual;officialContext=fixtures.city;paperReferences=fixtures.references;renderPaper();',context);
assert.match(node('paper-riskmix').innerHTML,/>Heavy</,'English renderer translates publisher classes');
const widths=[...node('paper-coverage').innerHTML.matchAll(/width:([0-9.]+)%/g)].map(m=>Number(m[1]));
const expected=[...insight.coverage.byBorough].sort((a,b)=>b.kelurahanWithoutPublishedPump-a.kelurahanWithoutPublishedPump).map(c=>Number((100*c.kelurahanWithPublishedPump/c.kelurahanWithRiskMapping).toFixed(1)));
assert.deepEqual(widths,expected,'coverage uses absolute 0–100% scale, never largest-row normalization');
for(const label of ['Waterway features','Water-gauge locations','Camera references','Public toll video links','Official micro-drain lines','Official polder boundaries'])assert.ok(node('paper-inventory').innerHTML.includes(label),'inventory renders source-backed '+label);
context.lang='id';vm.runInContext('renderPaper();',context);
assert.match(node('paper-riskmix').innerHTML,/>Berat</,'Indonesian renderer restores publisher classes');
assert.ok(node('paper-inventory').innerHTML.includes('Fitur jalur air'),'inventory changes language');
context.lang='en';vm.runInContext('officialContext=null;officialProjects=null;officialFlood=null;paperInsight=null;paperFlood=null;paperReferences={};renderPaper();',context);
assert.equal((node('paper-inventory').innerHTML.match(/<dd>Unavailable/g)||[]).length,12,'twelve missing inventory sources remain unavailable instead of fabricated zero');
assert.equal(node('paper-exposure').innerHTML,'<p>Unavailable</p>','missing chart data has an explicit state');
vm.runInContext("paperReferences={'waterways-manifest.json':fixtures.references['waterways-manifest.json']};renderPaper();",context);
assert.ok(node('paper-inventory').innerHTML.includes('<dd>'+data('waterways-manifest.json').count),'available reference inventory survives unavailable chart feeds');
for(const format of ['json','csv'])assert.ok(html.includes('/data/jakarta-v1/source-catalog.'+format),'source catalogue download '+format);
for(const source of ['BBWS Ciliwung Cisadane','JAXA / EORC','Bina Marga / Jasa Marga','hls.js'])assert.ok(html.includes(source),'legal attribution retained: '+source);

// Manifest-specific inventory counts and defects are derived, not hand-entered.
vm.runInContext('paperReferences=fixtures.references;renderPaperInventory();',context);
const drainage=data('official-drainage-manifest.json'),polders=data('official-polders-manifest.json');
for(const value of [drainage.count,drainage.sourceRecordCount,drainage.excluded,polders.count])assert.ok(node('paper-inventory').innerHTML.includes(String(value)),'inventory reflects manifest count '+value);
assert.ok(node('paper-inventory').innerHTML.includes(polders.sourceInvalidPolygonCount+' source polygons with geometry issues; not repaired'),'unrepaired publisher defects stay visible');
assert.ok(node('paper-inventory').innerHTML.includes('source date unknown'),'retrieval never becomes a fabricated source epoch');
assert.ok(html.includes('an evidence selection')&&html.includes('pilihan bukti'),'export described as evidence selection in both languages');

// The public coverage ledger is genuinely on demand, searchable, bilingual and retryable.
let catalogueRequests=0;
const sourceCatalogue=data('source-catalog.json');
const first=sourceCatalogue.records[0];
const ledgerFixture={...sourceCatalogue,records:[{...first,nameId:'Rute terjadwal',nameEn:'Scheduled routes',limitationsId:'Referensi jadwal, bukan posisi bus.'},{...first},{id:'invalid',name:'Invalid status',status:'__proto__'},{id:'unsafe-link',name:'Untrusted link',status:'candidate',sourceUrl:'javascript:alert(1)',limitations:'No executable URL allowed.'}]};
node('paper-catalog-state').value='all';
context.get=async()=>{catalogueRequests++;return ledgerFixture;};
vm.runInContext('renderPaperCatalog();',context);
assert.equal(catalogueRequests,0,'closed/unloaded ledger never fetches on paper rendering');
await Promise.all([vm.runInContext('loadPaperCatalog()',context),vm.runInContext('loadPaperCatalog()',context)]);
assert.equal(catalogueRequests,1,'concurrent opening/search uses one catalogue request');
assert.ok(node('paper-catalog-status').textContent.includes('2/2'),'duplicate and unsupported status records are withheld');
assert.ok(!node('paper-catalog-results').innerHTML.includes('javascript:'),'unsafe source URLs never become links');
node('paper-catalog-state').value='candidate';vm.runInContext('renderPaperCatalog();',context);
assert.ok(node('paper-catalog-results').innerHTML.includes('Untrusted link'),'candidate filtering works');
assert.ok(!node('paper-catalog-results').innerHTML.includes('Scheduled routes'),'filter excludes integrated references');
node('paper-catalog-state').value='all';node('paper-catalog-search').value='Rute terjadwal';context.lang='id';vm.runInContext('renderPaperCatalog();',context);
assert.ok(node('paper-catalog-results').innerHTML.includes('Rute terjadwal'),'search indexes both native names');
assert.ok(node('paper-catalog-results').innerHTML.includes('Referensi jadwal, bukan posisi bus.'),'native limitation rendered');
context.lang='en';node('paper-catalog-search').value='no possible source';vm.runInContext('renderPaperCatalog();',context);
assert.match(node('paper-catalog-results').innerHTML,/No matching sources/,'search has an explicit empty state');
context.get=async()=>({schemaVersion:1,records:null});vm.runInContext('paperCatalog=null;',context);await vm.runInContext('loadPaperCatalog()',context);
assert.equal(node('paper-catalog-retry').hidden,false,'malformed source has a retry action');
assert.match(node('paper-catalog-status').textContent,/Catalogue unavailable/,'malformed source is never called zero coverage');
context.get=async()=>({schemaVersion:1,records:[]});await vm.runInContext('loadPaperCatalog()',context);
assert.equal(node('paper-catalog-retry').hidden,true,'successful retry clears failure');
assert.match(node('paper-catalog-status').textContent,/0\/0/,'valid empty catalogue differs from unavailable');
for(const heading of ['What this digital twin represents','Scale, time and water datums','Combined views and computed relationships','Around here · scope and distance','Reproduce and inspect the evidence','Official drains and polder boundaries','Find mapped places and export evidence'])assert.ok(html.includes('data-en="'+heading+'"'),'bilingual method disclosure: '+heading);
assert.ok(!/<details id="paper-catalog"[^>]*\bopen\b/.test(html),'source ledger occupies space only on request');
assert.ok(html.includes('5 km')&&html.includes('12-second')&&html.includes('12 detik'),'Around here exact scope and loading deadline remain stated');

console.log('PASS research paper: paper/legal/about panes bilingual, figures computed from shipped data, builder identity with non-affiliation, house presentation rules kept');
