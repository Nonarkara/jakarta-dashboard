// Fixed public sources only. No caller-selected upstream URL or credentials.
const SG_URL='https://api-open.data.gov.sg/v2/real-time/api/pm25';
const REGIONS={north:[103.82,1.41803],south:[103.82,1.29587],east:[103.94,1.35735],west:[103.7,1.35735],central:[103.82,1.35735]};
const ASMC={situation:['regional_haze','REGIONAL_HAZE_MAP','image/png'],dispersion:['asmc_smoke_haze_dispersion','ASMC_SMOKE_HAZE_DISPERSION','image/gif']};
const json=(body,status=200)=>Response.json(body,{status,headers:{'access-control-allow-origin':'*','cache-control':status===200?'public, max-age=60':'no-store'}});
export function cleanReceptors(raw,now=Date.now()) {
 const base={contract:'haze-receptors-v1',checkedAt:new Date(now).toISOString(),source:'Singapore NEA / data.gov.sg',sourceUrl:SG_URL,tier:'official-regional-observation',units:'µg/m³',averagingPeriod:'1 hour',maxAgeHours:3};
 const empty=error=>({...base,available:false,points:[],error});
 if(raw?.code!==0||!Array.isArray(raw?.data?.items)||raw.data.items.length>100)return empty('Invalid NEA envelope');
 const rows=raw.data.items.filter(r=>{const at=Date.parse(r?.timestamp);return Number.isFinite(at)&&at<=now+300000&&now-at<10800000;}).sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));
 if(!rows.length)return empty('No observation within the three-hour display window');
 const row=rows[0],values=row.readings?.pm25_one_hourly;
 const points=Object.entries(REGIONS).flatMap(([region,coordinates])=>{const value=values?.[region];return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=2000?[{region,coordinates,pm25:value,observedAt:new Date(row.timestamp).toISOString()}]:[];});
 return points.length?{...base,available:true,points}:empty('No valid numeric one-hour PM2.5 readings');
}
async function bounded(response,max) {
 if(!response.ok)throw Error('upstream');
 if(Number(response.headers.get('content-length'))>max)throw Error('size');
 const reader=response.body?.getReader();if(!reader)throw Error('body');
 let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('size');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export async function handleHazeReceptors() {
 const now=Date.now(),key=new Request('https://jakarta-atlas.internal/nea-pm25-v1');
 let cache;try{cache=caches.default;}catch{}
 try {
  let raw,hit;try{hit=await cache?.match(key);}catch{}
  if(hit){const saved=await hit.json();if(now-saved.savedAt<300000)raw=saved.raw;}
  if(!raw){const r=await fetch(SG_URL,{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000)});if(!r.headers.get('content-type')?.includes('application/json'))throw Error('type');raw=JSON.parse(new TextDecoder().decode(await bounded(r,131072)));if(cleanReceptors(raw,now).available)await cache?.put(key,Response.json({savedAt:now,raw},{headers:{'cache-control':'max-age=300'}})).catch(()=>{});}
  const data=cleanReceptors(raw,now);return json(data,data.available?200:503);
 }catch{return json({...cleanReceptors(null,now),error:'Official receptor feed unavailable; no model substituted'},503);}
}
export async function handleAsmcGraphic(request) {
 const kind=new URL(request.url).searchParams.get('product'),product=ASMC[kind];
 if(!product)return json({error:'Unknown ASMC product'},400);
 const [collection,item,type]=product;
 const key=new Request('https://jakarta-atlas.internal/asmc-graphic-v1/'+kind),now=Date.now();let cache;try{cache=caches.default;}catch{}
 try{const hit=await cache?.match(key);if(hit){const saved=Date.parse(hit.headers.get('x-graphic-retrieved-at'));if(Number.isFinite(saved)&&saved<=now+300000&&now-saved<300000)return hit;}}catch{}
 try {
  const url=`https://api.wis2.asmc.asean.org/collections/${collection}/items/${item}?f=json`;
  const r=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{accept:type}});
  const mime=r.headers.get('content-type')?.split(';')[0];
  if(![type,'binary/octet-stream','application/octet-stream'].includes(mime))throw Error('type');
  const bytes=await bounded(r,8000000);
  const valid=type==='image/png'?[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v):['GIF87a','GIF89a'].includes(new TextDecoder().decode(bytes.slice(0,6)));
  if(!valid)throw Error('signature');
  const response=new Response(bytes,{headers:{'x-graphic-retrieved-at':new Date(now).toISOString(),'content-type':type,'cache-control':'public, max-age=300','access-control-allow-origin':'*','x-content-type-options':'nosniff','x-asmc-issue-time':'unparsed-read-publisher-graphic'}});
  try{await cache?.put(key,response.clone());}catch{}
  return response;
 }catch{return json({error:'ASMC graphic unavailable',sourceUrl:'https://wis2.asmc.asean.org/'},503);}
}
