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
function renderOfficialData(){
 const topic=$('official-topic').value;
 const file={projects:'projects.json',flood:'flood-reference.json',plans:'city-context.json'}[topic];$('official-download').href='/data/jakarta-v1/'+file;$('official-download').download='jakarta-'+file;
 ['projects','flood','plans'].forEach(k=>{$('official-'+k).hidden=k!==topic;});
 renderProjects();renderFloodReference();renderCityContext();
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
