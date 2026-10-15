// Independent water context: coastal forecasts and historical land cover never become hydraulics.
const WORLD_BOUNDS=[106.65,-6.4,107,-6.08];
export function validCoastal(data,now=Date.now()){
 return data?.contract==='coastal-v1'&&data.available===true&&data.stale===false&&Date.parse(data.issuedAt)<=now+300000&&now-Date.parse(data.issuedAt)<=72*3600000&&Date.parse(data.validFrom)<=now&&Date.parse(data.validTo)>now&&data.datum===null&&data.tier==='official-coastal-forecast'&&
  data.station?.code==='XJ001'&&Number.isFinite(data.station.lng)&&Number.isFinite(data.station.lat)&&
  data.station.lng>=106.7&&data.station.lng<=107&&data.station.lat>=-6.3&&data.station.lat<=-6&&
  Number.isFinite(Date.parse(data.issuedAt))&&Number.isFinite(Date.parse(data.validFrom))&&Number.isFinite(Date.parse(data.validTo))&&
  Array.isArray(data.points)&&data.points.length>0&&data.points.length<=96&&data.points.every(p=>Number.isFinite(Date.parse(p.validAt))&&Date.parse(p.validAt)>=Date.parse(data.validFrom)&&Date.parse(p.validAt)<Date.parse(data.validTo)&&Number.isFinite(p.tideM)&&p.tideM>=-20&&p.tideM<=20);
}
export function validLandCover(d){
 return d?.schema===1&&d.tier==='satellite-classification-reference'&&d.periodStart==='2021-01-01T00:00:00Z'&&Array.isArray(d.bounds)&&d.bounds.length===4&&
  d.bounds.every((v,i)=>Number.isFinite(v)&&Math.abs(v-WORLD_BOUNDS[i])<0.001)&&
  Number.isInteger(d.nativeCells)&&d.nativeCells>0&&Number.isInteger(d.nodataCells)&&d.nodataCells>=0&&d.nodataCells<d.nativeCells&&Array.isArray(d.classes)&&d.classes.length===11&&
  d.classes.every(c=>Number.isInteger(c.value)&&Number.isInteger(c.cells)&&c.cells>=0&&/^#[0-9a-f]{6}$/i.test(c.color))&&
  d.classes.reduce((n,c)=>n+c.cells,0)+d.nodataCells===d.nativeCells&&
  d.display?.path==='/data/jakarta-v1/worldcover-2021-reference.png';
}
export function createWaterContext(map,{text:t,get,isCurrent,buildTag}){
 const cleanup=[];const timers=new Set();
 function later(fn,delay){const timer=setTimeout(()=>{timers.delete(timer);if(isCurrent())fn();},delay);timers.add(timer);return timer;}
 function cancel(timer){clearTimeout(timer);timers.delete(timer);}
 function listen(event,fn){map.on(event,fn);cleanup.push(()=>map.off(event,fn));}
 const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const note=(p,en,id)=>p.append(el('p',t(en,id)));
 const num=(n,d=2)=>Number.isFinite(n)?n.toLocaleString(t('en-GB','id-ID'),{maximumFractionDigits:d}):'—';
 const time=v=>new Date(v).toLocaleString(t('en-GB','id-ID'),{timeZone:'Asia/Jakarta'})+' WIB';
 const link=(p,label,url)=>{const a=el('a',label+' ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';p.append(a);};
 function retry(parent,run){const b=el('button',t('Retry this source','Coba lagi sumber ini'));b.type='button';b.addEventListener('click',run);parent.append(b);}
 async function coastal(parent){
  parent.replaceChildren(el('p',t('Loading coastal forecast…','Memuat prakiraan pesisir…')));
  try{
   const d=await get('/api/atlas/coastal');if(!isCurrent())return;if(!validCoastal(d))throw Error('coastal contract');
   parent.replaceChildren();parent.append(el('h3',d.station.name));
   parent.append(el('p',d.station.lat.toFixed(5)+', '+d.station.lng.toFixed(5)+' · WGS84'));parent.children[parent.children.length-1].className='network-location';
   note(parent,'BMKG official forecast · metres · vertical datum not published. Keep separate from local river-gauge levels. Waves are not added to tide.','Prakiraan resmi BMKG · meter · datum vertikal tidak dipublikasikan. Terpisah dari tinggi pos sungai setempat. Gelombang tidak ditambahkan pada pasang surut.');
   parent.append(el('p',t('Issued ','Terbit ')+time(d.issuedAt)+' · '+t('valid ','berlaku ')+time(d.validFrom)+' — '+time(d.validTo)));
   const expiry=el('p');expiry.setAttribute('aria-live','polite');parent.append(expiry);
   const expireAt=Math.min(Date.parse(d.validTo),Date.parse(d.issuedAt)+72*3600000);
   later(()=>{expiry.textContent=t('Forecast expired. Dated rows below are retained; refresh this source.','Prakiraan kedaluwarsa. Baris bertanggal di bawah tetap disimpan; perbarui sumber ini.');retry(parent,()=>coastal(parent));},Math.max(1,expireAt-Date.now()));
   const table=el('table'),caption=el('caption',t('Publisher time steps · no interpolation','Langkah waktu penerbit · tanpa interpolasi'));table.append(caption);
   const head=el('thead'),hr=el('tr');for(const x of [t('Forecast time','Waktu prakiraan'),t('Tide · m','Pasang surut · m'),t('Waves · m','Gelombang · m')]){const th=el('th',x);th.scope='col';hr.append(th);}head.append(hr);table.append(head);
   const body=el('tbody');for(const p of d.points){const row=el('tr');for(const value of [time(p.validAt),num(p.tideM),num(p.waveHeightM)])row.append(el('td',value));body.append(row);}table.append(body);parent.append(table);
   link(parent,'BMKG','https://maritim.bmkg.go.id/cuaca/pelabuhan/pelabuhan-tanjung-priok');link(parent,t('API documentation','Dokumentasi API'),'https://maritim.bmkg.go.id/apidoc');
  }catch{if(!isCurrent())return;parent.replaceChildren();note(parent,'Coastal forecast unavailable. No zero tide or flood boundary is assumed.','Prakiraan pesisir tidak tersedia. Tidak diasumsikan pasang surut nol atau batas banjir.');retry(parent,()=>coastal(parent));}
 }
 async function landCover(parent){
  parent.replaceChildren(el('p',t('Loading 2021 land-cover reference…','Memuat referensi tutupan lahan 2021…')));
  try{
   const d=await get('/data/jakarta-v1/worldcover-2021-reference.json?v='+buildTag);if(!isCurrent())return;if(!validLandCover(d))throw Error('land cover contract');
   parent.replaceChildren();
   const label=el('label'),input=el('input');label.className='network-check';input.type='checkbox';input.checked=false;label.append(input,document.createTextNode(t('Show WorldCover 2021','Tampilkan WorldCover 2021')));parent.append(label);
   const status=el('p');status.setAttribute('aria-live','polite');parent.append(status);
   const again=el('button',t('Retry image','Coba lagi citra'));again.type='button';again.hidden=true;parent.append(again);let loadTimer=null;
   function failed(){if(!isCurrent())return;if(loadTimer)cancel(loadTimer);input.checked=false;again.hidden=false;status.textContent=t('Land-cover image unavailable; water layers remain usable.','Citra tutupan lahan tidak tersedia; lapisan air tetap dapat digunakan.');if(map.getLayer('network-landcover'))map.removeLayer('network-landcover');if(map.getSource('network-landcover'))map.removeSource('network-landcover');}
   listen('error',event=>{if(event.sourceId==='network-landcover'||event.error?.sourceId==='network-landcover')failed();});
   listen('sourcedata',event=>{if(event.sourceId==='network-landcover'&&event.isSourceLoaded){if(loadTimer)cancel(loadTimer);status.textContent=t('Historical land-cover image loaded.','Citra tutupan lahan historis dimuat.');}});
   function toggle(){if(!isCurrent())return;if(!input.checked){if(map.getLayer('network-landcover'))map.setLayoutProperty('network-landcover','visibility','none');return;}
    again.hidden=true;
    try{if(!map.getSource('network-landcover')){status.textContent=t('Loading image…','Memuat citra…');loadTimer=later(()=>{if(!map.getSource('network-landcover')?.loaded())failed();},12000);const [w,s,e,n]=d.bounds;map.addSource('network-landcover',{type:'image',url:d.display.path+'?v='+buildTag,coordinates:[[w,n],[e,n],[e,s],[w,s]]});map.addLayer({id:'network-landcover',type:'raster',source:'network-landcover',paint:{'raster-opacity':0.55,'raster-resampling':'nearest','raster-fade-duration':0}},map.getLayer('network-water-fill')?'network-water-fill':undefined);}else map.setLayoutProperty('network-landcover','visibility','visible');}catch{failed();}
   }
   input.addEventListener('change',toggle);again.addEventListener('click',()=>{input.checked=true;toggle();});
   note(parent,'ESA WorldCover · 2021 · native 10 m classes; 20 m nearest-sample display. Counts use all native cells in this mainland rectangle, not DKI administrative totals. Built-up is not a measured impervious fraction.','ESA WorldCover · 2021 · kelas asli 10 m; tampilan sampel terdekat 20 m. Jumlah memakai semua sel asli dalam persegi panjang daratan ini, bukan total administrasi DKI. Lahan terbangun bukan fraksi kedap air terukur.');
   const table=el('table');table.append(el('caption',t('Class share of valid reference cells','Porsi kelas dari sel referensi valid')));const tbody=el('tbody');for(const c of d.classes.filter(c=>c.cells>0)){const row=el('tr'),name=el('th',t(c.nameEn,c.nameId));name.scope='row';const key=el('span','■ ');key.style.color=c.color;name.prepend(key);row.append(name,el('td',(100*c.cells/(d.nativeCells-d.nodataCells)<0.1?t('<0.1%','<0,1%'):num(100*c.cells/(d.nativeCells-d.nodataCells),1)+'%')));tbody.append(row);}table.append(tbody);parent.append(table);
   parent.append(el('p',d.bounds.join(', ')+' · WGS84 · '+num(d.nativeCells,0)+' '+t('native cells','sel asli')+' · '+num(d.nodataCells,0)+' '+t('no data','tanpa data')));
   parent.append(el('p','© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium · CC BY 4.0'));
   link(parent,'ESA WorldCover','https://esa-worldcover.org/en/data-access');link(parent,t('Source manifest','Manifest sumber'),'/data/jakarta-v1/worldcover-2021-reference.json');
  }catch{if(!isCurrent())return;parent.replaceChildren();note(parent,'Land-cover reference unavailable. Water layers remain usable.','Referensi tutupan lahan tidak tersedia. Lapisan air tetap dapat digunakan.');retry(parent,()=>landCover(parent));}
 }
 return {coastal,landCover,clear(){for(const timer of timers)clearTimeout(timer);timers.clear();for(const off of cleanup)off();cleanup.length=0;}};
}
