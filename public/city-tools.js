// Local public-reference search and a reproducible, bounded vector evidence export.
import {validPlace} from './place-context.js';
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/\s+/g,' ').trim();
export function indexPlaces(documents) {
  const rows=[],seen=new Set();
  for(const {kind,data} of documents) {
    if(kind==='place') {
      for(const place of data?.areas||[])if(validPlace(place.center))rows.push({name:place.name,nameId:place.indonesian,point:place.center,kind,context:place.category,searchText:[place.chapter,place.description,...(place.tags||[])].filter(Boolean).join(' '),source:'/jakarta-areas.json',sourceDate:data.version||null});
      continue;
    }
    if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||data.crs!=='EPSG:4326')continue;
    for(const feature of data.features) {
      const p=feature?.properties,point=feature?.geometry?.coordinates;
      if(feature?.geometry?.type!=='Point'||!validPlace(point)||!p?.name)continue;
      const key=normalize(p.name)+'|'+point.join(',');if(seen.has(key))continue;seen.add(key);
      rows.push({name:String(p.name),point,kind,context:[p.kelurahan,p.kecamatan].filter(Boolean).join(' · '),source:data.sourceUrl||data.source,sourceDate:data.observedAt||null,retrievedAt:data.retrievedAt||null});
    }
  }
  return rows;
}
export function searchPlaces(rows,query) {
  const q=normalize(query);if(q.length<2||q.length>100)return [];
  return rows.flatMap(row=>{
    const name=normalize(row.name+' '+(row.nameId||'')),context=normalize((row.context||'')+' '+(row.searchText||''));
    if(!name.includes(q)&&!context.includes(q))return [];
    return [{...row,rank:name===q?0:name.startsWith(q)?1:name.includes(q)?2:3}];
  }).sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name)).slice(0,10);
}
function geometryBox(geometry) {
  const positions=[];let invalid=false;
  function walk(c){if(!Array.isArray(c)||!c.length){invalid=true;return;}if(typeof c[0]==='number'){if(c.length>=2&&c.every(Number.isFinite)&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90)positions.push(c);else invalid=true;return;}for(const child of c)walk(child);}
  if(!['Point','LineString','Polygon','MultiPoint','MultiLineString','MultiPolygon'].includes(geometry?.type))return null;
  walk(geometry.coordinates);if(invalid||!positions.length)return null;
  return positions.reduce((box,p)=>[Math.min(box[0],p[0]),Math.min(box[1],p[1]),Math.max(box[2],p[0]),Math.max(box[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
}
export function exportView(snapshot,bounds,now=new Date().toISOString()) {
  if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[0]>bounds[2]||bounds[1]>bounds[3])throw Error('Invalid viewport');
  const collections=[];
  collections.push({id:'curated-camera-places',features:(snapshot.areas?.areas||[]).filter(p=>validPlace(p.center)).map(p=>({type:'Feature',geometry:{type:'Point',coordinates:p.center},properties:{name:p.name,nameId:p.indonesian,source:'/jakarta-areas.json',tier:'curated-camera-reference',sourceDate:snapshot.areas.version,coordinateRole:'curated camera target, not a building survey'}}))});
  collections.push({id:'air-model-samples',features:(snapshot.air||[]).filter(p=>validPlace([p.lng,p.lat])).map(p=>({type:'Feature',geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{name:p.label||p.name||p.id,aqi:p.aqi,aqiScale:'US AQI',pm25:p.pm25,pm25Unit:'µg/m³',source:p.provenance?.source||p.source||'unknown',tier:p.provenance?.tier||'unverified',observedAt:p.observedAt||null,stale:!Number.isFinite(Date.parse(p.observedAt))||Date.parse(now)-Date.parse(p.observedAt)>3*3600000||Date.parse(p.observedAt)>Date.parse(now),coordinateRole:'dashboard model sample; provider grid may differ'}}))});
  if(Array.isArray(snapshot.fires?.features))collections.push({id:'thermal-detections',features:snapshot.fires.features});
  if(Array.isArray(snapshot.selection?.features))collections.push({id:'selected-reference',features:snapshot.selection.features});
  const features=[],counts={};let matching=0;
  for(const collection of collections)for(const f of collection.features){
    const b=geometryBox(f?.geometry);if(!b||b[0]>bounds[2]||b[2]<bounds[0]||b[1]>bounds[3]||b[3]<bounds[1])continue;
    matching++;if(features.length>=20000)continue;
    counts[collection.id]=(counts[collection.id]||0)+1;
    features.push({...f,properties:{...f.properties,exportCollection:collection.id}});
  }
  return {type:'FeatureCollection',...(features.length?{bbox:features.map(f=>geometryBox(f.geometry)).reduce((a,b)=>[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])])}:{}),metadata:{viewportBounds:bounds,build:snapshot.build,exportedAt:now,lens:snapshot.lens,counts,matchingFeatures:matching,truncated:matching>features.length,
    selectionRule:'Vector reference bounding boxes overlap the viewport; geometry is not clipped. Source dates remain per feature.',
    exclusions:['Building PMTiles archive','Satellite and radar raster pixels','Official drainage vector-tile archive','Unloaded references and unexported active layers'],
    satelliteContext:snapshot.product||null,thermalContext:snapshot.fires?{source:snapshot.fires.source||null,fetchedAt:snapshot.fires.fetchedAt||null}:null,
    limitations:'A reproducible evidence selection, not a complete digital twin, live inventory, flood prediction or safety assessment.'},features};
}
export function createCityTools(map,options) {
  const container=document.querySelector('#atlas-areas details');
  if(!container||document.getElementById('city-tools'))return;
  const text=(en,id)=>options.language()==='id'?id:en;
  const panel=document.createElement('section');panel.id='city-tools';panel.className='city-tools';
  container.querySelector('summary').after(panel);
  let documents=[{kind:'place',data:options.snapshot().areas}],loading=null;
  const el=(tag,content,parent=panel)=>{const node=document.createElement(tag);if(content!==undefined)node.textContent=content;parent.append(node);return node;};
  const form=el('form');form.className='city-tools-search';
  const label=el('label',undefined,form);label.htmlFor='city-place-query';
  const input=el('input',undefined,form);input.id='city-place-query';input.type='search';input.maxLength=100;input.minLength=2;input.autocomplete='off';
  const submit=el('button',undefined,form);submit.type='submit';
  const status=el('p');status.setAttribute('role','status');
  const list=el('div');list.className='city-place-results';
  const download=el('button');download.type='button';
  const note=el('p');note.className='note';
  function translate(){
    label.textContent=text('Find a landmark, school or health facility','Cari tempat, sekolah, atau fasilitas kesehatan');
    submit.textContent=text('Find','Cari');download.textContent=text('Download view · GeoJSON','Unduh tampilan · GeoJSON');
    note.textContent=text('Search uses dated mapped references, not a house-address directory. Export includes available curated places, air samples, thermal detections and a selected reference; raster pixels and the building archive are excluded.','Pencarian memakai referensi peta bertanggal, bukan direktori alamat rumah. Ekspor memuat tempat pilihan, sampel udara, deteksi termal, dan referensi terpilih yang tersedia; piksel raster dan arsip bangunan tidak disertakan.');
  }
  translate();
  async function load(){
    if(loading)return loading;
    const previous=documents;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    loading=Promise.all(['health','schools'].map(async kind=>{
      const cached=previous.find(d=>d.kind===kind&&d.data);if(cached)return cached;
      try{const response=await fetch('/data/jakarta-v1/'+kind+'.geojson?v='+encodeURIComponent(options.build),{signal:controller.signal});if(!response.ok)throw Error('unavailable');const data=await response.json();if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length>15000||data.crs!=='EPSG:4326')throw Error('invalid');return {kind,data};}catch{return {kind,data:null};}
    })).then(rows=>{documents=[{kind:'place',data:options.snapshot().areas},...rows];}).finally(()=>{clearTimeout(timer);loading=null;});return loading;
  }
  let request=0;
  form.addEventListener('submit',async event=>{
    event.preventDefault();const current=++request,query=input.value.trim();if(query.length<2)return;
    status.textContent=text('Searching public references…','Mencari referensi publik…');list.replaceChildren();await load();if(current!==request)return;
    const rows=searchPlaces(indexPlaces(documents),query);
    const missing=documents.some(d=>!d.data);
    status.textContent=rows.length+' '+text('results (up to 10)','hasil (maksimal 10)')+(missing?text(' · Some sources unavailable; submit again to retry.',' · Sebagian sumber tidak tersedia; cari lagi untuk mencoba ulang.'):'');
    for(const row of rows){const button=el('button',undefined,list);button.type='button';button.className='city-place-result';
      el('strong',options.language()==='id'&&row.nameId?row.nameId:row.name,button);
      const kind={place:text('Curated place','Tempat pilihan'),health:text('Health facility','Fasilitas kesehatan'),schools:text('School','Sekolah')}[row.kind];
      el('span',kind+' · '+(row.context||'')+' · '+(row.sourceDate||text('Observation date unknown','Tanggal pengamatan tidak diketahui')),button);
      button.onclick=()=>{container.open=false;map.flyTo({center:row.point,zoom:16,pitch:map.getPitch(),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:250});options.place({lng:row.point[0],lat:row.point[1]});};
    }
  });
  download.addEventListener('click',()=>{
    const bounds=map.getBounds(),snapshot=options.snapshot();
    const data=exportView(snapshot,[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()]);
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/geo+json'}));
    const a=document.createElement('a');a.href=url;a.download='jakarta-view-'+new Date().toISOString().slice(0,10)+'.geojson';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status.textContent=data.features.length+' '+text('vector features exported; dates and exclusions are in the file.','fitur vektor diekspor; tanggal dan pengecualian ada di berkas.');
  });
  window.addEventListener('atlas:language',()=>{translate();list.replaceChildren();status.textContent='';});
}
