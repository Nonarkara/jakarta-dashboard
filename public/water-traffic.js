import {waterOverlayAnchor} from './water-layer-order.js';
import {createPolderBudget} from './polder-budget.js';
import {createWaterContext} from './water-context.js?v=coastal-worldcover-v1';
// Lazy map lenses: mapped hydrography, dated gauges/model flow, public traffic-camera references.
export function volumeM3(dischargeM3s,hours) {
  return Number.isFinite(dischargeM3s)&&dischargeM3s>=0&&Number.isFinite(hours)&&hours>0&&hours<=168?dischargeM3s*hours*3600:null;
}
export function approachSector(lng,lat) {
  const dx=lng-106.8272,dy=lat+6.1754;
  if(Math.hypot(dx,dy)<0.025)return ['Central city','Pusat kota'];
  const names=[['North','Utara'],['North-east','Timur laut'],['East','Timur'],['South-east','Tenggara'],['South','Selatan'],['South-west','Barat daya'],['West','Barat'],['North-west','Barat laut']];
  return names[(Math.round(Math.atan2(dx,dy)*4/Math.PI)+8)%8];
}
// Only the known hydrology failure envelope can retain dated observations.
export function isDatedHydrologyEnvelope(data) {
  return data?.contract==='hydrology-v1' && data.available===false && data.freshLevels===0 &&
    typeof data.checkedAt==='string' && Number.isFinite(Date.parse(data.checkedAt)) &&
    Array.isArray(data.predictions) && data.predictions.length===0 && Array.isArray(data.stations) && data.stations.length<=1000 &&
    data.stations.every(s=>typeof s.id==='string' && typeof s.name==='string' && typeof s.basin==='string' &&
      Number.isFinite(s.lng) && s.lng>=106.4 && s.lng<=107.2 && Number.isFinite(s.lat) && s.lat>=-6.9 && s.lat<=-5.9 &&
      s.fresh===false && ['stale','unknown'].includes(s.levelState) && (s.levelM===null || Number.isFinite(s.levelM)) &&
      (s.observedAt===null || typeof s.observedAt==='string' && Number.isFinite(Date.parse(s.observedAt))) &&
      s.tier==='publisher-gauge-level' && s.sourceUrl==='https://ewscilicis.id');
}
export async function readObservationResponse(response,path) {
  if(response.ok)return response.json();
  if(path==='/api/atlas/hydrology' && response.status===503){const data=await response.json();if(isDatedHydrologyEnvelope(data))return data;}
  throw new Error('source '+response.status);
}
export function validPolderReference(data,manifest) {
  if(!manifest?.outputCRS?.startsWith('EPSG:4326')||!Number.isInteger(manifest.count)||manifest.count<1||manifest.count>1000||data?.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length!==manifest.count)return false;
  function coordinates(c,depth){if(!Array.isArray(c)||!c.length)return false;if(depth===0)return c.length>=2&&c.every(Number.isFinite)&&c[0]>=105&&c[0]<=108&&c[1]>=-8&&c[1]<=-5;return c.every(child=>coordinates(child,depth-1));}
  return data.features.every(f=>['Polygon','MultiPolygon'].includes(f?.geometry?.type)&&coordinates(f.geometry.coordinates,f.geometry.type==='Polygon'?2:3));
}
// Re-evaluate the source reading against the display clock, including open tabs.
export function gaugeState(row, now=Date.now()) {
  const at=Date.parse(row?.observedAt);
  if(!Number.isFinite(row?.levelM)||!Number.isFinite(at)||at>now+300000)return 'unknown';
  return now-at>=3*3600000||row.levelState==='stale'?'stale':row.levelState==='fresh'?'fresh':'unknown';
}
export function createController(map,{text:t,active,buildTag}) {
  let waterContext=null,polderBudget=null,budgetBody=null,budgetDetails=null,budgetStarted=false;
  const budgetState={id:null,forcing:'forecast',runoff:'100',pump:'0',initial:'0',space:'',storm:'50',hour:'24'};
  let mode=null,epoch=0,water=null,cameras=null,hydrology=null,jaxa=null,nasa=null,lastBody=null;
  let gaugeTimer=null,gaugeVisibility=null,selectedGauge=null;
  const listeners=[]; let player=null, video=null, playRequest=0;
  const pending=new Set();
  async function get(path){const c=new AbortController();const timer=setTimeout(()=>c.abort(new Error('timeout')),12000);pending.add(c);lastBody?.setAttribute('aria-busy','true');try{const response=await fetch(path,{headers:{accept:'application/json'},signal:c.signal});return await readObservationResponse(response,path);}finally{clearTimeout(timer);pending.delete(c);lastBody?.setAttribute('aria-busy',String(pending.size>0));}}
  function cancelPending(){for(const c of pending)c.abort(new Error('lens closed'));}
  const ids=['network-water-fill','network-water-lines','network-water-labels','network-gauges','network-cameras','network-clusters','network-counts','network-comparison','official-drain-lines','official-polder-fill','official-polder-lines','network-landcover'];
  const safeUrl=u=>{try{const url=new URL(u);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}};
  const el=(tag,content,cls)=>{const node=document.createElement(tag);if(content!==undefined)node.textContent=content;if(cls)node.className=cls;return node;};
  const number=(n,d=1)=>Number.isFinite(n)?n.toLocaleString(t('en-GB','id-ID'),{maximumFractionDigits:d}):t('Unavailable','Tidak tersedia');
  const time=v=>v?new Date(v).toLocaleString(t('en-GB','id-ID'),{timeZone:'Asia/Jakarta'})+' WIB':t('Undated / rejected','Tanpa tanggal / ditolak');
  function link(label,url){const a=el('a',label);const href=safeUrl(url);if(href)a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;}
  function note(parent,en,id){parent.append(el('p',t(en,id),'note'));}
  function button(parent,label,run){const b=el('button',label);b.type='button';b.addEventListener('click',run);parent.append(b);return b;}
  function section(parent,en,id){const details=el('details');details.append(el('summary',t(en,id)));const body=el('div',undefined,'network-section');details.append(body);parent.append(details);return body;}
  function on(event,id,callback){map.on(event,id,callback);listeners.push([event,id,callback]);}
  function focusFeature(feature,body){const c=feature.geometry.type==='Point'?feature.geometry.coordinates:null;if(c)map.flyTo({center:c,zoom:14,pitch:35});document.getElementById('atlas-lens-evidence').open=true;body.scrollIntoView({block:'nearest'});}
  function removeLayers(){for(const id of ids)if(map.getLayer(id))map.removeLayer(id);for(const id of ids)if(map.getSource(id))map.removeSource(id);for(const [event,id,callback] of listeners)map.off(event,id,callback);listeners.length=0;}
  function clear(){lastBody?.setAttribute('aria-busy','false');polderBudget?.clear();polderBudget=null;budgetBody=null;budgetDetails=null;budgetStarted=false;if(gaugeTimer!==null)clearTimeout(gaugeTimer);gaugeTimer=null;if(gaugeVisibility)document.removeEventListener('visibilitychange',gaugeVisibility);gaugeVisibility=null;selectedGauge=null;epoch++;waterContext?.clear();waterContext=null;playRequest++;mode=null;cancelPending();removeLayers();lastBody=null;player?.destroy();player=null;if(video){video.pause();video.removeAttribute("src");video.load();video=null;}}
  function pointLayer(id,data,paint,cluster=false){map.addSource(id,{type:'geojson',data,cluster,clusterRadius:40,clusterMaxZoom:14});const layer={id,type:'circle',source:id,paint};if(cluster)layer.filter=['!', ['has','point_count']];map.addLayer(layer);}
  function gaugeFeature(row){return {type:'Feature',geometry:{type:'Point',coordinates:[row.lng,row.lat]},properties:{id:row.id,name:row.name,levelM:row.levelM,observedAt:row.observedAt,basin:row.basin}};}
  function featureCollection(features){return {type:'FeatureCollection',features};}
  const kindLabel=kind=>t(...({river:['River','Sungai'],canal:['Canal','Kanal'],stream:['Stream','Anak sungai'],drain:['Drain','Saluran'],ditch:['Ditch','Parit'],waterbody:['Water body','Badan air'],'waterbody-edge':['Water edge','Tepi air']}[kind]||[kind,kind]));
  function renderWaterSelection(parent,feature){selectedGauge=null;
    parent.replaceChildren();const p=feature.properties;parent.append(el('h3',p.name||t('Unnamed mapped waterway','Alur air terpetakan tanpa nama')));
    parent.append(el('p',kindLabel(p.kind)+' · '+(p.lengthM?number(Number(p.lengthM)/1000,2)+' km':t('Mapped water-body polygon','Poligon badan air terpetakan'))));
    note(parent,'Geometry follows OpenStreetMap. Length is computed along its original geometry. No discharge or measured flow direction is attached to this line.','Geometri mengikuti OpenStreetMap. Panjang dihitung sepanjang geometri aslinya. Garis ini tidak memiliki debit atau arah aliran terukur.');
    parent.append(link('OpenStreetMap ↗','https://www.openstreetmap.org/way/'+p.id));
  }
  function renderGauge(parent,row){
    parent.replaceChildren();parent.append(el('h3',row.name));const [en,id]=approachSector(row.lng,row.lat);
    parent.append(el('p',row.basin+' · '+t(en,id)+' '+t('of Monas','dari Monas')));
    selectedGauge={parent,row};const state=gaugeState(row);
    const stateText=state==='fresh'?t('Current level · under 3 h old','Tinggi terkini · di bawah 3 jam'):state==='stale'?t('Dated evidence · 3 h old or more, not a current level','Bukti bertanggal · 3 jam atau lebih, bukan tinggi terkini'):t('No usable level at this gauge','Tidak ada tinggi yang dapat dipakai di pos ini');
    parent.append(el('p',number(row.levelM,2)+' '+t('m at local gauge datum','m pada datum pos setempat')+' · '+time(row.observedAt)));
    parent.append(el('p',stateText,state==='fresh'?'network-state network-state--fresh':'network-state'));
    parent.append(el('p',row.lat.toFixed(5)+', '+row.lng.toFixed(5),'network-location'));
    note(parent,'Sector is station position, not a measured inflow vector. A level is not flow velocity or m³/s. Stations along the same river must not be added together.','Sektor menunjukkan posisi pos, bukan vektor air masuk terukur. Tinggi air bukan kecepatan aliran atau m³/s. Pos sepanjang sungai yang sama tidak boleh dijumlahkan.');
    parent.append(link('BBWS / EWS ↗',row.sourceUrl));
  }
  function calculator(parent,predictions){
    parent.append(el('h3',t('Water volume across one section','Volume air melewati satu penampang')));
    const choose=el('select');choose.setAttribute('aria-label',t('Discharge reference','Referensi debit'));choose.append(new Option(t('Enter a discharge assumption','Masukkan asumsi debit'),''));
    predictions.forEach((p,i)=>choose.append(new Option(p.name+' · '+number(p.dischargeM3s)+' m³/s · '+time(p.validAt),String(i))));parent.append(choose);
    const controls=el('div',undefined,'network-calculator');
    const q=el('input');q.type='number';q.min='0';q.max='10000';q.step='0.01';q.placeholder='m³/s';q.setAttribute('aria-label',t('Assumed constant discharge m³/s','Asumsi debit tetap m³/s'));
    const hours=el('input');hours.type='number';hours.min='0.1';hours.max='168';hours.step='0.5';hours.value='1';hours.setAttribute('aria-label',t('Duration hours','Durasi jam'));
    for(const [label,input] of [[t('Discharge · m³/s','Debit · m³/s'),q],[t('Duration · hours','Durasi · jam'),hours]]){const l=el('label',label);l.append(input);controls.append(l);}
    parent.append(controls);const output=el('output');output.setAttribute('aria-live','polite');parent.append(output);const source=el('p',undefined,'note');parent.append(source);
    function update(){const value=q.value.trim()?volumeM3(Number(q.value),Number(hours.value)):null;output.textContent=value===null?t('Enter a valid discharge and duration','Masukkan debit dan durasi yang valid'):number(value,0)+' m³ · '+number(value/1000000,3)+' '+t('million m³','juta m³');}
    choose.addEventListener('change',()=>{const p=choose.value!==''?predictions[Number(choose.value)]:null;q.value=p?String(p.dischargeM3s):'';source.textContent=p?t('Publisher prediction, valid at ','Prediksi penerbit, berlaku pada ')+time(p.validAt)+' · '+p.source:t('User assumption','Asumsi pengguna');update();});
    q.addEventListener('input',()=>{choose.value='';source.textContent=t('User assumption','Asumsi pengguna');update();});hours.addEventListener('input',update);update();
    note(parent,'V = Q × duration. This assumes constant flow at one section; it is not a measured city inflow total or flood-volume forecast. Predicted upstream/downstream stations are serial, not independent tributaries.','V = Q × durasi. Debit dianggap tetap pada satu penampang; bukan total air masuk kota terukur atau prakiraan volume banjir. Pos hulu/hilir berurutan, bukan anak sungai independen.');
  }
  async function comparison(parent,token){
    parent.append(el('h3',t('Compare with water evidence','Bandingkan dengan bukti air')));
    const select=el('select');select.setAttribute('aria-label',t('Water comparison layer','Lapisan pembanding air'));select.append(new Option(t('Mapped network only','Jaringan terpetakan saja'),'none'));parent.append(select);
    const caption=el('p',undefined,'note');parent.append(caption);const status=el('p',undefined,'note');parent.append(status);
    const [n,j]=await Promise.allSettled([get('/api/atlas/environment'),get('/api/atlas/jaxa-water')]);if(token!==epoch)return;
    nasa=n.status==='fulfilled'?n.value.products?.find(p=>p.id==='surface-water'&&p.available):null;jaxa=j.status==='fulfilled'&&j.value.available?j.value:null;
    if(nasa)select.append(new Option('NASA MODIS · '+nasa.date,'nasa'));
    if(jaxa){select.append(new Option(t('JAXA · model discharge','JAXA · debit model'),'OUTFLW'));select.append(new Option(t('JAXA · model flood fraction','JAXA · fraksi banjir model'),'FLDFRC'));}
    status.textContent=t('NASA: ','NASA: ')+(nasa?nasa.date:t('unavailable','tidak tersedia'))+' · JAXA: '+(jaxa?time(jaxa.validAt):t('unavailable','tidak tersedia'));
    select.addEventListener('change',()=>{
      if(token!==epoch)return;if(map.getLayer('network-comparison'))map.removeLayer('network-comparison');if(map.getSource('network-comparison'))map.removeSource('network-comparison');
      if(select.value==='none'){caption.textContent='';return;}
      const isNasa=select.value==='nasa';const tiles=isNasa?nasa.tiles:[`/api/atlas/jaxa-tile?product=${select.value}&date=${jaxa.date}&z={z}&x={x}&y={y}`];
      map.addSource('network-comparison',{type:'raster',tiles,tileSize:256,maxzoom:isNasa?nasa.maxzoom:9,attribution:isNasa?'NASA LANCE / GIBS':'JAXA/EORC Today’s Earth'});
      map.addLayer({id:'network-comparison',type:'raster',source:'network-comparison',paint:{'raster-opacity':0.65}},waterOverlayAnchor(map));
      caption.textContent=isNasa?t('NASA MODIS 3-day classification, 250 m: cyan water, red detected flood, yellow recurring flood. Clouds and narrow drains limit detection; not confirmation of depth or incoming volume.','Klasifikasi 3 hari NASA MODIS, 250 m: biru muda air, merah banjir terdeteksi, kuning banjir berulang. Awan dan saluran sempit membatasi deteksi; bukan konfirmasi kedalaman atau volume masuk.')+' · '+nasa.date:t('JAXA satellite-informed model, approximately 10 km. Not observed water. ','Model JAXA berbasis satelit, sekitar 10 km. Bukan air teramati. ')+time(jaxa.validAt)+' · '+(select.value==='OUTFLW'?'0–1,000 m³/s':t('0–1 flood fraction','Fraksi banjir 0–1'));
    });
    note(parent,'A satellite water extent cannot confirm water volume or flow direction by itself. Compare observation dates and independent gauge readings. Blank or cloudy pixels are unknown.','Luasan air satelit saja tidak dapat memastikan volume atau arah aliran. Bandingkan tanggal pengamatan dan pembacaan pos independen. Piksel kosong atau berawan tidak diketahui.');
    parent.append(link('NASA product ↗','https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/'));parent.append(link('JAXA documentation ↗','https://www.eorc.jaxa.jp/water/documents.html'));
  }
  async function showOfficialNetworks(parent,selected,token){
    parent.append(el('p',t('Loading official drainage references…','Memuat referensi drainase resmi…')));
    const [drains,polders,polygons]=await Promise.allSettled([
      get('/data/jakarta-v1/official-drainage-manifest.json?v='+buildTag),
      get('/data/jakarta-v1/official-polders-manifest.json?v='+buildTag),
      get('/data/jakarta-v1/official-polders.geojson?v='+buildTag)
    ]);
    if(token!==epoch)return;
    parent.replaceChildren();
    const d=drains.status==='fulfilled'?drains.value:null;
    const p=polders.status==='fulfilled'?polders.value:null;
    const data=polygons.status==='fulfilled'?polygons.value:null;
    function toggle(label,layers){const row=el('label');const input=el('input');input.type='checkbox';input.checked=true;input.addEventListener('change',()=>{for(const id of layers)if(map.getLayer(id))map.setLayoutProperty(id,'visibility',input.checked?'visible':'none');});row.append(input,document.createTextNode(label));parent.append(row);}
    if(d&&Number.isInteger(d.count)&&d.count>0&&d.count<=100000&&d.outputCRS?.startsWith('EPSG:4326')){
      map.addSource('official-drain-lines',{type:'vector',url:'pmtiles://'+location.origin+'/jakarta-official-drainage.pmtiles?v='+encodeURIComponent(buildTag),attribution:'Jakarta Satu / DSDA'});
      map.addLayer({id:'official-drain-lines',type:'line',source:'official-drain-lines','source-layer':'official_drains',minzoom:11,paint:{'line-color':'#79c2d1','line-width':['interpolate',['linear'],['zoom'],11,0.6,16,2],'line-opacity':0.8}},map.getLayer('network-water-lines')?'network-water-lines':undefined);
      toggle(number(d.count,0)+' '+t('official micro-drain lines · zoom 11+','garis saluran mikro resmi · zoom 11+'),['official-drain-lines']);
      parent.append(el('p',t('Source date unknown · retrieved ','Tanggal sumber tidak diketahui · diambil ')+time(d.retrievedAt),'meta'));
      on('click','official-drain-lines',event=>{
        const f=event.features?.[0];if(!f)return;const props=f.properties||{};selectedGauge=null;selected.replaceChildren();
        selected.append(el('h3',props.name||t('Official micro-drain','Saluran mikro resmi')));
        selected.append(el('p','DSDA · OBJECTID '+String(props.OBJECTID??props.id??'—')));
        note(selected,'Publisher line geometry. Capacity, connectivity, flow direction and operation are unknown. Administrative names have not been spatially reconciled.','Geometri garis penerbit. Kapasitas, konektivitas, arah aliran, dan operasi tidak diketahui. Nama administrasi belum dicocokkan secara spasial.');
        const coordinates=el('p',event.lngLat.lat.toFixed(5)+', '+event.lngLat.lng.toFixed(5)+' · WGS84','network-location');selected.append(coordinates);
        selected.append(link('Jakarta Satu / DSDA ↗',d.sourceUrl));selected.parentElement.open=true;document.getElementById('atlas-lens-evidence').open=true;
      });
    }else note(parent,'Official drains unavailable. OSM references remain visible.','Saluran resmi tidak tersedia. Referensi OSM tetap terlihat.');
    if(validPolderReference(data,p)){
      map.addSource('official-polder-lines',{type:'geojson',data,attribution:'Jakarta Satu / DSDA'});
      map.addLayer({id:'official-polder-fill',type:'fill',source:'official-polder-lines',paint:{'fill-color':'#79c2d1','fill-opacity':0.08}},map.getLayer('network-water-fill')?'network-water-fill':undefined);
      map.addLayer({id:'official-polder-lines',type:'line',source:'official-polder-lines',paint:{'line-color':'#79c2d1','line-width':2,'line-dasharray':[3,2]}},map.getLayer('network-water-lines')?'network-water-lines':undefined);
      toggle(number(p.count,0)+' '+t('publisher polder boundaries','batas polder penerbit'),['official-polder-fill','official-polder-lines']);
      parent.append(el('p',t('Source date unknown · retrieved ','Tanggal sumber tidak diketahui · diambil ')+time(p.retrievedAt)+' · '+number(p.sourceInvalidPolygonCount||0,0)+' '+t('publisher polygons with geometry issues','poligon penerbit dengan masalah geometri'),'meta'));
      on('click','official-polder-lines',event=>{const props=event.features?.[0]?.properties;if(!props)return;selectedGauge=null;selected.replaceChildren();selected.append(el('h3',props.NAMOBJ||t('Polder reference','Referensi polder')));selected.append(el('p','OBJECTID '+String(props.OBJECTID??'—')));note(selected,'Publisher reference boundary, not an observed flood or a protection guarantee. Some source geometry is invalid; no flood area or capacity is computed.','Batas referensi penerbit, bukan banjir teramati atau jaminan perlindungan. Sebagian geometri sumber tidak valid; luas banjir atau kapasitas tidak dihitung.');selected.append(link('Jakarta Satu / DSDA ↗',p.sourceUrl));const budgetButton=button(selected,t('Test this boundary water budget','Uji neraca air batas ini'),()=>openBudget(props.OBJECTID));budgetButton.disabled=p.invalidObjectIds?.includes(Number(props.OBJECTID))===true;selected.parentElement.open=true;document.getElementById('atlas-lens-evidence').open=true;});
    }else note(parent,'Polder boundaries unavailable. Other water evidence remains visible.','Batas polder tidak tersedia. Bukti air lain tetap terlihat.');
    note(parent,'Thin lines: official micro-drains. Dashed boundaries: polders. These references are separate from OSM and are not a connected hydraulic model.','Garis tipis: saluran mikro resmi. Batas putus-putus: polder. Referensi ini terpisah dari OSM dan bukan model hidraulik yang terhubung.');
  }
  function openBudget(id){
    if(!budgetBody||!polderBudget)return;
    budgetDetails.open=true;budgetStarted=true;
    void polderBudget.show(budgetBody,id);
  }
  async function showWater(body,token){
    body.replaceChildren();
    const waterSummary=el('p',undefined,'note'),waterDescription=el('p',undefined,'note'),kinds=el('p',undefined,'note water-legend');
    waterSummary.setAttribute('role','status');
    // The legend is the breakdown of the count above it, so it belongs directly
    // under it. It used to be appended after the coastal and land-cover
    // sections — six elements below the count it explained, where it belonged
    // to neither — and because the count now arrives on its own, the legend
    // was an empty paragraph holding a line of space for the whole load.
    kinds.hidden=true;
    body.append(waterSummary,kinds,waterDescription);
    const selected=section(body,'Selected waterway / gauge','Alur air / pos terpilih');
    let mappedLoading=false;
    async function loadMappedWaterways(){
      if(mappedLoading||token!==epoch)return;mappedLoading=true;
      waterSummary.textContent=t('Loading mapped waterways…','Memuat alur air terpetakan…');
      try{
        const candidate=water||await get('/data/jakarta-v1/waterways.geojson?v='+buildTag);
        if(token!==epoch)return;
        if(candidate?.type!=='FeatureCollection'||!Array.isArray(candidate.features)||candidate.crs!=='EPSG:4326')throw Error('waterway reference');
        water=candidate;
        // The static reference may arrive after gauges or official drainage. Keep
        // its water fill beneath those independent evidence layers in either order.
        const before=waterOverlayAnchor(map);
        map.addSource('network-water-lines',{type:'geojson',data:water,attribution:'© OpenStreetMap contributors'});
        map.addLayer({id:'network-water-fill',type:'fill',source:'network-water-lines',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#28a8c6','fill-opacity':0.4}},before);
        map.addLayer({id:'network-water-lines',type:'line',source:'network-water-lines',paint:{'line-color':['match',['get','kind'],'river','#28a8c6','canal','#28a8c6','#79c2d1'],'line-width':['interpolate',['linear'],['zoom'],9,1.2,15,4],'line-opacity':0.9}},before);
        map.addLayer({id:'network-water-labels',type:'symbol',source:'network-water-lines',minzoom:12,filter:['!=',['get','name'],''],layout:{'symbol-placement':'line','text-field':['get','name'],'text-size':11},paint:{'text-color':'#28a8c6','text-halo-color':'#071f2e','text-halo-width':1}},before);
        waterSummary.textContent=number(water.count,0)+' '+t('mapped features','fitur terpetakan')+' · OSM '+water.sourceAsOf;
        waterDescription.textContent=t('Rivers, canals, streams, drains, ditches and mapped water bodies. This covers the published OSM ways in the Jakarta extent, not every physical waterway.','Sungai, kanal, anak sungai, saluran, parit, dan badan air terpetakan. Mencakup way OSM yang dipublikasikan pada wilayah Jakarta, bukan setiap alur air fisik.');
        kinds.textContent=t('By kind','Per jenis')+' · '+Object.entries(water.kinds||{}).map(([k,n])=>kindLabel(k)+' '+number(n,0)).join(' · ');
        kinds.hidden=false;
        on('click','network-water-lines',event=>{const f=event.features?.[0];if(!f)return;renderWaterSelection(selected,f);selected.parentElement.open=true;document.getElementById('atlas-lens-evidence').open=true;});
      }catch{
        if(token!==epoch)return;water=null;
        for(const id of ['network-water-labels','network-water-lines','network-water-fill'])if(map.getLayer(id))map.removeLayer(id);
        if(map.getSource('network-water-lines'))map.removeSource('network-water-lines');
        waterSummary.textContent=t('OSM waterways unavailable. Independent official drainage and gauge sources are checked below.','Alur air OSM tidak tersedia. Sumber drainase resmi dan pos independen diperiksa di bawah.');
        waterDescription.textContent='';kinds.textContent='';kinds.hidden=true;
        button(waterSummary,t('Retry mapped waterways','Coba lagi alur air terpetakan'),loadMappedWaterways).className='network-retry';
      }finally{mappedLoading=false;}
    }
    void loadMappedWaterways();
    map.flyTo({center:[106.83,-6.23],zoom:9.6,pitch:0,bearing:0});
    budgetBody=section(body,'Rain → polder water budget','Hujan → neraca air polder');budgetBody.className+=' polder-budget';budgetDetails=budgetBody.parentElement;
    polderBudget=createPolderBudget(map,{text:t,isCurrent:()=>token===epoch&&active()==='waterways',state:budgetState,buildTag});
    budgetDetails.addEventListener('toggle',()=>{if(budgetDetails?.open&&!budgetStarted)openBudget();});
    showOfficialNetworks(section(body,'Official drainage & polders','Drainase resmi & polder'),selected,token).catch(()=>{if(token===epoch)note(body,'Official network references unavailable; other water sources remain usable.','Referensi jaringan resmi tidak tersedia; sumber air lain tetap dapat digunakan.');});
    const context=waterContext=createWaterContext(map,{text:t,get,isCurrent:()=>token===epoch,buildTag});
    context.coastal(section(body,'Coastal tide forecast · Priok','Prakiraan pasang surut pesisir · Priok'));
    context.landCover(section(body,'Land cover · WorldCover 2021','Tutupan lahan · WorldCover 2021'));
    const measure=section(body,'Incoming water · gauges & volume','Air masuk · pos & volume');
    measure.append(el('p',t('Loading publisher readings…','Memuat pembacaan penerbit…')));
    comparison(section(body,'Satellite & model comparison','Perbandingan satelit & model'),token).catch(()=>{});
    try {hydrology=await get('/api/atlas/hydrology');}catch{hydrology={stations:[],predictions:[],available:false};}
    if(!hydrology.stations?.length){let reference;try{reference=await get('/data/jakarta-v1/hydrology-reference.json?v='+buildTag);}catch{reference={stations:[],checkedAt:null};}hydrology={...hydrology,stations:reference.stations.map(s=>({...s,levelM:null,observedAt:null,levelState:'unknown',sourceUrl:reference.sourceUrl})),checkedAt:hydrology.checkedAt||reference.checkedAt,predictions:hydrology.predictions||[]};}if(token!==epoch)return;
    measure.replaceChildren();
    const fresh=hydrology.stations.filter(s=>gaugeState(s)==='fresh').length;
    const dated=hydrology.stations.filter(s=>gaugeState(s)==='stale').length;
    const summary=el('p',number(fresh,0)+' '+t('current levels','tinggi terkini')+' · '+number(dated,0)+' '+t('kept as dated evidence','disimpan sebagai bukti bertanggal')+' · '+number(hydrology.stations.length-fresh-dated,0)+' '+t('without a usable level','tanpa tinggi terpakai')+' / '+number(hydrology.stations.length,0)+' '+t('gauges','pos')+' · '+time(hydrology.checkedAt));measure.append(summary);
    const ageButtons=[];
    note(measure,'Gauge levels use local datums. A reading older than three hours is dated evidence, never a current level — a trial display policy, not a provider service interval. Invalid future timestamps are excluded. No city-wide measured inflow or direction is available from these levels.','Tinggi pos memakai datum setempat. Pembacaan lebih dari tiga jam adalah bukti bertanggal, bukan tinggi terkini — kebijakan tampilan percobaan, bukan interval layanan penyedia. Waktu masa depan yang tidak valid dikeluarkan. Pembacaan ini tidak memberikan total air masuk atau arah aliran kota terukur.');
    if(hydrology.stations.length){
      pointLayer('network-gauges',featureCollection(hydrology.stations.map(gaugeFeature)),{'circle-radius':5,'circle-color':'#d74841','circle-stroke-color':'#fff','circle-stroke-width':1});
      on('click','network-gauges',event=>{const row=hydrology.stations.find(s=>s.id===event.features?.[0]?.properties.id);if(row){renderGauge(selected,row);selected.parentElement.open=true;document.getElementById('atlas-lens-evidence').open=true;}});
      const list=section(measure,'Gauge positions & readings','Posisi pos & pembacaan');
      for(const row of hydrology.stations){const [en,id]=approachSector(row.lng,row.lat);const state=gaugeState(row);const stateLabel=state==='fresh'?t('current','terkini'):state==='stale'?t('dated evidence','bukti bertanggal'):t('no usable level','tanpa tinggi terpakai');const item=button(list,row.name+' · '+row.basin+' · '+t(en,id)+' · '+number(row.levelM,2)+' m · '+stateLabel+' · '+time(row.observedAt),()=>{renderGauge(selected,row);selected.parentElement.open=true;focusFeature(gaugeFeature(row),selected);});ageButtons.push({item,row,prefix:row.name+' · '+row.basin+' · '+t(en,id)+' · '+number(row.levelM,2)+' m · '});}
    }
    const reAge=()=>{
      if(token!==epoch||mode!=='waterways')return;
      const f=hydrology.stations.filter(r=>gaugeState(r)==='fresh').length;
      const d=hydrology.stations.filter(r=>gaugeState(r)==='stale').length;
      summary.textContent=number(f,0)+' '+t('current levels','tinggi terkini')+' · '+number(d,0)+' '+t('kept as dated evidence','disimpan sebagai bukti bertanggal')+' · '+number(hydrology.stations.length-f-d,0)+' '+t('without a usable level','tanpa tinggi terpakai')+' / '+number(hydrology.stations.length,0)+' '+t('gauges','pos')+' · '+time(hydrology.checkedAt);
      for(const {item,row,prefix} of ageButtons){const state=gaugeState(row);item.textContent=prefix+(state==='fresh'?t('current','terkini'):state==='stale'?t('dated evidence','bukti bertanggal'):t('no usable level','tanpa tinggi terpakai'))+' · '+time(row.observedAt);}
      if(selectedGauge)renderGauge(selectedGauge.parent,selectedGauge.row);
      scheduleAge();
    };
    const scheduleAge=()=>{
      if(gaugeTimer!==null)clearTimeout(gaugeTimer);gaugeTimer=null;
      const deadlines=hydrology.stations.filter(r=>gaugeState(r)==='fresh').map(r=>Date.parse(r.observedAt)+3*3600000-Date.now());
      if(deadlines.length){gaugeTimer=setTimeout(reAge,Math.max(1,Math.min(...deadlines)));gaugeTimer?.unref?.();}
    };
    scheduleAge();
    gaugeVisibility=()=>{if(!document.hidden)reAge();};document.addEventListener('visibilitychange',gaugeVisibility);
    const predicted=section(measure,'Predicted discharge by upstream section','Prediksi debit per penampang hulu');
    note(predicted,'Each row has its own valid time. Directions below are geographic sectors of exactly matched station locations, not measured water vectors. Unmatched locations remain unknown.','Setiap baris memiliki waktu berlaku tersendiri. Arah di bawah adalah sektor geografis lokasi pos yang cocok persis, bukan vektor air terukur. Lokasi yang belum cocok tetap tidak diketahui.');
    for(const row of hydrology.predictions||[]){const sector=Number.isFinite(row.lng)&&Number.isFinite(row.lat)?t(...approachSector(row.lng,row.lat)):t('Location not matched','Lokasi belum cocok');predicted.append(el('p',row.name+' · '+number(row.dischargeM3s,2)+' m³/s · '+sector+' · '+time(row.validAt)));}
    calculator(measure,hydrology.predictions||[]);
    body.append(link('OSM / ODbL ↗','https://www.openstreetmap.org/copyright'));
  }
  function renderCamera(parent,f){
    parent.replaceChildren();const p=f.properties;parent.append(el('h3',p.name));parent.append(el('p',p.address+' · '+p.city));parent.append(el('p',f.geometry.coordinates[1].toFixed(5)+', '+f.geometry.coordinates[0].toFixed(5),'network-location'));
    note(parent,'Public catalogue location; current playback is unverified. A camera picture is not a congestion-speed measurement. Video loads only when requested.','Lokasi katalog publik; pemutaran terkini belum terverifikasi. Gambar kamera bukan pengukuran kecepatan kemacetan. Video dimuat hanya saat diminta.');
    button(parent,t('Open provider player here','Buka pemutar penyedia di sini'),()=>{parent.querySelector('iframe')?.remove();const url=safeUrl(p.playerUrl);if(!url||new URL(url).hostname!=='cctv.balitower.co.id')return;const frame=el('iframe');frame.src=url;frame.title=p.name;frame.referrerPolicy='no-referrer';frame.setAttribute('allow','fullscreen');parent.append(frame);});
    parent.append(link(t('Open source ↗','Buka sumber ↗'),p.playerUrl));parent.append(link('Molecool public viewer ↗','https://gbk.molecool.id/live-cctv'));
    note(parent,'If playback is blank or restricted, use the provider link. This dashboard does not bypass sign-in or retain provider credentials.','Jika tayangan kosong atau dibatasi, gunakan tautan penyedia. Dasbor ini tidak melewati proses masuk atau menyimpan kredensial penyedia.');
  }
  async function showTraffic(body,token){
    cameras ||= await get('/data/jakarta-v1/traffic-cameras.geojson?v='+buildTag);if(token!==epoch)return;
    pointLayer('network-cameras',cameras,{'circle-radius':5,'circle-color':'#ad761f','circle-stroke-color':'#fff','circle-stroke-width':1},true);
    map.addLayer({id:'network-clusters',type:'circle',source:'network-cameras',filter:['has','point_count'],paint:{'circle-color':'#ad761f','circle-radius':['step',['get','point_count'],14,20,18,100,22],'circle-stroke-color':'#fff','circle-stroke-width':1}});
    map.addLayer({id:'network-counts',type:'symbol',source:'network-cameras',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':11},paint:{'text-color':'#fff'}});
    body.replaceChildren();body.append(el('p',number(cameras.count,0)+' '+t('camera references','referensi kamera')+' · '+t('catalogue edited','katalog diperbarui')+' '+time(cameras.catalogEditedAt)));
    note(body,'Camera coverage, not a live congestion heatmap. All points are published catalogue coordinates. Camera availability is unknown until checked at the provider.','Cakupan kamera, bukan peta panas kemacetan langsung. Seluruh titik memakai koordinat katalog terpublikasi. Ketersediaan kamera belum diketahui sebelum diperiksa pada penyedia.');
    const selected=section(body,'Selected camera','Kamera terpilih');
    const open=f=>{renderCamera(selected,f);selected.parentElement.open=true;document.getElementById('atlas-lens-evidence').open=true;};
    on('click','network-cameras',event=>{const id=event.features?.[0]?.properties.id;const f=cameras.features.find(f=>f.properties.id===id);if(f)open(f);});
    on('click','network-clusters',event=>{const f=event.features?.[0];if(!f)return;map.flyTo({center:f.geometry.coordinates,zoom:Math.min(17,map.getZoom()+2),pitch:0});});
    const search=el('input');search.type='search';search.placeholder=t('Street, camera, district…','Jalan, kamera, kecamatan…');search.setAttribute('aria-label',search.placeholder);body.append(search);const list=el('div',undefined,'network-results');body.append(list);
    function results(){const q=search.value.trim().toLocaleLowerCase();const rows=cameras.features.filter(f=>[f.properties.name,f.properties.address,f.properties.city,f.properties.district].join(' ').toLocaleLowerCase().includes(q));list.replaceChildren();list.append(el('p',number(rows.length,0)+' '+t('matches · first 30 shown; all remain on map','hasil · 30 pertama ditampilkan; semua tetap di peta'),'note'));for(const f of rows.slice(0,30))button(list,f.properties.name+' · '+f.properties.address,()=>{open(f);focusFeature(f,selected);});}search.addEventListener('input',results);results();
    const toll=section(body,'Toll-road cameras · playable streams','Kamera jalan tol · tayangan tersedia');
    note(toll,'Bina Marga / Jasa Marga public HLS streams. Kilometre labels are preserved; no exact coordinates are published, so these streams are not pinned at invented locations.','Siaran HLS publik Bina Marga / Jasa Marga. Label kilometer dipertahankan; koordinat tepat tidak dipublikasikan, sehingga tayangan tidak diberi lokasi rekaan.');
    const streamStatus=el('p',undefined,'note');toll.append(streamStatus);
    get('/data/jakarta-v1/toll-cameras.json?v='+buildTag).then(catalog=>{
      if(token!==epoch)return;streamStatus.textContent=number(catalog.count,0)+' '+t('streams · playlist checked','tayangan · playlist diperiksa')+' '+time(catalog.checkedAt);
      const cameraSelect=el('select');cameraSelect.setAttribute('aria-label',t('Toll camera','Kamera tol'));catalog.streams.forEach((stream,i)=>cameraSelect.append(new Option(stream.name,String(i))));toll.append(cameraSelect);
      button(toll,t('Load selected camera','Muat kamera terpilih'),async()=>{
        const stream=catalog.streams[Number(cameraSelect.value)];const thisPlay=++playRequest;
        if(token!==epoch)return;player?.destroy();player=null;if(video){video.pause();video.remove();}
        video=el('video');video.controls=true;video.muted=true;video.playsInline=true;video.setAttribute('aria-label',stream.name);streamStatus.after(video);const selectedVideo=video;
        const camera=new URL(stream.url).pathname.split('/')[3];const url='/api/atlas/traffic-stream/'+camera+'/index.m3u8';
        streamStatus.textContent=stream.name+' · '+t('Loading provider stream… capture time is not independently verified.','Memuat tayangan penyedia… waktu pengambilan tidak diverifikasi secara independen.');
        video.addEventListener('playing',()=>{streamStatus.textContent=stream.name+' · '+t('Provider video playing','Video penyedia diputar');selectedVideo.scrollIntoView({block:'nearest'});});
        try {
          const {default:Hls}=await import('/vendor/hls-1.7.3/hls.light.mjs');
          if(token!==epoch||thisPlay!==playRequest||video!==selectedVideo)return;
          if(Hls.isSupported()) {
            player=new Hls({enableWorker:true,lowLatencyMode:false});
            player.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal){console.warn('[traffic-playback]',data.details,data.response?.code,data.error?.message);streamStatus.textContent=t('Stream unavailable; open the official viewer.','Tayangan tidak tersedia; buka penampil resmi.')+(data.response?.code?' HTTP '+data.response.code:'');}});
            player.on(Hls.Events.MANIFEST_PARSED,()=>{if(token===epoch&&thisPlay===playRequest)selectedVideo.play().catch(()=>{});});player.loadSource(url);player.attachMedia(selectedVideo);
          } else if(selectedVideo.canPlayType('application/vnd.apple.mpegurl')) {
            selectedVideo.src=url;selectedVideo.addEventListener('canplay',()=>{if(token===epoch&&thisPlay===playRequest)selectedVideo.play().catch(()=>{});},{once:true});
          } else throw new Error('unsupported');
        }catch{streamStatus.textContent=t('Playback unavailable on this device.','Pemutaran tidak tersedia pada perangkat ini.');}
      });
      toll.append(link(t('Official toll viewer ↗','Penampil tol resmi ↗'),catalog.sourceUrl));
    }).catch(()=>{streamStatus.textContent=t('Toll catalogue unavailable.','Katalog tol tidak tersedia.');});
    const channels=section(body,'YouTube street-camera channels','Kanal kamera jalan YouTube');
    note(channels,'Channel playback is on demand and may be offline or replay. No current live broadcast was verified in the checked channel results. Multi-city channels are not assigned a precise camera point.','Pemutaran kanal sesuai permintaan dan dapat luring atau rekaman. Tidak ada siaran langsung aktif yang terverifikasi dalam hasil kanal yang diperiksa. Kanal banyak kota tidak diberi titik kamera yang presisi.');
    for(const channel of [{name:'Andi Saputra Siahaan · Jakarta Street Cam',id:'UCtJzIMo6dOPj_M5iKEZ-qQQ'},{name:'World Live Cam 24 · Indonesia / Jakarta',id:'UCXot04MO0C8-csVPqFOjAtQ'}]){
      const row=el('div');row.append(link(channel.name+' ↗','https://www.youtube.com/channel/'+channel.id+'/streams'));button(row,t('Try current channel broadcast','Coba siaran kanal saat ini'),()=>{channels.querySelector('iframe')?.remove();const frame=el('iframe');frame.src='https://www.youtube-nocookie.com/embed/live_stream?channel='+channel.id;frame.title=channel.name;frame.setAttribute('allow','fullscreen; encrypted-media');channels.append(frame);});channels.append(row);
    }
    body.append(link('ArcGIS catalogue ↗',cameras.sourceUrl));body.append(link('Dishub ATCS ↗','https://atcs-jakarta.com/index.html'));map.flyTo({center:[106.83,-6.20],zoom:10.2,pitch:0,bearing:0});
  }
  async function show(lens,body){clear();mode=lens;lastBody=body;const token=epoch;body.textContent=t('Loading mapped evidence…','Memuat bukti terpetakan…');try{await(lens==='waterways'?showWater(body,token):showTraffic(body,token));}catch{if(token===epoch){body.replaceChildren();body.append(el('p',t('This source is unavailable. No zero water or traffic is assumed.','Sumber ini tidak tersedia. Tidak diasumsikan air atau lalu lintas nol.'),'note'));button(body,t('Try again','Coba lagi'),()=>show(lens,body));}}}
  function rerender(body){if(mode&&lastBody&&active()===mode)return show(mode,body);}
  return {show,clear,rerender};
}
