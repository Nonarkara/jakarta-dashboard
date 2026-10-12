'use strict';
// Flood desk: couples live official signals (BMKG bulletins, citizen reports)
// with the dated monitoring-network, risk-reference and population assets.
// Nothing here presents a live sensor value; every block keeps source, tier
// and date, and missing live feeds stay explicit states with official links.
let floodDesk=null, floodDeskLoad=null, riskLayer=null, riskLayerLoad=null;
const SITU_CONDITIONS={'PENDANGKALAN':['Pendangkalan','Silted'],'PENCEMARAN DAN PENDANGKALAN':['Pencemaran dan pendangkalan','Polluted and silted'],'TELAH MENJADI DARATAN':['Telah menjadi daratan','Became dry land'],'MENGERING DAN MENJADI DARATAN':['Mengering dan menjadi daratan','Dried and became land']};
const floodLink=(url,label)=>'<a href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(label)+' ↗</a>';
const siagaLabel=s=>({1:['SIAGA 1','ALERT 1'],2:['SIAGA 2','ALERT 2'],3:['SIAGA 3','ALERT 3'],4:['SIAGA 4','ALERT 4']}[s.level]?.[lang==='id'?0:1]||('SIAGA '+s.level));
function loadFloodDesk(){
 if(floodDeskLoad)return floodDeskLoad;
 $('flood-network-status').textContent=t('Memuat jaringan pantauan…','Loading monitoring network…');
 floodDeskLoad=get('/data/jakarta-v1/flood-network.json?v='+DASHBOARD_BUILD).then(d=>{
  floodDesk=d?.tier==='public-reference'&&Array.isArray(d.stations)?d:null;
  window.floodDeskEvidence=floodDesk?{retrievedAt:floodDesk.retrievedAt,counts:floodDesk.counts,accessStates:floodDesk.accessStates,populationJoin:floodDesk.populationJoin,riskSummary:floodDesk.riskSummary}:null;
  renderFloodDesk();
  if(!floodDesk)floodDeskLoad=null;
 });
 return floodDeskLoad;
}
function accessState(state){
 if(!state)return '';
 return '<p class="note">'+esc(lang==='id'?state.reasonId:state.reasonEn)+'<br>'+floodLink(state.sourceUrl,t('Sumber resmi','Official source'))+' · '+t('diperiksa','checked')+' '+esc(date(state.checkedAt))+'</p>';
}
function renderFloodLive(){
 const cards=[];
 const active=(alertsData?.alerts||[]).filter(a=>!stale(a.sent,12*3600000)&&Date.parse(a.expires)>Date.now());
 cards.push('<article class="reading"><div class="reading-top"><strong>'+t('Peringatan BMKG aktif','Active BMKG warnings')+'</strong><strong>'+num(active.length)+'</strong></div><p>'+(active.length?esc(active[0].headline):t('Tidak ada peringatan aktif yang dikembalikan untuk DKI, Jawa Barat dan Banten.','No active warnings returned for DKI, West Java and Banten.'))+'</p>'+evidence('BMKG',t('buletin resmi','official bulletin'),alertsData?.publishedAt,t('Buletin','Bulletin'))+'</article>');
 const points=(weatherData?.points||[]).filter(p=>p.available);
 const rain=points.map(p=>{
  const rows=(p.forecast||[]).filter(r=>Date.parse(r.validAt)>Date.now()&&Date.parse(r.validAt)<=Date.now()+24*3600000);
  const wet=rows.filter(r=>/hujan/i.test(r.conditionId||''));
  return {name:p.name,valid:p.forecast?.[0]?.validAt,wet:wet.length,total:rows.length};
 });
 cards.push('<article class="reading"><div class="reading-top"><strong>'+t('Prakiraan resmi menyebut hujan','Official forecasts mention rain')+'</strong><strong>'+(rain.length?num(rain.filter(r=>r.wet>0).length)+'/'+num(rain.length):'—')+'</strong></div><p>'+(rain.length?rain.map(r=>esc(r.name)+' '+num(r.wet)+'/'+num(r.total)+' '+t('interval 24 jam','intervals in 24 h')).join(' · '):t('Prakiraan BMKG tidak tersedia.','BMKG forecasts unavailable.'))+'</p>'+(rain[0]?.valid?evidence('BMKG',t('prakiraan resmi','official forecast'),rain[0].valid):'')+'</article>');
 const reports=floodData;
 cards.push('<article class="reading"><div class="reading-top"><strong>'+t('Laporan banjir warga','Citizen flood reports')+'</strong><strong>'+(reports?.available?num(reports.reportCount):'—')+'</strong></div><p>'+(reports?.available?t('Laporan warga dalam satu jam terakhir; tanpa laporan bukan berarti jalan kering.','Citizen reports in the last hour; no reports does not mean dry streets.'):'—')+'</p>'+(reports?evidence('PetaBencana',t('laporan warga','crowdsourced'),reports.fetchedAt,t('Diambil','Retrieved')):'')+'</article>');
 $('flood-live').innerHTML=cards.join('');
}
function renderFloodNetwork(){
 const d=floodDesk;
 if(!d){$('flood-network-body').innerHTML=unavailable();return;}
 const c=d.counts;
 $('flood-network-status').textContent=num(c.awlrTotal)+' '+t('pos pantau air (AWLR),','water-level stations (AWLR),')+' '+num(c.arrTotal)+' '+t('pos curah hujan (ARR),','rain gauges (ARR),')+' '+num(c.pumps)+' '+t('pompa,','pumps,')+' '+num(c.gates)+' '+t('pintu air,','floodgates,')+' '+num(c.reservoirs)+' '+t('waduk/embung —','reservoirs —')+t(' tanggal pengamatan tidak diterbitkan layanan;',' observation dates not published by the service;')+' · '+t('diambil','retrieved')+' '+date(d.retrievedAt);
 const awlr=d.stations.filter(s=>s.kind==='Pos Pantau Air (AWLR)');
 const upstream=d.stations.filter(s=>!s.inRegion);
 const rivers={};
 for(const s of awlr){(rivers[s.river||t('tidak disebutkan','unspecified')]=rivers[s.river||t('tidak disebutkan','unspecified')]||[]).push(s);}
 $('flood-network-body').innerHTML=Object.entries(rivers).map(([river,rows])=>'<details class="official-project"><summary class="official-project-heading"><strong>'+esc(river)+'</strong><span class="meta">'+num(rows.length)+' '+t('pos · ambang siaga resmi','stations · official alert thresholds')+'</span></summary>'+rows.map(s=>'<dl class="official-project-fields"><div><dt>'+esc(s.name)+' · '+esc(s.city||'')+'</dt><dd>'+(s.siaga.map(b=>b.original?'<span class="siaga-band">'+siagaLabel(b)+' '+esc(b.original)+'</span>':'').filter(Boolean).join(' ')||t('ambang siaga tidak diterbitkan','thresholds not published'))+'</dd></div></dl>').join('')+'</details>').join('')
 +'<p class="note">'+t('Peta memuat ','The map holds ')+num(c.awlrInRegion)+'/'+num(c.awlrTotal)+' AWLR '+t('dan','and')+' '+num(c.arrInRegion)+'/'+num(c.arrTotal)+' ARR '+t('pos di dalam persegi peta. ','stations inside the map rectangle. ')+num(upstream.length)+' '+t('pos hulu sungai di luar peta tetap dicantumkan karena hidrologi Jakarta dimulai di hulu (','upstream river stations outside the map stay listed because Jakarta\u2019s hydrology starts upstream (')+esc(upstream.map(s=>s.name.trim()).slice(0,4).join(', '))+').'+'</p>'
 +'<p class="note">'+t('Nilai tinggi air terkini tidak ditayangkan di sini: tidak ada umpan mesin terbuka yang menerbitkannya. Ambang siaga di atas adalah referensi resmi, bukan pembacaan.','Current water-level values are not shown here: no open machine feed publishes them. The alert thresholds above are official reference, not readings.')+'</p>'
 +accessState(d.accessStates?.pantauBanjir)+accessState(d.accessStates?.petaBencanaGauges);
}
async function showRiskPolygons(code,name){
 if(!riskLayer){
  if(riskLayerLoad){$('flood-risk-status').textContent=t('Memuat poligon risiko…','Loading risk polygons…');}
  else{
   riskLayerLoad=get('/data/jakarta-v1/risk.geojson?v='+DASHBOARD_BUILD);
   $('flood-risk-status').textContent=t('Memuat poligon risiko (4,5 MB)…','Loading risk polygons (4.5 MB)…');
   riskLayer=await riskLayerLoad;
   if(!riskLayer?.features){riskLayer=null;riskLayerLoad=null;}
  }
 }
 const layer=riskLayer||await riskLayerLoad;
 if(!layer?.features){riskLayerLoad=null;$('flood-risk-status').textContent=t('Lapisan risiko tidak tersedia.','Risk layer unavailable.');return;}
 const features=layer.features.filter(f=>f.properties.kelurahanCode===code);
 if(!features.length){$('flood-risk-status').textContent=t('Tidak ada poligon untuk kelurahan ini.','No polygons for this kelurahan.');return;}
 showOverlay({type:'FeatureCollection',features},name+' · '+t('referensi risiko banjir','flood-risk reference')+' · '+date(layer.retrievedAt));
 $('flood-risk-status').textContent=num(features.length)+' '+t('poligon ditampilkan di peta;','polygons shown on the map;')+' '+t('kelas referensi, bukan banjir saat ini.','reference classes, not current flooding.');
}
function renderFloodRisk(){
 const d=floodDesk;
 if(!d){$('flood-risk-body').innerHTML=unavailable();return;}
 const rs=d.riskSummary||[];
 const dist={Berat:0,Sedang:0,Ringan:0};
 for(const r of rs)dist[r.dominantClass]=(dist[r.dominantClass]||0)+1;
 const anyBerat=rs.filter(r=>r.beratPolygons>0);
 const sumKey=(rows,k)=>rows.reduce((n,r)=>n+(r[k]||0),0);
 const top=[...anyBerat].sort((a,b)=>b.beratPolygons-a.beratPolygons).slice(0,8);
 $('flood-risk-status').textContent=num(rs.length)+' '+t('kelurahan dengan poligon risiko ·','kelurahan with risk polygons ·')+' '+num(d.counts.riskPolygons)+' '+t('poligon · kelas dominan:','polygons · dominant classes:')+' Berat '+num(dist.Berat)+' · Sedang '+num(dist.Sedang)+' · Ringan '+num(dist.Ringan)+' · '+t('tanggal pengamatan tidak diterbitkan','observation date not published');
 $('flood-risk-body').innerHTML='<p class="note">'+num(anyBerat.length)+' '+t('kelurahan memuat setidaknya satu poligon kelas Berat. Penduduk WNI (semester 2 2023) di kelurahan-kelurahan tersebut:','kelurahan contain at least one Berat-class polygon. WNI residents (semester 2 2023) in those kelurahan:')+' <strong>'+num(sumKey(anyBerat,'wni'))+'</strong> '+t('jiwa,','residents,')+' '+num(sumKey(anyBerat,'elderly60'))+' '+t('lansia 60+,','aged 60+,')+' '+num(sumKey(anyBerat,'children'))+' '+t('anak,','children,')+' '+num(sumKey(anyBerat,'households'))+' '+t('kartu keluarga. Kelas referensi, bukan banjir saat ini.','family cards. Reference classes, not current flooding.')+'</p>'
 +'<div class="result-list">'+top.map(r=>'<button class="result" data-risk-kelurahan="'+esc(r.kelurahanCode)+'"><strong>'+esc(r.kelurahan)+' · '+esc(window.CivicLanguage.admin(r.kota||'',lang))+'</strong><span>'+num(r.beratPolygons)+' Berat / '+num(r.polygons)+' '+t('poligon','polygons')+' · '+num(r.wni)+' WNI</span></button>').join('')+'</div>'
 +'<p class="meta">'+t('Sumber: Jakarta Satu (Resiko_Bencana) · Pemprov DKI (Dukcapil) · diambil','Source: Jakarta Satu (Resiko_Bencana) · Pemprov DKI (Dukcapil) · retrieved')+' '+date(d.retrievedAt)+'</p>';
}
function renderFloodSitu(){
 const d=floodDesk;
 if(!d){$('flood-situ-body').innerHTML=unavailable();return;}
 const rows=d.situ||[];
 const condLabel=c=>c==='-'?t('tidak ditentukan','unspecified'):(lang==='id'?SITU_CONDITIONS[c]?.[0]:SITU_CONDITIONS[c]?.[1])||c;
 const counts={};
 for(const s of rows)counts[s.condition]=(counts[s.condition]||0)+1;
 $('flood-situ-body').innerHTML='<p class="note">'+num(rows.length)+' '+t('situ/rawa dalam inventaris penerbit;','lakes in the publisher inventory;')+' '+Object.entries(counts).map(([k,v])=>esc(condLabel(k))+' '+num(v)).join(' · ')+'. '+t('Kondisi penerbit; bukan kapasitas retensi terukur.','Publisher condition; not a measured retention capacity.')+'</p>'
 +'<div class="result-list">'+[...rows].sort((a,b)=>(a.kota||'').localeCompare(b.kota||'')||(a.name||'').localeCompare(b.name||'')).map(s=>'<div class="result"><strong>'+esc(s.name)+'</strong><span>'+esc([s.kelurahan,s.kecamatan,s.kota].filter(Boolean).join(' · '))+' · '+num(s.areaHa,2)+' ha · '+esc(condLabel(s.condition))+'</span></div>').join('')+'</div>'
 +'<p class="meta">'+t('Sumber: Jakarta Satu (PETA_SITU) · diambil','Source: Jakarta Satu (PETA_SITU) · retrieved')+' '+date(d.retrievedAt)+'</p>'
 +accessState(d.accessStates?.tide);
}
function renderFloodDesk(){renderFloodLive();renderFloodNetwork();renderFloodRisk();renderFloodSitu();}
document.addEventListener('dashboard:language',()=>{if(floodDesk||floodDeskLoad)renderFloodDesk();});
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-risk-kelurahan]');
 if(b){const code=b.dataset.riskKelurahan;const row=floodDesk?.riskSummary?.find(r=>r.kelurahanCode===code);if(row)showRiskPolygons(code,row.kelurahan);return;}
 if(e.target.closest('[data-open="flood-dialog"]'))loadFloodDesk();
});
if($('flood-dialog').open)loadFloodDesk();
