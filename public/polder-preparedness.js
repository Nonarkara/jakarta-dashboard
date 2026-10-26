// Published reference locations, joined to original boundaries. No impact/capacity inference.
export function validatePreparedness(data) {
 if(data?.contract!=='polder-facilities-v1'||data.crs!=='EPSG:4326'||!Array.isArray(data.features)||data.features.length>15000||!Array.isArray(data.boundaries)||!Array.isArray(data.sources))return false;
 const ids=new Set(),keys=new Map(),sources=new Set(data.sources.map(s=>s?.id));
 if(data.sources.length!==2||!sources.has('health')||!sources.has('schools'))return false;
 for(const s of data.sources)if(!['source','publisher','retrievedAt','tier','license'].every(k=>typeof s[k]==='string'&&s[k])||!Number.isFinite(Date.parse(s.retrievedAt))||!/^[a-f0-9]{64}$/.test(s.sha256))return false;
 for(const f of data.features){const p=f?.properties,c=f?.geometry?.coordinates;
  if(f?.geometry?.type!=='Point'||!Array.isArray(c)||c.length!==2||!Array.from(c).every(Number.isFinite)||c[0]<106||c[0]>108||c[1]<-7||c[1]>-5||typeof p?.key!=='string'||keys.has(p.key)||!['name','kind','kelurahan','kecamatan','kota'].every(k=>typeof p[k]==='string')||!Array.isArray(p.sourceRows)||!p.sourceRows.length||!Array.from(p.sourceRows).every(i=>Number.isInteger(i)&&i>=0)||!sources.has(p.sourceId)||!Array.isArray(p.boundaryIds)||!p.boundaryIds.length)return false;keys.set(p.key,f);
 }
 for(const b of data.boundaries){if(!Number.isInteger(b?.id)||ids.has(b.id)||typeof b.name!=='string'||!Array.isArray(b.memberKeys)||new Set(b.memberKeys).size!==b.memberKeys.length)return false;ids.add(b.id);
  const rows=b.memberKeys.map(k=>keys.get(k));if(rows.some(f=>!f||!f.properties.boundaryIds.includes(b.id)))return false;
  for(const id of sources)if(b.counts?.[id]!==rows.filter(f=>f.properties.sourceId===id).length)return false;
 }
 for(const f of data.features)for(const id of f.properties.boundaryIds)if(!ids.has(id)||!data.boundaries.find(b=>b.id===id).memberKeys.includes(f.properties.key))return false;
 return true;
}
export function referenceRows(data,boundaryId,query='') {
 const boundary=data?.boundaries?.find(b=>b.id===Number(boundaryId));if(!boundary)return null;
 const keys=new Set(boundary.memberKeys),q=String(query).trim().toLocaleLowerCase();
 return data.features.filter(f=>keys.has(f.properties.key)&&[f.properties.name,f.properties.kelurahan,f.properties.kecamatan].join(' ').toLocaleLowerCase().includes(q)).sort((a,b)=>Number(!a.properties.name.trim())-Number(!b.properties.name.trim())||a.properties.name.trim().localeCompare(b.properties.name.trim())||a.properties.key.localeCompare(b.properties.key));
}
export function referenceCsv(rows,sources,boundary) {
 const cell=value=>{let s=String(value??'');if(typeof value==='string'&&(/^[\s]*[=+\-@]/.test(s)||/^[\t\r\n]/.test(s)))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const header=['polder_id','polder_name','source_id','reference_key','source_rows_zero_based','name','kind','kelurahan','kecamatan','kota','longitude','latitude','reference_retrieved_at','observation_date','source_url','source_sha256','interpretation'];
 return '\uFEFF'+[header,...rows.map(f=>{const p=f.properties,s=sources.find(s=>s.id===p.sourceId);return [boundary.id,boundary.name,p.sourceId,p.key,p.sourceRows.join(';'),p.name,p.kind,p.kelurahan,p.kecamatan,p.kota,...f.geometry.coordinates,s?.retrievedAt,s?.observedAt,s?.source,s?.sha256,'Published reference point membership; not flood impact, service availability or shelter designation'];})].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
export function createPreparedness(map,{text:t,isCurrent,buildTag}) {
 let disposed=false,data=null,pending=null,controller=null,generation=0,requestState='not-requested',selectionReadout=null;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const button=(name,run)=>{const n=el('button',name);n.type='button';n.addEventListener('click',run);return n;};
 const active=()=>!disposed&&isCurrent();
 const label=id=>id==='health'?t('health reference locations','lokasi referensi kesehatan'):t('school reference locations','lokasi referensi sekolah');
 const removeMap=()=>{selectionReadout?.remove();selectionReadout=null;for(const id of ['polder-preparedness-points'])if(map.getLayer(id))map.removeLayer(id);if(map.getSource('polder-preparedness'))map.removeSource('polder-preparedness');};
 function drawMap(rows,focus=null){
  if(!active())return;removeMap();map.addSource('polder-preparedness',{type:'geojson',data:{type:'FeatureCollection',features:rows}});
  map.addLayer({id:'polder-preparedness-points',type:'circle',source:'polder-preparedness',paint:{'circle-color':['match',['get','sourceId'],'health','#e07862','#28a8c6'],'circle-radius':focus?8:5,'circle-stroke-color':'#081c2d','circle-stroke-width':1.5}});
  if(focus){selectionReadout=el('div');selectionReadout.className='preparedness-selection';selectionReadout.setAttribute('role','status');const coords=el('p',focus.geometry.coordinates[1].toFixed(5)+', '+focus.geometry.coordinates[0].toFixed(5)+' · WGS84');coords.className='network-location';selectionReadout.append(el('p',focus.properties.name.trim()||t('Unnamed reference','Referensi tanpa nama')),coords);map.getContainer().append(selectionReadout);map.easeTo({center:focus.geometry.coordinates,zoom:15,pitch:0,duration:0});const drawer=document.getElementById('atlas-lens-evidence');if(drawer)drawer.open=false;}
 }
 function snapshot(id){const rows=referenceRows(data,id);if(!rows)return {available:false,state:requestState};return {available:true,contract:'polder-preparedness-brief-v1',generatedAt:new Date().toISOString(),boundary:data.boundaries.find(b=>b.id===Number(id)),boundarySource:data.boundarySource,boundaryObservedAt:data.boundaryObservedAt,rawBoundarySha256:data.rawBoundarySha256,sources:data.sources,features:rows,method:data.method,limitations:data.limitations};}
 function download(text,mime,name){const url=URL.createObjectURL(new Blob([text],{type:mime})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function load(){
  if(data)return data;if(pending)return pending;requestState='loading';controller=new AbortController();
  pending=(async()=>{try{const response=await fetch('/data/jakarta-v1/polder-facilities.json?v='+encodeURIComponent(buildTag),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});if(!response.ok)throw Error('unavailable');const value=await response.json();if(!validatePreparedness(value))throw Error('invalid');if(!active())return null;data=value;requestState='available';return data;}catch{requestState='unavailable';return null;}finally{pending=null;}})();return pending;
 }
 function disclosure(boundaryId){
  const token=++generation;removeMap();const details=el('details'),summary=el('summary',t('Preparedness · reference locations','Kesiapsiagaan · lokasi referensi')),host=el('div');host.className='preparedness-context';details.append(summary,host);let started=false;
  const current=()=>active()&&token===generation;
  async function show(){
   if(!current())return;host.setAttribute('aria-busy','true');host.replaceChildren(el('p',t('Loading the boundary–location join…','Memuat gabungan batas dan lokasi…')));const loaded=await load();host.setAttribute('aria-busy','false');if(!current())return;
   const rows=referenceRows(loaded,boundaryId);if(!loaded||!rows){host.replaceChildren(el('p',t('Preparedness references unavailable. The water account remains independent.','Referensi kesiapsiagaan tidak tersedia. Neraca air tetap terpisah.')),button(t('Retry references','Coba lagi referensi'),show));return;}
   host.replaceChildren();const boundary=loaded.boundaries.find(b=>b.id===Number(boundaryId));
   host.append(el('p',Object.entries(boundary.counts).map(([id,count])=>count.toLocaleString(t('en-GB','id-ID'))+' '+label(id)).join(' · ')));
   host.append(el('p',t('Published points inside this original DSDA boundary, after exact duplicate records are merged. Verify local continuity plans and access with the responsible unit. These are not confirmed flooded sites or designated shelters.','Titik yang diterbitkan di dalam batas asli DSDA, setelah catatan duplikat persis digabung. Verifikasi rencana keberlanjutan layanan dan akses dengan unit penanggung jawab. Ini bukan lokasi banjir terkonfirmasi atau tempat pengungsian yang ditetapkan.')));
   const actions=el('div'),mapActions=el('div'),exportActions=el('div');actions.className='budget-actions';mapActions.append(button(t('Show all points','Tampilkan semua titik'),()=>drawMap(rows)),button(t('Clear points','Hapus penanda'),removeMap));exportActions.append(button(t('CSV · all locations','CSV · semua lokasi'),()=>download(referenceCsv(rows,loaded.sources,boundary),'text/csv;charset=utf-8','jakarta-polder-'+boundaryId+'-references.csv')),button(t('Preparation JSON','Kesiapsiagaan JSON'),()=>download(JSON.stringify(snapshot(boundaryId),null,2),'application/json','jakarta-polder-'+boundaryId+'-preparation.json')));actions.append(mapActions,exportActions);host.append(actions);
   const searchLabel=el('label',t('Find a published location','Cari nama lokasi')),search=el('input');search.type='search';search.setAttribute('aria-label',t('Find a published location','Cari nama lokasi'));searchLabel.append(search);host.append(searchLabel);
   const status=el('p'),list=el('ul'),selection=el('p'),previous=button(t('Previous 20','20 sebelumnya'),()=>{page--;renderList();}),more=button(t('Show next 20','Tampilkan 20 berikutnya'),()=>{page++;renderList();});list.className='preparedness-list';selection.className='network-location';status.setAttribute('aria-live','polite');const paging=el('div');paging.className='budget-actions';paging.append(previous,more);host.append(status,list,paging,selection);let page=0;
   function renderList(){
    const matching=referenceRows(loaded,boundaryId,search.value),start=page*20,shown=matching.slice(start,start+20);list.replaceChildren();status.textContent=matching.length?t('Showing ','Menampilkan ')+(start+1)+'–'+(start+shown.length)+' / '+matching.length:t('No matching published record. This does not establish absence of facilities.','Tidak ada catatan terbitan yang cocok. Ini tidak membuktikan ketiadaan fasilitas.');more.hidden=start+shown.length>=matching.length;previous.hidden=page===0;
    for(const f of shown){const p=f.properties,li=el('li'),name=p.name.trim()||t('Unnamed reference','Referensi tanpa nama');li.append(button(name,()=>{selection.textContent=name+' · '+f.geometry.coordinates[1].toFixed(5)+', '+f.geometry.coordinates[0].toFixed(5)+' · WGS84';drawMap([f],f);}),el('small',label(p.sourceId)+' · '+[p.kelurahan,p.kecamatan].filter(Boolean).join(' / ')));list.append(li);}
   }
   search.addEventListener('input',()=>{page=0;renderList();});renderList();
   host.append(el('p',t('Select a name to centre its published point and close the drawer. Coral points: health references; blue: school references.','Pilih nama untuk memusatkan titik terbitannya dan menutup panel. Titik koral: referensi kesehatan; biru: referensi sekolah.')));
   host.append(el('p',t('Inventory observation dates and operating capacity are unknown. Coordinates are rounded to five decimals; verify membership near a boundary. Overlapping polder lists cannot be added into a city total.','Tanggal pengamatan inventaris dan kapasitas operasi tidak diketahui. Koordinat dibulatkan hingga lima desimal; verifikasi keanggotaan di dekat batas. Daftar polder tumpang tindih tidak boleh dijumlah menjadi total kota.')));
   for(const s of loaded.sources){const paragraph=el('p'),link=el('a',s.publisher+' · '+label(s.id)+'\u00a0↗');try{const u=new URL(s.source);if(u.protocol==='https:')link.href=u.href;}catch{}link.target='_blank';link.rel='noopener';paragraph.append(link,document.createTextNode(' · '+t('retrieved ','diambil ')+new Date(s.retrievedAt).toLocaleDateString(t('en-GB','id-ID'),{timeZone:'Asia/Jakarta'})+' · '+s.duplicates+' '+t('duplicate rows merged across the source inventory','baris duplikat digabung pada seluruh inventaris sumber')+'. '+s.license));host.append(paragraph);}
  }
  details.addEventListener('toggle',()=>{if(details.open&&!started){started=true;void show();}});return details;
 }
 return {disclosure,snapshot,clear(){disposed=true;generation++;controller?.abort();removeMap();data=null;}};
}
