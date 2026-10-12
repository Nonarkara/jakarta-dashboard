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

let paperInsight=null,paperFlood=null,paperLoad=null;
async function loadPaperData(){
 if(paperInsight&&paperFlood)return;
 if(paperLoad)return paperLoad;
 for(const id of ['paper-exposure','paper-riskmix','paper-green','paper-coverage','paper-inventory'])$(id).innerHTML='<p class="meta">'+t('Memuat tampilan turunan…','Loading the derived view…')+'</p>';
 paperLoad=Promise.all([get('/data/jakarta-v1/insight.json?v='+DASHBOARD_BUILD),get('/data/jakarta-v1/flood-network.json?v='+DASHBOARD_BUILD)]).then(([i,f])=>{
  paperInsight=i&&i.derived===true&&Array.isArray(i.exposure?.kelurahan)?i:null;
  paperFlood=f&&Array.isArray(f.riskSummary)&&f.riskSummary.length?f:null;
  window.officialPaperEvidence=paperInsight&&paperFlood?{insightGeneratedAt:paperInsight.generatedAt,checkedAt:paperInsight.checkedAt,counts:paperFlood.counts}:null;
  renderPaper();
  if(!paperInsight||!paperFlood)paperLoad=null;
 });return paperLoad;
}
function paperBars(rows){
 const max=Math.max(0,...rows.map(r=>r[2]));
 return '<div class="paper-bars">'+rows.map(r=>'<div class="paper-bar-row"><span>'+esc(r[0])+'</span><strong class="mono">'+esc(r[1])+'</strong><span class="paper-bar" aria-hidden="true"><i style="width:'+(max>0?(100*r[2]/max).toFixed(1):0)+'%"></i></span>'+(r[3]?'<span class="meta">'+esc(r[3])+'</span>':'')+'</div>').join('')+'</div>';
}
function renderPaper(){
 if($('official-topic').value!=='paper')return;
 if(!paperInsight||!paperFlood){
  for(const id of ['paper-exposure','paper-riskmix','paper-green','paper-coverage','paper-inventory'])$(id).innerHTML=unavailable();
  return;
 }
 const kelurahan=[...paperInsight.exposure.kelurahan].sort((a,b)=>(b.population?.residentsOnSevere||0)-(a.population?.residentsOnSevere||0)).slice(0,8);
 $('paper-exposure').innerHTML=paperBars(kelurahan.map(r=>[r.kelurahan||'—',num(r.population.residentsOnSevere)+' · '+num(r.beratSharePct,1)+'%',r.population.residentsOnSevere||0,(r.kota||'').replace('Kota Adm. Jakarta ','')+' · '+t('dari','of')+' '+num(r.population.wni)]))+evidence('Jakarta Satu · '+t('referensi risiko banjir','flood-risk reference'),t('turunan bertanggal','dated derived'),paperInsight.checkedAt,t('populasi','population')+' '+paperInsight.exposure.populationPeriod);
 const classes={Berat:0,Sedang:0,Ringan:0};
 for(const r of paperFlood.riskSummary)for(const k of Object.keys(classes))classes[k]+=Number(r.classes?.[k])||0;
 const total=classes.Berat+classes.Sedang+classes.Ringan;
 $('paper-riskmix').innerHTML=paperBars(Object.keys(classes).map(k=>[k,num(classes[k]),classes[k],total>0?num(100*classes[k]/total,1)+'%':null]))+evidence('Jakarta Satu · '+t('referensi risiko banjir','flood-risk reference'),t('turunan bertanggal','dated derived'),paperInsight.checkedAt,num(total)+' '+t('poligon','polygons'));
 const boroughs=[...paperInsight.green.byBorough].sort((a,b)=>b.greenHa-a.greenHa);
 $('paper-green').innerHTML=paperBars(boroughs.map(g=>[(g.kota||'').replace('Kota Adm. Jakarta ','').replace('Kepulauan Seribu',t('Kepulauan Seribu','Seribu Islands')),num(g.greenHa,1)+' ha',g.greenHa,Number.isFinite(g.greenSharePct)?num(g.greenSharePct,2)+'% '+t('luas borough','of borough area'):t('luas borough tidak dipublikasikan','no borough area published')]))+evidence('Jakarta Satu · '+t('referensi ruang hijau','green-space reference'),t('turunan bertanggal','dated derived'),paperInsight.checkedAt,t('dari geometri poligon','from polygon geometry'));
 const coverage=[...paperInsight.coverage.byBorough].sort((a,b)=>b.kelurahanWithoutPublishedPump-a.kelurahanWithoutPublishedPump);
 $('paper-coverage').innerHTML=paperBars(coverage.map(c=>[(c.kota||'').replace('Kota Adm. Jakarta ',''),num(c.kelurahanWithPublishedPump)+' / '+num(c.kelurahanWithRiskMapping),c.kelurahanWithRiskMapping,num(c.kelurahanWithoutPublishedPump)+' '+t('tanpa pompa terpublikasi','without a published pump')]))+evidence('Jakarta Satu · '+t('jaringan pantauan','monitoring network'),t('turunan bertanggal','dated derived'),paperInsight.checkedAt,t('tidak adanya stasiun terpublikasi bukan berarti aman','no published station is not clearance'));
 const greenTotal=boroughs.reduce((n,g)=>n+(Number.isFinite(g.greenHa)?g.greenHa:0),0);
 $('paper-inventory').innerHTML='<dl class="official-project-fields">'
  +'<div><dt>'+t('Dokumen rencana','Planning documents')+'</dt><dd>'+num(officialContext?.documents?.length||0)+' · '+t('lihat Laporan & visi','see Reports & vision')+'</dd></div>'
  +'<div><dt>'+t('Usulan investasi','Investment proposals')+'</dt><dd>'+num(officialProjects?.count||0)+' · '+t('diambil','retrieved')+' '+date(officialProjects?.retrievedAt)+'</dd></div>'
  +'<div><dt>'+t('Baris referensi banjir','Flood reference rows')+'</dt><dd>'+num(officialFlood?.count||0)+' → '+num(officialFlood?.rows?.length||0)+' '+t('kelompok','groups')+'</dd></div>'
  +'<div><dt>'+t('Poligon risiko banjir','Flood-risk polygons')+'</dt><dd>'+num(paperFlood.counts.riskPolygons)+' · '+num(paperFlood.populationJoin.joined)+'/'+num(paperFlood.populationJoin.riskKelurahan)+' '+t('terhubung populasi','joined to population')+'</dd></div>'
  +'<div><dt>'+t('Ruang hijau referensi','Reference green space')+'</dt><dd>'+num(Math.round(greenTotal))+' ha '+t('dihitung','computed')+'</dd></div>'
  +'<div><dt>'+t('Stasiun ISPU','ISPU stations')+'</dt><dd>'+t('lihat Cuaca & udara','see Weather & air')+'</dd></div>'
  +'</dl>';
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
