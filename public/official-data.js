'use strict';
// Dated public references load when requested; no live-availability inference.
let officialProjects=null, officialFlood=null, officialContext=null, officialLoad=null;
const sectorNames={transportation:['Transportasi','Transportation'],'sports-recreation':['Olahraga & rekreasi','Sports & recreation'],commercial:['Niaga','Commercial'],hospitality:['Hospitalitas','Hospitality'],utility:['Utilitas','Utility'],residential:['Hunian','Residential'],'waterfront-township':['Kawasan pesisir','Waterfront township'],'mixed-use-tod':['Kawasan campuran / TOD','Mixed use / TOD'],'industry-logistic':['Industri & logistik','Industry & logistics']};
const referenceText=value=>window.CivicLanguage.text(value,lang);
const referenceCost=value=>window.CivicLanguage.cost(value,lang);
const sectorLabel=s=>sectorNames[s]?.[lang==='id'?0:1]||s;
function publicLink(url,label){return '<a href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(label)+' ↗</a>';}
async function loadOfficialData(){
 if(officialLoad)return officialLoad;
 $('project-status').textContent=t('Memuat data penerbit…','Loading publisher data…');
 officialLoad=Promise.all([get('/data/jakarta-v1/projects.json?v='+DASHBOARD_BUILD),get('/data/jakarta-v1/flood-reference.json?v='+DASHBOARD_BUILD),get('/data/jakarta-v1/city-context.json?v='+DASHBOARD_BUILD)]).then(([p,f,c])=>{
  officialProjects=p?.tier==='publisher-proposal'&&Array.isArray(p.projects)?p:null;
  officialFlood=f?.tier==='annual-reference'&&Array.isArray(f.rows)?f:null;
  officialContext=c?.vision&&Array.isArray(c.documents)?c:null;
  window.officialCityEvidence={projects:officialProjects,floodReference:officialFlood,context:officialContext};renderOfficialData();
  if(!p||!f||!c)officialLoad=null;
 });return officialLoad;
}
const OFFICIAL_TOPICS=['projects','flood','plans','paper','legal','about'];
const OFFICIAL_FILES={projects:'projects.json',flood:'flood-reference.json',plans:'city-context.json',paper:'insight.json'};
const OFFICIAL_HEADINGS={projects:['Proyek, riwayat banjir & rencana kota','Projects, flood history & city strategy'],flood:['Proyek, riwayat banjir & rencana kota','Projects, flood history & city strategy'],plans:['Proyek, riwayat banjir & rencana kota','Projects, flood history & city strategy'],paper:['Cara sistem ini dibuat','How this was built'],legal:['Dasar hukum','Legal basis'],about:['Tentang pembuat','About the builder']};
function renderOfficialData(){
 const topic=$('official-topic').value;
 const head=$('official-heading'),face=OFFICIAL_HEADINGS[topic]||OFFICIAL_HEADINGS.projects;
 head.dataset.id=face[0];head.dataset.en=face[1];head.textContent=lang==='id'?face[0]:face[1];
 const file=OFFICIAL_FILES[topic],dl=$('official-download');
 if(file){dl.hidden=false;dl.href='/data/jakarta-v1/'+file;dl.download='jakarta-'+file;}else dl.hidden=true;
 OFFICIAL_TOPICS.forEach(k=>{$('official-'+k).hidden=k!==topic;});
 renderProjects();renderFloodReference();renderCityContext();renderPaper();
 if(topic==='paper')loadPaperData();
}
function renderProjects(){
 const d=officialProjects;if(!d){$('project-results').innerHTML=unavailable();return;}
 const value=$('project-sector').value;
 $('project-sector').innerHTML='<option value="all">'+t('Semua sektor','All sectors')+'</option>'+[...new Set(d.projects.map(p=>p.sector))].map(s=>'<option value="'+esc(s)+'">'+esc(sectorLabel(s))+'</option>').join('');
 if([...$('project-sector').options].some(o=>o.value===value))$('project-sector').value=value;
 const q=$('project-search').value.trim().toLocaleLowerCase(),sector=$('project-sector').value;
 const rows=d.projects.filter(p=>(sector==='all'||p.sector===sector)&&[p.name,p.location,p.sector,...(sectorNames[p.sector]||[]),window.CivicLanguage.text(p.name,'id'),window.CivicLanguage.text(p.location,'id'),window.CivicLanguage.text(p.landArea,'id')].join(' ').toLocaleLowerCase().includes(q));
 $('project-status').textContent=num(rows.length)+'/'+num(d.count)+' '+t('proyek dalam katalog','listed projects')+' · '+t('diambil','retrieved')+' '+date(d.retrievedAt)+' · '+t('tanggal pengamatan tidak diterbitkan','observation date not published');
 const expanded=new Set([...$('project-results').querySelectorAll('details[open]')].map(el=>el.dataset.projectRecord));
 $('project-results').innerHTML=rows.map(p=>'<details class="official-project" data-project-record="'+esc(p.id)+'"'+(expanded.has(p.id)?' open':'')+'><summary class="official-project-heading"><strong>'+esc(p.name)+'</strong><span class="meta">'+esc(sectorLabel(p.sector))+'</span><span>'+esc(referenceCost(p.proposedCost||'—'))+' · '+esc(referenceText(p.expectedStart||'—'))+'</span></summary>'+(p.available?'<dl class="official-project-fields"><div><dt>'+t('Biaya usulan','Proposed cost')+'</dt><dd>'+esc(referenceCost(p.proposedCost||'—'))+'</dd></div><div><dt>'+t('Rencana mulai','Planned start')+'</dt><dd>'+esc(referenceText(p.expectedStart||'—'))+'</dd></div><div><dt>'+t('Luas / cakupan rencana','Proposed area / scope')+'</dt><dd>'+esc(referenceText(p.landArea||'—'))+'</dd></div><div><dt>'+t('Lokasi penerbit','Publisher location')+'</dt><dd>'+esc(referenceText(p.location||'—'))+'</dd></div></dl>':'<p>'+t('Rincian penerbit tidak tersedia pada pemeriksaan.','Publisher detail unavailable when checked.')+'</p>')+'<div class="crm-actions">'+publicLink(p.sourceUrl,t('Profil resmi','Official profile'))+(p.coordinates?'<button type="button" data-project="'+esc(p.id)+'">'+t('Lihat titik penerbit','Show publisher point')+'</button>':'')+'</div>'+(p.coordinateWarning?'<p class="note">'+t('Koordinat sama dengan proyek lain; titik peta ditahan untuk pemeriksaan.','Coordinates duplicate another project; map point withheld for review.')+'</p>':'')+'</details>').join('')||'<p>'+t('Tidak ada proyek cocok.','No matching projects.')+'</p>';
}
function renderFloodReference(){
 const d=officialFlood;if(!d){$('flood-reference-rows').innerHTML='';$('flood-reference-status').textContent=t('Data referensi tidak tersedia.','Reference data unavailable.');return;}
 $('flood-reference-evidence').innerHTML=publicLink(d.sourceUrl,d.publisher)+' · '+esc(d.periods.join(', '))+' · '+t('file diperbarui','file updated')+' '+esc(d.fileUpdatedAt)+' · '+t('diambil','retrieved')+' '+esc(date(d.retrievedAt));
 const q=$('flood-reference-search').value.trim().toLocaleLowerCase(),rows=d.rows.filter(r=>[r.kelurahan,r.kecamatan,r.kota].join(' ').toLocaleLowerCase().includes(q));
 $('flood-reference-status').textContent=num(rows.length)+' '+t('kelurahan-periode','kelurahan-period groups')+' · '+num(rows.reduce((n,r)=>n+r.records,0))+'/'+num(d.count)+' '+t('baris referensi','reference rows');
 $('flood-reference-rows').innerHTML=rows.map(r=>'<tr><td>'+esc(r.kelurahan)+'</td><td>'+esc(r.kecamatan)+'</td><td>'+esc(r.kota)+'</td><td>'+esc(r.year)+'</td><td>'+num(r.records)+'</td></tr>').join('');
 const a=officialContext?.floodAccess;
 $('flood-access').innerHTML=a?'<h3>Pantau Banjir · '+t('sensor terkini belum tersedia','current sensors unavailable')+'</h3><p>'+esc(lang==='id'?a.reasonId:a.reasonEn)+'</p><p class="meta">'+t('Diperiksa','Checked')+': '+esc(date(a.checkedAt))+'</p>'+publicLink(a.sourceUrl,t('Periksa portal resmi','Check official portal')):'';
}
function renderCityContext(){
 const d=officialContext;if(!d){$('city-documents').innerHTML=unavailable();return;}
 $('city-facts').innerHTML=d.facts.map(f=>'<article><strong>'+esc(f.qualifier||'')+num(f.value)+'</strong><span>'+esc(lang==='id'?f.unitId:f.unitEn)+'</span><p>'+esc(lang==='id'?f.labelId:f.labelEn)+'</p><p class="meta">'+esc(f.period)+' · '+publicLink(f.sourceUrl,t('halaman','page')+' '+f.page)+'</p></article>').join('');
 const v=d.vision;
 $('global-vision').innerHTML='<h3>Jakarta Rise#20 · '+esc(v.instrument)+'</h3><p>'+esc(lang==='id'?v.summaryId:v.summaryEn)+'</p>'+publicLink(v.sourceUrl,t('Visi resmi','Official vision'))+' · '+publicLink(v.documentUrl,t('Dokumen peta jalan','Roadmap document'));
 $('city-documents').innerHTML=d.documents.map(p=>'<article class="official-project"><strong>'+esc(p.year)+' · '+esc(referenceText(p.title))+'</strong><p class="meta">'+esc(p.tier==='annual-report'?t('Laporan tahunan','Annual report'):t('Dokumen rencana','Planning document'))+'</p>'+publicLink(p.url,t('Buka dokumen penerbit','Open publisher document'))+'</article>').join('');
 $('city-context-evidence').textContent=t('Katalog diperiksa','Catalogue checked')+' '+date(d.retrievedAt)+' · '+t('Fakta laporan historis dan sasaran kebijakan dipisahkan dari data langsung.','Historical report facts and policy targets are separate from live data.');
}

let paperInsight=null,paperFlood=null,paperLoad=null,paperReferences={};
const PAPER_REFERENCES=['waterways-manifest.json','traffic-cameras-manifest.json','hydrology-reference.json','toll-cameras.json','ispu-reference.json','official-drainage-manifest.json','official-polders-manifest.json','worldcover-2021-reference.json'];
async function loadPaperData(){
 if(paperInsight&&paperFlood)return;
 if(paperLoad)return paperLoad;
 for(const id of ['paper-exposure','paper-riskmix','paper-green','paper-coverage','paper-inventory'])$(id).innerHTML='<p class="meta">'+t('Memuat tampilan turunan…','Loading the derived view…')+'</p>';
 paperLoad=Promise.all([get('/data/jakarta-v1/insight.json?v='+DASHBOARD_BUILD),get('/data/jakarta-v1/flood-network.json?v='+DASHBOARD_BUILD),...PAPER_REFERENCES.map(file=>get('/data/jakarta-v1/'+file+'?v='+DASHBOARD_BUILD))]).then(([i,f,...references])=>{
  paperReferences=Object.fromEntries(PAPER_REFERENCES.map((file,index)=>[file,references[index]]));
  paperInsight=i&&i.derived===true&&Array.isArray(i.exposure?.kelurahan)?i:null;
  paperFlood=f&&Array.isArray(f.riskSummary)&&f.riskSummary.length?f:null;
  window.officialPaperEvidence=paperInsight&&paperFlood?{insightGeneratedAt:paperInsight.generatedAt,checkedAt:paperInsight.checkedAt,counts:paperFlood.counts}:null;
  renderPaper();
  if(!paperInsight||!paperFlood)paperLoad=null;
 });return paperLoad;
}
function paperBars(rows,ceiling=null){
 const max=ceiling===null?Math.max(0,...rows.map(r=>r[2])):ceiling;
 return '<div class="paper-bars">'+rows.map(r=>'<div class="paper-bar-row"><span>'+esc(r[0])+'</span><strong class="mono">'+esc(r[1])+'</strong><span class="paper-bar" aria-hidden="true"><i style="width:'+(max>0?(100*r[2]/max).toFixed(1):0)+'%"></i></span>'+(r[3]?'<span class="meta">'+esc(r[3])+'</span>':'')+'</div>').join('')+'</div>';
}
function renderPaper(){
 if($('official-topic').value!=='paper')return;
 renderPaperInventory();
 renderPaperCatalog();
 if(!paperInsight||!paperFlood){
  for(const id of ['paper-exposure','paper-riskmix','paper-green','paper-coverage'])$(id).innerHTML=unavailable();
  return;
 }
 const kelurahan=[...paperInsight.exposure.kelurahan].sort((a,b)=>(b.population?.residentsOnSevere||0)-(a.population?.residentsOnSevere||0)).slice(0,8);
 $('paper-exposure').innerHTML='<p class="note">'+t('Proksi = penduduk kelurahan × porsi lahan risiko terpetakan pada kelas berat. Asumsi kepadatan merata; bukan jumlah warga yang terlokasi atau sedang kebanjiran.','Proxy = neighbourhood residents × severe share of mapped risk land. Assumes uniform density; not located residents or people currently flooded.')+'</p>'+paperBars(kelurahan.map(r=>[r.kelurahan||'—',num(r.population.residentsOnSevere)+' · '+num(r.beratSharePct,1)+'%',r.population.residentsOnSevere||0,(r.kota||'').replace('Kota Adm. Jakarta ','')+' · '+t('dari','of')+' '+num(r.population.wni)]))+evidence('Jakarta Satu · '+t('referensi risiko banjir','flood-risk reference'),t('turunan bertanggal','dated derived'),paperInsight.checkedAt,t('populasi','population')+' '+paperInsight.exposure.populationPeriod);
 const classes={Berat:0,Sedang:0,Ringan:0};
 for(const r of paperFlood.riskSummary)for(const k of Object.keys(classes))classes[k]+=Number(r.classes?.[k])||0;
 const total=classes.Berat+classes.Sedang+classes.Ringan;
 const classLabel=k=>({Berat:t('Berat','Heavy'),Sedang:t('Sedang','Moderate'),Ringan:t('Ringan','Light')})[k]||k;
 $('paper-riskmix').innerHTML=paperBars(Object.keys(classes).map(k=>[classLabel(k),num(classes[k]),classes[k],total>0?num(100*classes[k]/total,1)+'%':null]))+evidence('Jakarta Satu · '+t('referensi risiko banjir','flood-risk reference'),t('turunan bertanggal','dated derived'),paperInsight.checkedAt,num(total)+' '+t('poligon','polygons'));
 const boroughs=[...paperInsight.green.byBorough].sort((a,b)=>b.greenHa-a.greenHa);
 $('paper-green').innerHTML=paperBars(boroughs.map(g=>[(g.kota||'').replace('Kota Adm. Jakarta ','').replace('Kepulauan Seribu',t('Kepulauan Seribu','Seribu Islands')),num(g.greenHa,1)+' ha',g.greenHa,Number.isFinite(g.greenSharePct)?num(g.greenSharePct,2)+'% '+t('luas wilayah kota','of borough area'):t('luas wilayah kota tidak dipublikasikan','no borough area published')]))+evidence('Jakarta Satu · '+t('referensi ruang hijau','green-space reference'),t('turunan bertanggal','dated derived'),paperInsight.checkedAt,t('dari geometri poligon','from polygon geometry'));
 const coverage=[...paperInsight.coverage.byBorough].sort((a,b)=>b.kelurahanWithoutPublishedPump-a.kelurahanWithoutPublishedPump);
 $('paper-coverage').innerHTML='<p class="note">'+t('Panjang batang mengikuti porsi kelurahan terpetakan yang memiliki pompa terpublikasi; keberadaan bukan kapasitas atau kondisi operasional.','Bar length follows the share of mapped neighbourhoods with a published pump; presence is not capacity or operation.')+'</p>'+paperBars(coverage.map(c=>[(c.kota||'').replace('Kota Adm. Jakarta ',''),num(c.kelurahanWithPublishedPump)+' / '+num(c.kelurahanWithRiskMapping),c.kelurahanWithRiskMapping>0?100*c.kelurahanWithPublishedPump/c.kelurahanWithRiskMapping:0,num(c.kelurahanWithoutPublishedPump)+' '+t('tanpa pompa terpublikasi','without a published pump')]),100)+evidence('Jakarta Satu · '+t('jaringan pantauan','monitoring network'),t('turunan bertanggal','dated derived'),paperInsight.checkedAt,t('tidak adanya stasiun terpublikasi bukan berarti aman','no published station is not clearance'));
}
function renderPaperInventory(){
 const missing=t('Tidak tersedia','Unavailable');
 const counted=value=>Number.isInteger(value)&&value>=0?num(value):missing;
 const row=(id,en,value,stamp='')=>'<div><dt>'+t(id,en)+'</dt><dd>'+value+(stamp?'<span class="meta">'+stamp+'</span>':'')+'</dd></div>';
 const checked=(d,tier)=>d?esc(tier)+' · '+t('diperiksa','checked')+' '+esc(date(d.checkedAt||d.retrievedAt)):'';
 const referenceCount=(file,tier,field='count')=>{const d=paperReferences[file];return d?.tier===tier?counted(d[field]):missing;};
 const water=paperReferences['waterways-manifest.json'],cameras=paperReferences['traffic-cameras-manifest.json'],gauges=paperReferences['hydrology-reference.json'],toll=paperReferences['toll-cameras.json'],ispu=paperReferences['ispu-reference.json'],drains=paperReferences['official-drainage-manifest.json'],polders=paperReferences['official-polders-manifest.json'];
 const green=paperInsight?.green?.byBorough;
 const greenTotal=Array.isArray(green)&&green.every(g=>Number.isFinite(g.greenHa)&&g.greenHa>=0)?green.reduce((n,g)=>n+g.greenHa,0):null;
 $('paper-inventory').innerHTML='<dl class="official-project-fields">'
  +row('Dokumen rencana','Planning documents',Array.isArray(officialContext?.documents)?counted(officialContext.documents.length):missing,checked(officialContext,t('dokumen penerbit','publisher documents')))
  +row('Usulan investasi','Investment proposals',counted(officialProjects?.count),checked(officialProjects,t('usulan penerbit','publisher proposal')))
  +row('Baris referensi banjir','Flood reference rows',officialFlood?counted(officialFlood.count)+' → '+(Array.isArray(officialFlood.rows)?counted(officialFlood.rows.length):missing)+' '+t('kelompok','groups'):missing,checked(officialFlood,t('referensi tahunan','annual reference')))
  +row('Poligon risiko banjir','Flood-risk polygons',paperFlood?counted(paperFlood.counts?.riskPolygons)+' · '+counted(paperFlood.populationJoin?.joined)+'/'+counted(paperFlood.populationJoin?.riskKelurahan)+' '+t('terhubung populasi','joined to population'):missing,checked(paperInsight,t('turunan bertanggal','dated derived')))
  +row('Ruang hijau referensi','Reference green space',greenTotal===null?missing:num(Math.round(greenTotal))+' ha '+t('dihitung','computed'),checked(paperInsight,t('geometri terpublikasi','published geometry')))
  +row('Stasiun ISPU','ISPU stations',ispu?.tier==='official-monitoring-reference'&&Array.isArray(ispu.stations)?counted(ispu.stations.length):missing,checked(ispu,t('referensi pengukuran resmi','official monitoring reference'))+(Array.isArray(ispu?.stations)?' · '+t('batch terakhir','latest batches')+' '+esc([...new Set(ispu.stations.map(station=>station.latest?.period).filter(Boolean))].sort().join(', ')):''))
  +row('Fitur jalur air','Waterway features',referenceCount('waterways-manifest.json','mapped-reference'),checked(water,'OSM · '+t('referensi terpetakan','mapped reference'))+(water?.sourceAsOf?' · '+t('snapshot','snapshot')+' '+esc(date(water.sourceAsOf)):''))
  +row('Lokasi pengukur air','Water-gauge locations',Array.isArray(gauges?.stations)?counted(gauges.stations.length):missing,checked(gauges,'BBWS · '+t('katalog lokasi, bukan jumlah bacaan terkini','location catalogue, not a count of current readings')))
  +row('Referensi kamera','Camera references',referenceCount('traffic-cameras-manifest.json','public-camera-reference'),checked(cameras,t('katalog publik; ketersediaan belum diverifikasi','public catalogue; uptime unverified'))+(cameras?.catalogEditedAt?' · '+t('katalog diperbarui','catalogue edited')+' '+esc(date(cameras.catalogEditedAt)):''))
  +row('Tautan video tol publik','Public toll video links',Number.isInteger(toll?.count)&&Array.isArray(toll.streams)&&toll.count===toll.streams.length?counted(toll.count):missing,checked(toll,t('tautan penerbit; diputar atas permintaan','publisher links; played on request')))
  +row('Garis saluran mikro resmi','Official micro-drain lines',referenceCount('official-drainage-manifest.json','official-reference-geometry'),checked(drains,'DSDA · '+t('referensi geometri; tanggal sumber tidak diketahui','geometry reference; source date unknown'))+(drains?'<br>'+counted(drains.sourceRecordCount)+' '+t('rekaman sumber','source records')+' · '+counted(drains.excluded)+' '+t('ditahan','withheld'):''))
  +row('Batas polder resmi','Official polder boundaries',referenceCount('official-polders-manifest.json','official-reference-geometry'),checked(polders,'DSDA · '+t('referensi geometri; tanggal sumber tidak diketahui','geometry reference; source date unknown'))+(polders?'<br>'+counted(polders.sourceInvalidPolygonCount)+' '+t('poligon sumber bermasalah; tidak diperbaiki','source polygons with geometry issues; not repaired'):''))
  +row('Tutupan lahan WorldCover','WorldCover land cover',paperReferences['worldcover-2021-reference.json']?.tier==='satellite-classification-reference'?counted(paperReferences['worldcover-2021-reference.json'].nativeCells)+' '+t('sel asli · 2021','native cells · 2021'):missing,checked(paperReferences['worldcover-2021-reference.json'],t('klasifikasi satelit historis; persegi panjang daratan, bukan total DKI','historical satellite classification; mainland rectangle, not DKI totals')))
  +'</dl>';
}
let paperCatalog=null,paperCatalogLoad=null,paperCatalogState='idle',paperCatalogRejected=0;
const PAPER_CATALOG_STATES={'integrated':['Terintegrasi','Integrated'],'candidate':['Kandidat','Candidate'],'blocked':['Terhalang','Blocked'],'registration-required':['Perlu pendaftaran','Registration required']};
const catalogText=(record,key)=>{const value=record[key+(lang==='id'?'Id':'En')]??record[key];return typeof value==='string'?value:'';};
function catalogSource(url){return typeof url==='string'&&/^https:\/\/[^\s<>"']+$/.test(url)?url:null;}
async function loadPaperCatalog(){
 if(paperCatalog||paperCatalogLoad)return paperCatalogLoad;
 paperCatalogState='loading';renderPaperCatalog();
 paperCatalogLoad=(async()=>{try{
  const data=await get('/data/jakarta-v1/source-catalog.json?v='+DASHBOARD_BUILD);
  if(data?.schemaVersion!==1||!Array.isArray(data.records)||data.records.length>500)throw new Error('catalogue contract');
  const seen=new Set();
  const records=data.records.filter(record=>{if(!record||typeof record.id!=='string'||seen.has(record.id)||typeof record.name!=='string'||!Object.hasOwn(PAPER_CATALOG_STATES,record.status))return false;seen.add(record.id);return true;});
  paperCatalogRejected=data.records.length-records.length;paperCatalog={...data,records};paperCatalogState='ready';
 }catch{paperCatalog=null;paperCatalogState='unavailable';}finally{paperCatalogLoad=null;renderPaperCatalog();}})();
 return paperCatalogLoad;
}
function renderPaperCatalog(){
 const status=$('paper-catalog-status'),results=$('paper-catalog-results');
 $('paper-catalog-retry').hidden=paperCatalogState!=='unavailable';
 if(!paperCatalog){status.textContent=paperCatalogState==='loading'?t('Memuat katalog sumber…','Loading source catalogue…'):paperCatalogState==='unavailable'?t('Katalog tidak tersedia. Coba lagi atau unduh berkas sumber.','Catalogue unavailable. Retry or download the source file.'):t('Katalog dimuat saat daftar dibuka.','Catalogue loads when opened.');results.innerHTML='';return;}
 const q=$('paper-catalog-search').value.trim().toLocaleLowerCase(),state=$('paper-catalog-state').value;
 const rows=paperCatalog.records.filter(record=>(state==='all'||state===record.status)&&[record.id,record.name,record.nameId,record.nameEn,record.publisher,record.category,record.limitations,record.limitationsId,record.limitationsEn].filter(value=>typeof value==='string').join(' ').toLocaleLowerCase().includes(q));
 status.textContent=num(rows.length)+'/'+num(paperCatalog.records.length)+' '+t('sumber dalam katalog','catalogue sources')+(paperCatalogRejected?' · '+num(paperCatalogRejected)+' '+t('rekaman ditahan karena tidak valid atau duplikat','invalid or duplicate records withheld'):'');
 const text=value=>typeof value==='string'&&value?esc(value):t('Tidak diketahui','Unknown');
 const field=(id,en,value)=>'<div><dt>'+t(id,en)+'</dt><dd>'+text(value)+'</dd></div>';
 results.innerHTML=rows.map(record=>{
  const source=catalogSource(record.sourceUrl),name=catalogText(record,'name');
  const original=(key)=>{const translated=record[key+(lang==='id'?'Id':'En')];return typeof translated==='string'?esc(translated):typeof record[key]==='string'?'<span lang="en">'+esc(record[key])+'</span>':'';};
  return '<article class="paper-catalog-row"><h3>'+(source?publicLink(source,name):esc(name))+'</h3><p class="meta">'+esc(PAPER_CATALOG_STATES[record.status][lang==='id'?0:1])+' · '+text(record.publisher)+'</p><p>'+original('limitations')+'</p><dl class="official-project-fields">'
   +field('Periode sumber','Source period',record.dataAsOf)+field('Diperiksa, bukan waktu pengamatan','Checked, not observation time',record.checkedAt)
   +field('Tingkat data','Data tier',catalogText(record,'tier'))+field('Resolusi','Resolution',catalogText(record,'resolution'))
   +'<div><dt>'+t('Akses dan lisensi · teks sumber jika belum diterjemahkan','Access and license · source wording if untranslated')+'</dt><dd>'+original('access')+' · '+original('license')+'</dd></div>'
   +field('Aset rujukan','Reference assets',Array.isArray(record.assets)?record.assets.filter(asset=>typeof asset==='string').join(', '):null)
   +(record.assetSha256?field('SHA-256 aset','Asset SHA-256',record.assetSha256):'')+'</dl></article>';
 }).join('')||'<p>'+t('Tidak ada sumber yang cocok.','No matching sources.')+'</p>';
}
$('official-topic').addEventListener('change',renderOfficialData);
$('project-search').addEventListener('input',renderProjects);
$('project-sector').addEventListener('change',renderProjects);
$('flood-reference-search').addEventListener('input',renderFloodReference);
$('project-results').addEventListener('click',e=>{
 const b=e.target.closest('[data-project]'),p=b&&officialProjects?.projects.find(p=>p.id===b.dataset.project);
 if(!p?.coordinates)return;
 const [lng,lat]=p.coordinates;if(!Number.isFinite(lng)||!Number.isFinite(lat)||lng<106||lng>108||lat< -7||lat> -5)return;
 showOverlay({type:'FeatureCollection',features:[{type:'Feature',properties:{name:p.name},geometry:{type:'Point',coordinates:p.coordinates}}]},p.name+' · '+t('usulan · titik lokasi penerbit','proposal · publisher location point')+' · '+date(officialProjects.retrievedAt));
});
document.addEventListener('dashboard:language',renderOfficialData);
document.addEventListener('click',e=>{if(e.target.closest('[data-open="official-dialog"]'))loadOfficialData();});
if($('official-dialog').open)loadOfficialData();

$('paper-catalog').addEventListener('toggle',()=>{if($('paper-catalog').open)loadPaperCatalog();});
$('paper-catalog-retry').addEventListener('click',loadPaperCatalog);
$('paper-catalog-search').addEventListener('input',renderPaperCatalog);
$('paper-catalog-state').addEventListener('change',renderPaperCatalog);
