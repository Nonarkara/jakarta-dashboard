// A place connects dated public references; proximity never implies service or protection.
const RAD = Math.PI / 180, EARTH = 6371008.8;
export function validPlace(p) {
  return Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= 106.65 && p[0] <= 107 && p[1] >= -6.4 && p[1] <= -6.08;
}
export function distanceM(a, b) {
  const lat = (b[1]-a[1])*RAD, lng = (b[0]-a[0])*RAD;
  const h = Math.sin(lat/2)**2 + Math.cos(a[1]*RAD)*Math.cos(b[1]*RAD)*Math.sin(lng/2)**2;
  return EARTH*2*Math.atan2(Math.sqrt(Math.min(1,h)), Math.sqrt(Math.max(0,1-h)));
}
function segmentPoint(p, a, b) {
  if (![a,b].every(validPlace)) return null;
  // Local tangent-plane projection finds the nearest point on each short mapped segment.
  const c = Math.cos(p[1]*RAD), ax=(a[0]-p[0])*c, ay=a[1]-p[1], bx=(b[0]-p[0])*c, by=b[1]-p[1];
  const dx=bx-ax, dy=by-ay, d=dx*dx+dy*dy;
  const t=d ? Math.max(0,Math.min(1,-(ax*dx+ay*dy)/d)) : 0;
  return [p[0]+(ax+t*dx)/c,p[1]+ay+t*dy];
}
export function nearestPoint(p, geometry) {
  if (!validPlace(p)) return null;
  if (geometry?.type === 'Point') return validPlace(geometry.coordinates) ? geometry.coordinates : null;
  if (geometry?.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return null;
  let nearest=null, distance=Infinity;
  for(let i=1;i<geometry.coordinates.length;i++) {
    const point=segmentPoint(p,geometry.coordinates[i-1],geometry.coordinates[i]);
    if(point&&distanceM(p,point)<distance){nearest=point;distance=distanceM(p,point);}
  }
  return nearest;
}
export function geometryDistance(p, geometry) {
  const point=nearestPoint(p,geometry);return point?distanceM(p,point):Infinity;
}
export function nearby(p, data, radius=5000) {
  if (!validPlace(p) || !Array.isArray(data?.features)) return [];
  const seen=new Set();
  return data.features.filter(feature=>{
    // Exact duplicate rows are retained in source files, but occupy one result slot.
    const key=JSON.stringify([feature?.properties?.name,feature?.geometry]);
    if(seen.has(key))return false;seen.add(key);return true;
  }).map(feature=>{const coordinate=nearestPoint(p,feature?.geometry);return {feature,coordinate,distance:coordinate?distanceM(p,coordinate):Infinity};})
    .filter(row=>Number.isFinite(row.distance)&&row.distance<=radius).sort((a,b)=>a.distance-b.distance).slice(0,3);
}
const SOURCES = [
  ['waterways','Mapped waterways','Aliran air terpetakan'],
  ['pumps','Flood infrastructure','Infrastruktur banjir'],
  ['awlr','Water-level stations','Stasiun tinggi air'],
  ['health','Health facilities','Fasilitas kesehatan'],
  ['schools','Schools','Sekolah']
];
export async function loadReferences(fetcher, signal, build, previous=[]) {
  return Promise.all(SOURCES.map(async ([id,en,idText])=>{
    const cached=previous.find(source=>source.id===id&&source.data);
    if(cached)return cached;
    try {
      const response=await fetcher('/data/jakarta-v1/'+id+'.geojson?v='+encodeURIComponent(build),{signal});
      if(!response.ok) throw Error('unavailable');
      const data=await response.json();
      if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length>15000||data.crs!=='EPSG:4326') throw Error('invalid reference');
      return {id,en,idText,data};
    } catch(error) {
      return {id,en,idText,data:null};
    }
  }));
}
export function createPlaceContext(map, options) {
  const dialog=document.getElementById('place-dialog'), body=document.getElementById('place-body');
  const text=(en,id)=>options.language()==='id'?id:en;
  let location=null, references=null, epoch=0, pending=null, previousFocus=null;
  let groundValue=null, groundState='idle';
  const el=(tag,content,parent=body)=>{const node=document.createElement(tag);if(content!==undefined)node.textContent=content;parent.append(node);return node;};
  function marker(features) {
    const id='place-context';
    const data={type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:location}},...features]};
    if(map.getSource(id)) map.getSource(id).setData(data);
    else {
      map.addSource(id,{type:'geojson',data});
      map.addLayer({id:id+'-line',source:id,type:'line',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':options.accent(),'line-width':4}});
      map.addLayer({id:id+'-point',source:id,type:'circle',filter:['==',['geometry-type'],'Point'],paint:{'circle-color':options.accent(),'circle-radius':6,'circle-stroke-color':options.ground(),'circle-stroke-width':2}});
    }
  }
  function render() {
    body.replaceChildren();
    document.getElementById('place-title').textContent=text('Around this place','Di sekitar lokasi ini');
    document.getElementById('place-close').textContent=text('Back to map','Kembali ke peta');
    const coords=el('p',location[1].toFixed(5)+', '+location[0].toFixed(5)+' · WGS84');coords.className='place-coordinates';
    el('p',text('Nearest mapped references within 5 km. Distances are straight-line estimates, not walking routes.','Referensi terpetakan terdekat dalam 5 km. Jarak adalah perkiraan garis lurus, bukan rute berjalan kaki.'));
    const clear=el('button',text('Clear place marker','Hapus penanda lokasi'));clear.type='button';clear.onclick=()=>{for(const id of ['place-context-line','place-context-point'])if(map.getLayer(id))map.removeLayer(id);if(map.getSource('place-context'))map.removeSource('place-context');dialog.close();};
    const actions=el('div');actions.className='place-actions';
    for(const [lens,en,id] of [['waterways','Check river readings','Periksa tinggi air'],['water','Compare satellite water','Bandingkan air satelit'],['air','Read air & wind','Lihat udara & angin']]) {
      const button=el('button',text(en,id),actions);button.type='button';button.onclick=()=>{dialog.close();options.lens(lens);document.getElementById('atlas-lens-evidence').open=true;};
    }
    // Stand here: the descent from the city to the place. The map is a model
    // of a city; a morning check is about a street. This is the same move a
    // location scout makes, and it is the one our lenses cannot make — they
    // are all city-scale.
    const stand=el('button',text('Stand here','Berdiri di sini'),actions);stand.type='button';
    stand.onclick=()=>{dialog.close();map.flyTo({center:location,zoom:18.5,pitch:68,bearing:map.getBearing(),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:600});};
    el('p',text('Standing here puts the camera at eye level on this spot. There is no walking route here: the distances above are straight lines.','Berdiri di sini menempatkan kamera setinggi mata di titik ini. Tidak ada rute berjalan kaki di sini: jarak di atas adalah garis lurus.'),actions).className='place-source';
    el('p',text('These views have different dates and resolutions. Air models and satellite pixels cannot measure conditions at this exact address.','Tampilan ini berbeda tanggal dan resolusinya. Model udara dan piksel satelit tidak mengukur kondisi tepat di alamat ini.'));
    // The ground under the place. Our map is flat, so this is the only way a
    // reader learns whether the street sits in a dip. It is a raster model
    // with its own source and resolution, and it is never compared with a
    // gauge reading: a gauge reads against its own datum, and the project's
    // own words are that heights cannot be transferred between station datums.
    const ground=el('p');ground.className='place-source';
    if(groundState==='loading')ground.textContent=text('Reading the ground height…','Membaca ketinggian tanah…');
    else if(groundState==='ready'&&groundValue)ground.textContent=text('Ground height here','Ketinggian tanah di sini')+' '+groundValue.metres.toFixed(0)+' m '+text('above sea level','di atas permukaan laut')+' · '+groundValue.source.attribution+' · ~'+Math.round(groundValue.resolutionMetres)+' m/pixel · '+text('retrieved','diambil')+' '+groundValue.retrievedAt.slice(0,10)+' · '+text('a raster model, not a survey','model raster, bukan survei');
    else ground.textContent=text('The ground height here is unknown.','Ketinggian tanah di sini tidak diketahui.');
    if(!references) {el('p',text('Loading public references…','Memuat referensi publik…')).setAttribute('role','status');return;}
    for(const source of references) {
      const section=el('section');el('h3',text(source.en,source.idText),section);
      if(!source.data) {el('p',text('This source is unavailable. Other references remain visible.','Sumber ini tidak tersedia. Referensi lain tetap ditampilkan.'),section);continue;}
      const rows=nearby(location,source.data);
      if(!rows.length) el('p',text('No reference found within 5 km in this dataset. Coverage may be incomplete.','Tidak ditemukan referensi dalam 5 km pada data ini. Cakupan mungkin belum lengkap.'),section);
      for(const row of rows) {
        const button=el('button',undefined,section);button.type='button';button.className='place-result';
        el('span',row.feature.properties?.name||text('Unnamed mapped feature','Objek terpetakan tanpa nama'),button);
        el('span','≈ '+Math.round(row.distance/10)*10+' m · '+text('Show on map','Lihat di peta'),button);
        button.onclick=()=>{
          marker([row.feature]);
          const c=row.coordinate;
          map.fitBounds([[Math.min(location[0],c[0]),Math.min(location[1],c[1])],[Math.max(location[0],c[0]),Math.max(location[1],c[1])]],{padding:70,maxZoom:16,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:250});
          dialog.close();
        };
      }
      const data=source.data, date=data.sourceAsOf||data.observedAt;
      const note=source.id==='waterways'?text('OpenStreetMap · mapped reference','OpenStreetMap · referensi peta'):text('Jakarta Satu · public reference','Jakarta Satu · referensi publik');
      el('p',note+' · '+(date?text('Source date ','Tanggal sumber ')+date.slice(0,10):text('Observation date unknown','Tanggal pengamatan tidak diketahui'))+' · '+text('Retrieved ','Diambil ')+(data.retrievedAt||data.checkedAt||'').slice(0,10),section).className='place-source';
      // The stations publish their SIAGA alert bands per station. The dataset
      // carries no live reading, and a reader who is looking for a number has
      // to be told that before they go looking for it.
      if(source.id==='awlr')el('p',text('Each station publishes its SIAGA 1–4 alert bands in cm as published. This dataset carries no live reading: the level shown in the scenario is an assumption you set.','Setiap pos menerbitkan pita peringatan SIAGA 1–4 dalam cm sesuai penerbitnya. Dataset ini tidak memuat pembacaan langsung: angka pada skenario adalah asumsi yang Anda tetapkan.'),section).className='place-source';
      const url=data.sourceUrl||data.source;
      if(typeof url==='string'&&url.startsWith('https://')) {const a=el('a',text('Publisher source ↗','Sumber penerbit ↗'),section);a.href=url;a.target='_blank';a.rel='noopener noreferrer';}
    }
    el('p',text('Proximity does not establish drainage connections, protection, opening hours, available beds, or school access. Waterway direction is not measured. The ground height is a raster model on its own reference: it is not comparable with a gauge reading, because a gauge reads against its own datum. This is a public-data research twin, still a Pilot.','Kedekatan tidak membuktikan koneksi drainase, perlindungan, jam buka, ketersediaan tempat tidur, atau akses sekolah. Arah aliran belum diukur. Ketinggian tanah adalah model raster pada acuan sendiri: tidak dapat dibandingkan dengan pembacaan pos, sebab pos mengukur terhadap datumnya sendiri. Ini adalah kembaran kota berbasis data publik untuk riset, masih tahap percontohan.'));
    if(references.some(source=>!source.data)) {const retry=el('button',text('Retry missing sources','Coba lagi sumber yang gagal'));retry.onclick=()=>load();}
  }
  async function load() {
    pending?.abort();const controller=new AbortController();pending=controller;const request=++epoch;
    const timeout=setTimeout(()=>controller.abort(),12000);
    render();
    try {
      const result=await loadReferences(fetch,controller.signal,options.build,references||[]);
      if(request===epoch&&dialog.open){references=result;render();}
    } catch(error) {
      if(request===epoch&&dialog.open){references=SOURCES.map(([id,en,idText])=>({id,en,idText,data:null}));render();}
    } finally {clearTimeout(timeout);}
  }
  // The ground height, read from an open elevation raster. It is fetched only
  // when a place is opened, and it is never a number without its source: the
  // reader is told what it is, where it came from and how coarse it is.
  let groundPending=null;
  async function loadGround() {
    groundPending?.abort();
    const controller=new AbortController();
    groundPending=controller;
    groundState='loading';groundValue=null;render();
    try {
      const module=await import('/ground-elevation.js?v='+encodeURIComponent(options.build));
      const result=await module.groundElevation({lat:location[1],lng:location[0],zoom:13,fetch:window.fetch.bind(window),signal:controller.signal,decodeImage:decodePng});
      groundValue=result;groundState=result?'ready':'unknown';
    } catch(error) {
      groundValue=null;groundState='unknown';
    } finally {
      if(groundPending===controller)groundPending=null;
    }
    if(dialog.open)render();
  }
  async function decodePng(blob) {
    const bitmap=await createImageBitmap(blob);
    const canvas=document.createElement('canvas');
    canvas.width=bitmap.width;canvas.height=bitmap.height;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    context.drawImage(bitmap,0,0);
    const image=context.getImageData(0,0,bitmap.width,bitmap.height);
    if(bitmap.close)bitmap.close();
    return {data:image.data,width:bitmap.width,height:bitmap.height};
  }
  function show(point) {
    location=[Number(point.lng),Number(point.lat)];
    if(!validPlace(location)) {options.toast(text('Choose a place within mainland Jakarta.','Pilih lokasi di daratan Jakarta.'));return;}
    previousFocus=document.activeElement;
    if(!dialog.open)dialog.showModal();
    marker([]);if(references)render();else load();
    loadGround();
    document.getElementById('place-close').focus();
  }
  document.getElementById('place-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{epoch++;pending?.abort();groundPending?.abort();previousFocus?.focus();});
  window.addEventListener('atlas:language',()=>{if(dialog.open)render();});
  window.addEventListener('atlas:theme',()=>{for(const [id,property] of [['place-context-line','line-color'],['place-context-point','circle-color']])if(map.getLayer(id))map.setPaintProperty(id,property,options.accent());if(map.getLayer('place-context-point'))map.setPaintProperty('place-context-point','circle-stroke-color',options.ground());});
  return {show};
}
