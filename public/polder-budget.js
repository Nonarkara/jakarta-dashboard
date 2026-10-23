import {rainForBoundary,waterBudget,stormProfile,MAX_ACCOUNT_M3} from './polder-budget-model.js';

export function createPolderBudget(map,{text:t,isCurrent,state,buildTag}) {
 let disposed=false,parent=null,context=null,polygons=null,rain=null,loading=false,lastAttempt=0,clock=null,abort=null,view=null,opening=false;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const n=(v,d=0)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString(t('en-GB','id-ID'),{maximumFractionDigits:d}):'—';
 const time=v=>new Date(v).toLocaleString(t('en-GB','id-ID'),{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})+' WIB';
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;};
 const number=value=>value.trim()===''?null:Number(value);
 const selected=()=>context?.records.find(r=>String(r.id)===String(state.id));
 const live=()=>!disposed&&isCurrent();
 const sourceIds=['polder-budget-shape','polder-budget-cell'];
 function removeMap(){for(const id of ['polder-budget-line','polder-budget-fill','polder-budget-point'])if(map.getLayer(id))map.removeLayer(id);for(const id of sourceIds)if(map.getSource(id))map.removeSource(id);}
 function locate(fit=false){
  const row=selected();if(!row)return;removeMap();
  const feature=polygons.features.find(f=>String(f.properties.OBJECTID)===String(row.id));
  if(feature){map.addSource(sourceIds[0],{type:'geojson',data:feature});map.addLayer({id:'polder-budget-fill',type:'fill',source:sourceIds[0],paint:{'fill-color':'#28a8c6','fill-opacity':.12}});map.addLayer({id:'polder-budget-line',type:'line',source:sourceIds[0],paint:{'line-color':'#e7a655','line-width':3}});}
  const forcing=state.forcing==='forecast'?rainForBoundary(rain,row):null;
  if(forcing){map.addSource(sourceIds[1],{type:'geojson',data:{type:'Feature',geometry:{type:'Point',coordinates:forcing.modelLocation},properties:{}}});map.addLayer({id:'polder-budget-point',type:'circle',source:sourceIds[1],paint:{'circle-color':'#e7a655','circle-radius':6,'circle-stroke-color':'#102532','circle-stroke-width':2}});}
  if(fit){const [w,s,e,n]=row.bounds;const width=map.getContainer?.().clientWidth||390;map.fitBounds([[w,s],[e,n]],{padding:{top:100,bottom:40,left:width>700?420:40,right:40},maxZoom:13,duration:0});}
 }
 function exportSnapshot(result,forcing,row){
  const data={contract:'polder-budget-scenario-v1',computedAt:new Date().toISOString(),selectedHour:Number(state.hour),boundary:row,geometryRole:'Simplified display geometry. Analysis used the original DSDA polygon identified by context input hashes.',geometry:polygons.features.find(f=>String(f.properties.OBJECTID)===String(row.id)),context:{...context,records:undefined},forcing,assumptions:{runoffFraction:number(state.runoff)/100,pumpM3s:number(state.pump),initialM3:number(state.initial),freeStorageM3:number(state.space)},result,limitations:'Uncalibrated one-boundary volume account. No inundation depth, routing, tide, river exchange, operations or official pump/storage capacity. Overlapping boundaries cannot be added.'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='jakarta-polder-'+row.id+'-water-budget.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function svgNode(tag,attrs,text){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));if(text!==undefined)node.textContent=text;return node;}
 function chart(result,forcing){
  const svg=svgNode('svg',{viewBox:'0 0 360 225',role:'img','aria-label':t('Hourly rainfall above; water account below. Dashed line: no pumping. Solid line: edited scenario.','Hujan per jam di atas; neraca air di bawah. Garis putus: tanpa pompa. Garis penuh: skenario suntingan.')});
  const x=h=>48+h*12,peak=Math.max(1,result.initialM3+result.runoffM3,number(state.space)||0),y=v=>190-v/peak*98;
  const rainPeak=Math.max(1,...forcing.mm);
  svg.append(svgNode('text',{x:43,y:29,'text-anchor':'end'},n(rainPeak,1)),svgNode('text',{x:43,y:65,'text-anchor':'end'},'0'));
  svg.append(svgNode('text',{x:0,y:12},t('Rain · mm / h','Hujan · mm / jam')),svgNode('text',{x:0,y:87},t('Water to account for · m³','Air yang perlu ditampung/dibuang · m³')));
  for(let i=0;i<24;i++)svg.append(svgNode('rect',{x:x(i)+1,y:62-forcing.mm[i]/rainPeak*36,width:10,height:forcing.mm[i]/rainPeak*36,class:'budget-rain'}));
  for(const h of [0,6,12,18,24]){svg.append(svgNode('line',{x1:x(h),x2:x(h),y1:94,y2:194,class:'budget-grid'}),svgNode('text',{x:x(h),y:212,'text-anchor':'middle'},h+' h'));}
  for(const value of [0,peak/2,peak])svg.append(svgNode('text',{x:43,y:y(value)+4,'text-anchor':'end'},value.toLocaleString(t('en-GB','id-ID'),{notation:'compact',maximumFractionDigits:1})));
  const points=[[0,result.initialM3],...result.rows.map(r=>[r.hour,r.remainingM3])],baseline=[[0,result.initialM3],...result.rows.map(r=>[r.hour,result.initialM3+r.cumulativeRunoffM3])];
  for(const [series,cls] of [[baseline,'budget-baseline'],[points,'budget-account']])svg.append(svgNode('path',{d:series.map(([h,v],i)=>(i?'L':'M')+x(h)+','+y(v)).join(' '),class:cls}));
  const space=number(state.space);if(space!==null)svg.append(svgNode('line',{x1:x(0),x2:x(24),y1:y(space),y2:y(space),class:'budget-space'}));
  const h=Number(state.hour),at=h?result.rows[h-1].remainingM3:result.initialM3;svg.append(svgNode('line',{x1:x(h),x2:x(h),y1:20,y2:194,class:'budget-cursor'}),svgNode('circle',{cx:x(h),cy:y(at),r:4,class:'budget-dot'}));
  return svg;
 }
 function recompute(){
  if(!live()||!view||!selected())return;
  const row=selected(),forecast=rainForBoundary(rain,row),manual=state.forcing==='storm';
  const forcing=manual?{tier:'user-test-storm',source:t('User test storm','Hujan uji pengguna'),from:null,to:null,mm:stormProfile(number(state.storm),3)}:forecast;
  const runoff=number(state.runoff),pump=number(state.pump),initial=number(state.initial),space=number(state.space);
  const result=forcing?.mm&&runoff!==null&&pump!==null&&initial!==null?waterBudget({areaM2:row.areaM2,rainMm:forcing.mm,runoffFraction:runoff/100,pumpM3s:pump,initialM3:initial,freeStorageM3:space}):null;
  view.output.replaceChildren();view.plot.replaceChildren();view.table.replaceChildren();
  view.source.textContent=manual?t('TEST STORM · uniform rain in the first 3 h, then 21 h dry. No weather forecast.','HUJAN UJI · hujan merata pada 3 jam pertama, lalu 21 jam tanpa hujan. Bukan prakiraan cuaca.'):
   forecast?t('Uniform forcing from returned model cell ','Hujan merata diasumsikan dari sel model ')+forecast.modelLocation[1].toFixed(4)+', '+forecast.modelLocation[0].toFixed(4)+' · '+n(forecast.distanceKm,1)+' km · '+time(forecast.from)+' → '+time(forecast.to)+t(' · retrieved ',' · diambil ')+time(forecast.fetchedAt):loading?t('Loading current hourly rain…','Memuat hujan per jam terkini…'):t('No complete current rain profile within 20 km. Nothing is filled with zero. Retry or choose an explicit test storm.','Tidak ada profil hujan terkini lengkap dalam 20 km. Tidak diisi nol. Coba lagi atau pilih hujan uji secara eksplisit.');
  view.runoffLabel.textContent=t('Runoff assumption ','Asumsi limpasan ')+state.runoff+'%';view.stormField.hidden=!manual;
  view.forecastButton.setAttribute('aria-pressed',String(!manual));view.stormButton.setAttribute('aria-pressed',String(manual));
  view.exportButton.disabled=!result;
  if(!result){view.output.append(el('p',forcing?t('Enter valid assumptions. Blank values remain unknown.','Masukkan asumsi valid. Nilai kosong tetap tidak diketahui.'):t('Rainfall account unavailable','Neraca hujan tidak tersedia')));return;}
  const hour=Number(state.hour),remaining=hour?result.rows[hour-1].remainingM3:result.initialM3;
  view.output.append(el('strong',n(remaining)+' m³','budget-total'),el('p',t('to store or drain at hour ','untuk ditampung atau dibuang pada jam ')+hour));
  view.output.append(el('p',n(result.grossRainM3)+' m³ '+t('rain falling inside this boundary','hujan yang jatuh di dalam batas ini')+' · '+n(result.runoffM3)+' m³ '+t('assumed runoff','asumsi limpasan')+' · '+n(result.removedM3)+' m³ '+t('removed over 24 h under the pump assumption','dibuang selama 24 jam menurut asumsi pompa'),'meta'));
  if(result.maxAboveSpaceM3!==null)view.output.append(el('p',n(result.maxAboveSpaceM3)+' m³ '+t('maximum hourly balance above the entered available space. A scenario exceedance, not measured spill or flood depth.','neraca per jam maksimum di atas ruang tersedia yang dimasukkan. Pelampauan skenario, bukan limpasan terukur atau kedalaman banjir.'),'budget-excess'));
  view.plot.append(chart(result,forcing));view.table.append(el('caption',t('24 hourly interval ends; rain is accumulated over the preceding hour','24 akhir interval per jam; hujan diakumulasi selama jam sebelumnya')));
  const head=el('tr');for(const name of [t('Hour','Jam'),'mm',t('Removed m³','Dibuang m³'),t('Left m³','Sisa m³')])head.append(el('th',name));view.table.append(head);
  for(const r of result.rows){const tr=el('tr');for(const value of [r.hour,n(r.mm,2),n(r.pumpedM3),n(r.remainingM3)])tr.append(el('td',String(value)));view.table.append(tr);}
  view.exportButton.onclick=()=>exportSnapshot(result,forcing,row);
 }
 function render(){
  if(!live()||!parent||!context)return;const row=selected();if(!row)return;parent.replaceChildren();
  parent.append(el('p',t('Choose a boundary. Follow rain into a water-volume account. Change the pump assumption to see the difference.','Pilih batas polder. Ikuti hujan menjadi neraca volume air. Ubah asumsi pompa untuk melihat perbedaannya.')));
  const label=el('label',t('Polder boundary','Batas polder')),select=el('select');select.setAttribute('aria-label',t('Polder boundary','Batas polder'));
  for(const record of [...context.records].sort((a,b)=>a.name.localeCompare(b.name)))select.append(new Option(record.name,String(record.id)));select.value=String(state.id);label.append(select);parent.append(label);
  select.addEventListener('change',()=>{state.id=select.value;render();locate(true);});
  parent.append(el('h3',row.name),el('p',row.representativePoint[1].toFixed(5)+', '+row.representativePoint[0].toFixed(5)+' · WGS84','network-location'),el('p',n(row.areaM2/10000,1)+' ha · '+t('calculated from original publisher polygon; boundary observation date unknown','dihitung dari poligon asli penerbit; tanggal pengamatan batas tidak diketahui'),'meta'));
  const actions=el('div',undefined,'budget-actions'),forecastButton=button(t('Use rain forecast','Gunakan prakiraan hujan'),()=>{state.forcing='forecast';recompute();locate();}),stormButton=button(t('Test storm · 3 h','Hujan uji · 3 jam'),()=>{state.forcing='storm';recompute();locate();});
  const mapActions=el('div'),forcingActions=el('div');mapActions.append(button(t('Locate boundary','Lihat batas di peta'),()=>locate(true)),button(t('Refresh rain','Perbarui hujan'),refreshRain));forcingActions.append(forecastButton,stormButton);actions.append(mapActions,forcingActions);parent.append(actions);
  function input(container,labelText,key,{type='number',min=0,max,step='any'}={}){const l=el('label'),caption=el('span',labelText),field=el('input');l.append(caption);field.type=type;field.value=state[key];field.min=String(min);if(max!==undefined)field.max=String(max);field.step=step;field.setAttribute('aria-label',labelText);field.addEventListener('input',()=>{state[key]=field.value;recompute();});l.append(field);container.append(l);return [l,field,caption];}
  const fields=el('div',undefined,'budget-fields');parent.append(fields);const [stormField]=input(fields,t('Test rain total · mm over 3 h','Total hujan uji · mm selama 3 jam'),'storm',{max:1000});
  input(fields,t('Pump assumption · m³/s','Asumsi pompa · m³/detik'),'pump',{max:10000});
  const assumptions=el('details'),assumptionTitle=el('summary',t('Runoff, initial water & available space','Limpasan, air awal & ruang tersedia'));assumptions.append(assumptionTitle);parent.append(assumptions);
  const [,,runoffLabel]=input(assumptions,t('Runoff assumption · %','Asumsi limpasan · %'),'runoff',{type:'range',max:100,step:1});
  input(assumptions,t('Starting water account · m³','Neraca air awal · m³'),'initial',{max:MAX_ACCOUNT_M3});input(assumptions,t('Available space · m³ (blank = unknown)','Ruang tersedia · m³ (kosong = tidak diketahui)'),'space',{max:MAX_ACCOUNT_M3});
  assumptions.append(el('p',t('Defaults: all rain becomes runoff, no pumping, no starting water accounted. These are user assumptions, not measured operations. Pumping is available throughout each hour, capped by water present. Peaks are sampled hourly; bursts within an hour are unresolved. Land cover is not measured impermeability.','Nilai awal: semua hujan menjadi limpasan, tanpa pompa, tanpa air awal yang diperhitungkan. Ini asumsi pengguna, bukan operasi terukur. Pompa diasumsikan tersedia sepanjang jam, dibatasi air yang ada. Puncak dihitung per jam; lonjakan dalam jam belum diperhitungkan. Tutupan lahan bukan kedap air terukur.'),'meta'));
  const output=el('div'),plot=el('figure',undefined,'budget-chart'),source=el('p',undefined,'meta');parent.append(output,plot,el('p',t('Gold bars: rain. Dashed: no pumping. Blue: edited water account. Red line, if entered: available-space assumption.','Batang emas: hujan. Putus-putus: tanpa pompa. Biru: neraca air suntingan. Garis merah, jika diisi: asumsi ruang tersedia.'),'meta'));
  const hourLabel=el('label',t('Follow the 24 h account','Ikuti neraca 24 jam'));const hourInput=el('input');hourInput.type='range';hourInput.min='0';hourInput.max='24';hourInput.step='1';hourInput.value=state.hour;hourInput.setAttribute('aria-label',t('Scenario hour','Jam skenario'));hourInput.addEventListener('input',()=>{state.hour=hourInput.value;recompute();});hourLabel.append(hourInput);parent.append(hourLabel,source);
  const tableDetails=el('details'),table=el('table');tableDetails.append(el('summary',t('Read hourly values','Baca nilai per jam')),table);parent.append(tableDetails);
  const cover=el('details');cover.append(el('summary',t('2021 land context · raw → cooked','Konteks lahan 2021 · mentah → olahan')));
  cover.append(el('p',n(row.nativeCells)+' '+t('native pixel centres inside the original polygon','pusat piksel asli di dalam poligon asli')+' · '+n(row.nodataCells)+' '+t('no data','tanpa data')+'. '+t('Holes retained; boundary pixels selected by their centres. No runoff coefficient is inferred.','Lubang dipertahankan; piksel batas dipilih menurut pusatnya. Koefisien limpasan tidak disimpulkan.'),'meta'));
  const coverTable=el('table');for(const c of row.classes.filter(c=>c.cells>0)){const tr=el('tr');tr.append(el('th',t(c.nameEn,c.nameId)),el('td',n(100*c.cells/Math.max(1,row.validCells),1)+'%'));coverTable.append(tr);}cover.append(coverTable,el('p','© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium · CC BY 4.0','meta'));parent.append(cover);
  parent.append(el('p',t('One independent boundary scenario. Boundaries can overlap. No river exchange, tide, terrain, drain routing or measured pump/storage capacity is included. Water above available space is not a mapped flood.','Satu skenario batas independen. Batas dapat tumpang tindih. Tidak mencakup pertukaran sungai, pasang surut, elevasi, perutean saluran, atau kapasitas pompa/penyimpanan terukur. Air di atas ruang tersedia bukan banjir terpetakan.'),'meta'));
  const methods=el('p');for(const [title,url] of [['DSDA',context.boundarySourceUrl],['WorldCover',context.landCoverSourceUrl],[t('Calculation & hashes','Perhitungan & hash'),'/data/jakarta-v1/polder-budget-context.json']]){const a=el('a',title+' ↗');a.href=url;a.target='_blank';a.rel='noopener';methods.append(a,document.createTextNode(' · '));}parent.append(methods);
  const exportButton=button(t('Export scenario JSON','Ekspor skenario JSON'),()=>{});parent.append(exportButton);
  view={output,plot,source,table,runoffLabel,forecastButton,stormButton,stormField,exportButton};recompute();
 }
 async function refreshRain(){
  if(!live()||loading)return;loading=true;lastAttempt=Date.now();recompute();
  try{const response=await fetch('/api/atlas/rainfall',{cache:'no-store',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(20000)])});rain=response.ok?await response.json():null;}catch{rain=null;}finally{loading=false;if(live()){recompute();locate();}}
 }
 const visibility=()=>{if(!document.hidden&&live())void refreshRain();};
 async function show(target,id){
  parent=target;if(id!==undefined)state.id=String(id);if(context){if(!selected())state.id=String(context.records[0].id);render();locate(true);return;}
  if(opening)return;opening=true;
  parent.replaceChildren(el('p',t('Joining boundary and satellite reference…','Menggabungkan batas dan referensi satelit…')));abort=new AbortController();
  try{
   const [c,p]=await Promise.all(['/data/jakarta-v1/polder-budget-context.json','/data/jakarta-v1/official-polders.geojson'].map(async url=>{const r=await fetch(url+'?v='+encodeURIComponent(buildTag),{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])});if(!r.ok)throw Error('context');return r.json();}));
   if(!live())return;if(c.contract!=='polder-budget-context-v1'||!Array.isArray(c.records)||!c.records.length||!Array.isArray(p.features))throw Error('contract');context=c;polygons=p;
   if(!selected()){if(id!==undefined){parent.replaceChildren(el('p',t('This boundary is excluded from calculation because its geometry is invalid. Choose a valid boundary from the water-budget menu.','Batas ini dikecualikan dari perhitungan karena geometrinya tidak valid. Pilih batas valid dari menu neraca air.')));return;}state.id=String(context.records[0].id);}render();locate(true);void refreshRain();
   document.addEventListener('visibilitychange',visibility);clock=setInterval(()=>{if(!document.hidden&&live()){recompute();locate();if(Date.now()-lastAttempt>=300000)void refreshRain();}},30000);clock?.unref?.();
  }catch{context=null;polygons=null;view=null;if(live())parent.replaceChildren(el('p',t('Boundary/land-context join unavailable. Other water layers remain usable.','Gabungan batas/konteks lahan tidak tersedia. Lapisan air lain tetap dapat digunakan.')),button(t('Retry context','Coba lagi konteks'),()=>show(parent)));}finally{opening=false;}
 }
 return {show,clear(){disposed=true;abort?.abort();if(clock)clearInterval(clock);document.removeEventListener('visibilitychange',visibility);removeMap();view=null;}};
}
