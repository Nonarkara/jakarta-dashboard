'use strict';
const DASHBOARD_BUILD = 'jakarta-atlas-20261011-1791703908-bfcd3fe';
const CRM_MONTHLY_URL = 'https://datastudio.google.com/embed/reporting/d7d87175-bfa2-4067-bf4d-42e8b996da11/page/27A2C';
let crmViewerOpened = false;
const $ = id => document.getElementById(id);
let lang = 'id', weatherData=null, airData=null, alertsData=null, quakeData=null, floodData=null, transit=null, civic=null;
let chosenRoute=null, routeDetail=null, civicData={}, selectedOverlay=null, mapReady=false, refreshId=0;
try {const q=new URLSearchParams(location.search).get('lang');lang=['id','en'].includes(q)?q:localStorage.getItem('jakarta-dashboard-lang')==='en'?'en':'id';}catch{} // axiom-audit-ignore honesty -- Optional local preference persistence; current controls and source values remain available with explicit defaults.
const t=(id,en)=>lang==='id'?id:en;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(n,d=0)=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString(lang==='id'?'id-ID':'en-GB',{maximumFractionDigits:d}):'—';
const date=(v)=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString(lang==='id'?'id-ID':'en-GB',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'})+' WIB':t('Waktu tidak tersedia','Time unavailable');
const stale=(v,age)=>!v||!Number.isFinite(Date.parse(v))||Date.now()-Date.parse(v)>age||Date.parse(v)>Date.now()+300000;
const unavailable=()=>'<p class="note">'+t('Data tidak tersedia atau tidak lolos pemeriksaan.','Data unavailable or did not pass validation.')+'</p>';
const evidence=(source,tier,stamp,label)=>'<p class="meta">'+esc(source)+' · '+esc(tier)+'<br>'+esc(label||t('Berlaku','Valid'))+': '+esc(date(stamp))+'</p>';
function send(message){$('city-map').contentWindow?.postMessage(message,location.origin);}
function showOverlay(data,label){selectedOverlay={data,label};$('selection-status').textContent=label;send({type:'atlas:dashboardOverlay',data});}
async function get(path){
 try{const r=await fetch(path,{signal:AbortSignal.timeout(25000)});const d=await r.json();return d;}catch{return null;}
}
function applyLanguage(){
 document.documentElement.lang=lang;$('language').value=lang;
 document.querySelectorAll('[data-en]').forEach(el=>{if(!el.dataset.id)el.dataset.id=el.textContent;el.textContent=lang==='en'?el.dataset.en:el.dataset.id;});
 document.title=t('Pantau Jakarta','Jakarta city watch');
 $('city-map').title=t('Atlas 3D Jakarta','Jakarta 3D atlas');
 document.querySelector('.sections').setAttribute('aria-label',t('Navigasi bagian','Section navigation'));
 send({type:'atlas:setLanguage',language:lang});renderWeather();renderAir();renderAlerts();renderQuake();renderFlood();renderTransit();renderCivic();renderSources();renderCrmViewerStatus();clock();
 $('release').textContent=DASHBOARD_BUILD;
}
function renderWeather(){
 const points=weatherData?.points?.filter(p=>p.available)||[];
 $('weather-summary').innerHTML=points.length?points.map(p=>{const row=p.forecast.find(r=>Date.parse(r.validAt)>=Date.now())||p.forecast.at(-1);return '<div class="reading"><div class="reading-top"><strong>'+esc(p.name)+'</strong><strong>'+num(row.temperatureC)+' °C</strong></div><p>'+esc(p.kota)+' · '+esc(lang==='id'?row.conditionId:row.conditionEn)+'</p>'+evidence('BMKG',t('prakiraan resmi','official forecast'),row.validAt)+'<p>'+t('Terbit','Issued')+': '+esc(date(row.issuedAt))+'</p></div>';}).join(''):unavailable();
 const value=$('forecast-location').value;
 $('forecast-location').innerHTML=points.map(p=>'<option value="'+esc(p.code)+'">'+esc(p.name+' · '+p.kota)+'</option>').join('');
 if(points.some(p=>p.code===value))$('forecast-location').value=value;
 renderForecast();
}
function renderForecast(){
 const p=weatherData?.points?.find(p=>p.code===$('forecast-location').value&&p.available);
 if(!p){$('forecast-chart').innerHTML=unavailable();$('forecast-table').innerHTML='';return;}
 const rows=p.forecast;
 $('forecast-caption').textContent='BMKG · '+p.name+' · '+t('terbit','issued')+' '+date(p.issuedAt);
 $('forecast-chart').innerHTML='<p class="chart-title">'+t('Suhu prakiraan 24 jam ke depan · °C · sumbu 0–50 °C','Forecast temperature for the next 24 hours · °C · axis 0–50 °C')+'</p><div class="forecast-bars" role="img" aria-label="'+esc(t('Grafik suhu prakiraan; rincian lengkap pada tabel di bawah','Forecast temperature chart; full details in the table below'))+'">'+rows.filter(r=>Date.parse(r.validAt)>=Date.now()).slice(0,8).map(r=>'<div class="forecast-bar"><span>'+num(r.temperatureC)+'°</span><i style="--height:'+Math.max(0,(r.temperatureC??0)*2)+'px"></i><span>'+esc(new Date(r.validAt).toLocaleTimeString('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'}))+'</span></div>').join('')+'</div>';
 $('forecast-table').innerHTML=rows.map(r=>'<tr><td>'+esc(date(r.validAt))+'</td><td>'+esc(lang==='id'?r.conditionId:r.conditionEn)+'</td><td>'+num(r.temperatureC)+' °C</td><td>'+num(r.humidityPct)+'%</td><td>'+num(r.windKph,1)+' km/h '+esc(r.windDirection||'')+'</td><td>'+num(r.cloudPct)+'%</td></tr>').join('');
}
function renderAir(){
 const rows=Array.isArray(airData)?airData:[];
 $('air-summary').innerHTML=rows.length?rows.map(p=>'<div class="reading"><div class="reading-top"><span>'+esc(lang==='id'?p.label_id:p.label)+'</span><strong>'+num(p.aqi)+' US AQI</strong></div><p>PM2.5 '+num(p.pm25,1)+' µg/m³ · '+esc(stale(p.observedAt,3*3600000)?t('kedaluwarsa','stale'):t('perkiraan model','model estimate'))+'</p>'+evidence('CAMS / Open-Meteo',t('model','modeled'),p.observedAt)+'</div>').join(''):unavailable();
}
function renderAlerts(){
 const d=alertsData;
 if(!d){$('alerts').innerHTML=unavailable();return;}
 const active=(d.alerts||[]).filter(a=>!stale(a.sent,12*3600000)&&Date.parse(a.expires)>Date.now());
 $('alerts').innerHTML=(!d.available?unavailable():'')+(active.length?active.map(a=>'<article class="warning"><h3>'+esc(a.headline)+'</h3><p>'+esc(a.description)+'</p><p>'+esc(a.instruction)+'</p><p class="meta">'+esc([a.severity,a.urgency,a.certainty].filter(Boolean).join(' · '))+'<br>'+t('Berakhir','Expires')+': '+esc(date(a.expires))+'</p><a href="'+esc(a.sourceUrl)+'" target="_blank" rel="noopener">BMKG CAP ↗</a><button class="alert-map" data-alert="'+esc(a.id)+'">'+t('Lihat wilayah','Show affected area')+'</button></article>').join(''):d.available?'<p>'+t('Tidak ada peringatan aktif yang dikembalikan untuk DKI, Jawa Barat dan Banten.','No active warnings returned for DKI, West Java and Banten.')+'</p>':'')+evidence('BMKG',t('buletin resmi','official bulletin'),d.publishedAt,t('Buletin','Bulletin'))+'<a href="https://www.bmkg.go.id/cuaca/peringatan-dini-cuaca" target="_blank" rel="noopener">'+t('Periksa BMKG ↗','Check BMKG ↗')+'</a>';
}
function renderFlood(){
 const d=floodData;
 $('flood-reports').innerHTML=d?.available?'<strong>'+num(d.reportCount)+' '+t('laporan dalam satu jam terakhir','reports in the last hour')+'</strong><p class="note">'+t('Tidak ada laporan bukan berarti jalan kering. Cakupan laporan warga tidak merata.','No reports does not mean dry streets. Citizen-report coverage is uneven.')+'</p>'+evidence('PetaBencana',t('laporan warga','crowdsourced'),d.fetchedAt,t('Diambil','Retrieved'))+'<a href="https://petabencana.id/" target="_blank" rel="noopener">PetaBencana ↗</a>':unavailable();
}
function renderQuake(){
 const d=quakeData,q=d?.event;
 $('earthquake').innerHTML=q?'<strong>M '+num(q.magnitude,1)+' · '+num(q.depthKm)+' km</strong><p>'+esc(q.region)+'</p><p>'+esc(q.felt)+'</p>'+evidence('BMKG',t('kejadian resmi · Indonesia','official event · Indonesia'),q.observedAt,t('Pengamatan','Observed'))+'<p class="note">'+t('Kejadian terakhir di Indonesia; belum tentu dekat Jakarta.','Latest event in Indonesia; may be far from Jakarta.')+'</p>':unavailable();
}
function renderTransit(){
 if(!transit){$('route-results').innerHTML=unavailable();return;}
 $('transit-count').textContent=num(transit.routeCount)+' '+t('rute','routes');
 $('transit-evidence').textContent='PT Transportasi Jakarta · CC BY 4.0 · '+t('diambil','retrieved')+' '+date(transit.retrievedAt)+' · '+t('rentang kalender arsip','archive calendar range')+' '+transit.calendarFrom+'–'+transit.calendarTo;
 const q=$('route-search').value.trim().toLocaleLowerCase(),rows=transit.routes.filter(r=>(r.short+' '+r.name).toLocaleLowerCase().includes(q));
 $('route-results-status').textContent=num(rows.length)+' '+t('rute ditemukan; menampilkan hingga 30','matching routes; showing up to 30');
 $('route-results').innerHTML=rows.slice(0,30).map(r=>'<button class="result route-result" data-route="'+esc(r.id)+'" aria-pressed="'+(r.id===chosenRoute)+'"><strong>'+esc(r.short)+' · '+esc(r.name)+'</strong><span>'+num(r.stopCount)+' '+t('halte dalam perjalanan perwakilan','stops in representative trips')+'</span></button>').join('')||'<p>'+t('Tidak ditemukan. Coba nomor rute atau tujuan lain.','No matches. Try another route number or destination.')+'</p>';
 renderRouteDetail();
}
function renderRouteDetail(){
 if(!routeDetail){$('route-detail').innerHTML='';return;}
 $('route-detail').innerHTML='<h3>'+esc(routeDetail.short+' · '+routeDetail.name)+'</h3>'+routeDetail.directions.map((d,i)=>'<details'+(i===0?' open':'')+'><summary>'+esc(d.headsign||t('Arah','Direction')+' '+(i+1))+'</summary><p class="note">'+(d.frequencies.length?d.frequencies.map(f=>esc(f.start+'–'+f.end)+' · '+num(f.seconds/60,1)+' '+t('menit selang terjadwal','minutes scheduled headway')).join('<br>'):t('Selang waktu tidak tersedia untuk perjalanan ini.','No frequency record for this representative trip.'))+'</p><ol class="stop-list">'+d.stops.map(s=>'<li><button class="stop-result" data-lng="'+s.lng+'" data-lat="'+s.lat+'" data-name="'+esc(s.name)+'">'+esc(s.name)+'</button></li>').join('')+'</ol></details>').join('');
}
async function selectRoute(id){
 const r=transit?.routes.find(r=>r.id===id);if(!r)return;
 chosenRoute=id;routeDetail=null;$('route-detail').innerHTML='<p>'+t('Memuat rute…','Loading route…')+'</p>';
 const data=await get(r.detail+'?v='+DASHBOARD_BUILD);if(chosenRoute!==id)return;
 if(!data?.geometry){$('route-detail').innerHTML=unavailable();return;}
 routeDetail=data;renderTransit();showOverlay(data.geometry,'TransJakarta '+r.short+' · '+r.name+' · '+t('jalur terjadwal','scheduled alignment'));
}
async function loadCivic(){
 const kind=$('civic-kind').value;
 if(!civicData[kind])civicData[kind]=await get('/data/jakarta-v1/'+kind+'.geojson?v='+DASHBOARD_BUILD);
 renderCivic();
}
function renderCivic(){
 const kind=$('civic-kind').value,d=civicData[kind];
 if(!d?.features){$('civic-results').innerHTML=unavailable();return;}
 const q=$('civic-search').value.toLocaleLowerCase().trim();
 const rows=d.features.filter(f=>[f.properties.name,f.properties.kelurahan,f.properties.kecamatan,f.properties.kota].join(' ').toLocaleLowerCase().includes(q));
 $('civic-results-status').textContent=num(rows.length)+' '+t('rekaman cocok; menampilkan hingga 30','matching records; showing up to 30');
 $('civic-results').innerHTML=rows.slice(0,30).map(f=>{const p=f.properties,[lng,lat]=f.geometry.coordinates;return '<button class="result civic-result" data-lng="'+lng+'" data-lat="'+lat+'" data-name="'+esc(p.name)+'"><strong>'+esc(p.name)+'</strong><span>'+esc([p.kind,p.kelurahan,p.kecamatan].filter(Boolean).join(' · '))+'</span></button>';}).join('')||'<p>'+t('Tidak ditemukan. Coba kelurahan lain.','No matches. Try another kelurahan.')+'</p>';
 $('civic-evidence').textContent=d.publisher+' · '+t('referensi publik; tanggal pengamatan tidak diterbitkan','public reference; observation date not published')+' · '+t('diambil','retrieved')+' '+date(d.retrievedAt);
}
function renderCrmViewerStatus() {
 $('crm-viewer').title=t('Laporan bulanan resmi CRM Jakarta','Official CRM Jakarta monthly report');
 $('crm-viewer-status').textContent=$('crm-viewer-shell').hidden?'':crmViewerOpened
   ?t('Tampilan penerbit dibuka. Periksa periode dan waktu pembaruan di dalam laporan; jika kosong, gunakan tautan langsung di atas.','Publisher viewer opened. Check its period and update time inside the report; if blank, use the direct link above.')
   :t('Membuka tampilan resmi penerbit. Tautan langsung tetap tersedia jika laporan tidak dimuat.','Opening the official publisher viewer. The direct link remains available if the report does not load.');
}
$('crm-load').addEventListener('click',()=>{
 $('crm-viewer-shell').hidden=false;
 $('crm-load').setAttribute('aria-expanded','true');
 if(!$('crm-viewer').getAttribute('src'))$('crm-viewer').src=CRM_MONTHLY_URL;
 renderCrmViewerStatus();
 $('crm-viewer-shell').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
});
$('crm-close').addEventListener('click',()=>{
 $('crm-viewer-shell').hidden=true;
 $('crm-viewer').removeAttribute('src');crmViewerOpened=false;
 $('crm-load').setAttribute('aria-expanded','false');$('crm-load').focus();renderCrmViewerStatus();
});
$('crm-viewer').addEventListener('load',()=>{if(!$('crm-viewer-shell').hidden){crmViewerOpened=true;renderCrmViewerStatus();}});
const ledger=[
 ['Jakarta Smart City / CRM','https://crm.jakarta.go.id/data-bulanan','Laporan penerbit & layanan warga','Publisher report & citizen services','Harian, bulanan, kelurahan dan peta pada situs resmi; periode diatur penerbit','Daily, monthly, kelurahan and map views on the official site; publisher controls periods','Tampilan resmi; tidak ada API aduan privat','Official viewer; no private complaint API'],
 ['BMKG','https://data.bmkg.go.id/','Prakiraan & peringatan resmi','Official forecasts & warnings','Kelurahan; CAP DKI/Jawa Barat/Banten; gempa Indonesia','Kelurahan forecasts; CAP DKI/West Java/Banten; Indonesia earthquakes','Terbuka; atribusi BMKG','Open; BMKG attribution'],
 ['TransJakarta','https://ppid.transjakarta.co.id/informasi/berkala','Jadwal statis','Static schedule','240 rute; bukan posisi bus atau kemacetan','240 routes; no observed bus positions or congestion','CC BY 4.0','CC BY 4.0'],
 ['Jakarta Satu','https://jakartasatu.jakarta.go.id/geoportal/','Referensi publik','Public reference','678 fasilitas kesehatan; 3.525 sekolah; bukan kapasitas tersedia','678 health facilities; 3,525 schools; no live capacity','Atribusi penerbit; lisensi dataset tidak dinyatakan','Publisher attribution; dataset license not stated'],
 ['PetaBencana','https://docs.petabencana.id/informasi-lisensi-data','Laporan warga','Crowdsourced reports','Jumlah laporan satu jam; bukan survei banjir','One-hour report count; not a flood survey','CC BY-NC 4.0; perjanjian untuk komersial','CC BY-NC 4.0; commercial agreement'],
 ['Open-Meteo / CAMS','https://open-meteo.com/en/docs/air-quality-api','Perkiraan model','Model estimate','Lima sampel; US AQI bukan ISPU','Five samples; US AQI is not ISPU','Atribusi; layanan gratis nonkomersial','Attribution; non-commercial free service'],
 ['Overture / OSM / Google / GHSL','/atlas#atlas-data','Snapshot geospasial','Geospatial snapshot','3,38 juta fitur dalam persegi panjang; tinggi dari berbagai sumber/tahun','3.38 million features in a rectangle; mixed-source and mixed-epoch heights','ODbL / CC BY; lihat atlas','ODbL / CC BY; see atlas'],
 ['NASA / JMA / RainViewer / GDACS','/atlas#atlas-environment','Satelit, radar & kejadian','Satellite, radar & events','Air permukaan, awan, aerosol dan badai regional; resolusi terbatas','Surface water, clouds, aerosols and regional storms; limited resolution','Ketentuan tiap penyedia','Provider-specific terms'],
 ['Udara Jakarta / BPS / BIG','https://udara.jakarta.go.id/','Sumber lanjutan','Further sources','Pengukuran udara, statistik kota dan pasang surut belum terhubung','Measured air, city statistics and tides are not yet connected','Akses atau izin tambahan','Additional access or permission']
];
function renderSources(){ $('source-ledger').innerHTML=ledger.map(r=>'<tr><td><a href="'+r[1]+'" target="_blank" rel="noopener">'+esc(r[0])+' ↗</a></td><td>'+esc(lang==='id'?r[2]:r[3])+'</td><td>'+esc(lang==='id'?r[4]:r[5])+'</td><td>'+esc(lang==='id'?r[6]:r[7])+'</td></tr>').join(''); }
function clock(){ $('clock').textContent=new Date().toLocaleString(lang==='id'?'id-ID':'en-GB',{timeZone:'Asia/Jakarta',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' WIB'; }
async function refresh(){
 const id=++refreshId;$('refresh').disabled=true;$('feed-status').textContent=t('Memeriksa data terbitan…','Checking published feeds…');
 const jobs=[['/api/jakarta/weather',d=>{weatherData=d;renderWeather();}],['/api/atlas/air-quality',d=>{airData=d;renderAir();}],['/api/jakarta/alerts?lang='+lang,d=>{alertsData=d;renderAlerts();}],['/api/jakarta/earthquake',d=>{quakeData=d;renderQuake();}],['/api/jakarta/flood-reports',d=>{floodData=d;renderFlood();}]];
 await Promise.all(jobs.map(async([url,render])=>{const d=await get(url);if(id===refreshId)render(d);}));
 if(id!==refreshId)return;
 const count=[weatherData?.points?.some(p=>p.available),Array.isArray(airData),alertsData?.available,quakeData?.available,floodData?.available].filter(Boolean).length;
 $('feed-status').textContent=t('Sumber tersedia','Sources available')+' '+count+'/5 · '+t('diperiksa','checked')+' '+date(new Date().toISOString());$('refresh').disabled=false;
}
$('language').addEventListener('change',()=>{lang=$('language').value;try{localStorage.setItem('jakarta-dashboard-lang',lang);}catch{}const u=new URL(location.href);u.searchParams.set('lang',lang);history.replaceState(null,'',u);applyLanguage();refresh();}); // axiom-audit-ignore honesty -- Optional local preference persistence; current controls and source values remain available with explicit defaults.
$('basemap').addEventListener('change',()=>send({type:'atlas:setBasemap',bas:$('basemap').value}));
$('refresh').addEventListener('click',refresh);$('forecast-location').addEventListener('change',renderForecast);$('route-search').addEventListener('input',renderTransit);$('civic-search').addEventListener('input',renderCivic);$('civic-kind').addEventListener('change',loadCivic);
$('route-results').addEventListener('click',e=>{const b=e.target.closest('[data-route]');if(b)selectRoute(b.dataset.route);});
function locate(e){const b=e.target.closest('[data-lng]');if(!b)return;showOverlay({type:'FeatureCollection',features:[{type:'Feature',properties:{name:b.dataset.name},geometry:{type:'Point',coordinates:[Number(b.dataset.lng),Number(b.dataset.lat)]}}]},b.dataset.name+' · '+t('titik referensi','reference point'));}
$('civic-results').addEventListener('click',locate);$('route-detail').addEventListener('click',locate);
$('alerts').addEventListener('click',e=>{const b=e.target.closest('[data-alert]');const a=alertsData?.alerts?.find(a=>a.id===b?.dataset.alert);if(a)showOverlay(a.geometry,'BMKG · '+a.headline);});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-view]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));send({type:'atlas:setView',view:b.dataset.view});}));
$('clear-overlay').addEventListener('click',()=>{showOverlay({type:'FeatureCollection',features:[]},t('Lapisan pilihan dihapus.','Selected overlay cleared.'));});
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('city-map').contentWindow)return;const d=e.data;if(d?.type==='jakarta-atlas'&&d.event==='ready'||d?.type==='atlas:ready'){mapReady=true;$('map-status').textContent=t('Atlas siap','Atlas ready');send({type:'atlas:setLanguage',language:lang});send({type:'atlas:setTheme',theme:document.documentElement.dataset.theme});if(selectedOverlay)showOverlay(selectedOverlay.data,selectedOverlay.label);}});
window.addEventListener('atlas:theme',e=>send({type:'atlas:setTheme',theme:e.detail}));
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({build:DASHBOARD_BUILD,exportedAt:new Date().toISOString(),weather:weatherData,air:airData,alerts:alertsData,earthquake:quakeData,floodReports:floodData,transit:transit?{...transit,routes:undefined}:null,selectedRoute:routeDetail,civic,selectedOverlay,crm:{sourceUrl:'https://crm.jakarta.go.id/data-bulanan',viewerUrl:CRM_MONTHLY_URL,tier:'publisher-hosted-report',dataImported:false}},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='jakarta-evidence-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
applyLanguage();refresh();setInterval(refresh,5*60000);setInterval(clock,60000);
get('/data/jakarta-v1/transit.json?v='+DASHBOARD_BUILD).then(d=>{transit=d;renderTransit();});get('/data/jakarta-v1/civic.json?v='+DASHBOARD_BUILD).then(d=>{civic=d;});loadCivic();
