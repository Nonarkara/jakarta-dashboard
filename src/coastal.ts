// BMKG port forecasts stay separate from observed river gauges and terrain.
const SOURCE = 'BMKG Maritime';
const SOURCE_URL = 'https://maritim.bmkg.go.id/cuaca/pelabuhan/pelabuhan-tanjung-priok';
const API_URL = 'https://maritim.bmkg.go.id/marine2026-data/pelabuhan/XJ001.json';
const DOCS_URL = 'https://maritim.bmkg.go.id/apidoc';
const MAX_BYTES = 131072;
const MAX_POINTS = 96;
const CACHE_MS = 300000;
const MAX_ISSUE_AGE_MS = 72 * 3600000;
const DATUM_NOTE = 'BMKG port JSON does not publish the vertical datum. Tide forecast cannot be joined to local river-gauge heights or terrain elevations. Wave height is separate and is not added to tide.';
const STATION = {code:'XJ001',name:'Pelabuhan Tanjung Priok',lng:106.882294878,lat:-6.103879776};
type Row = Record<string, unknown>;
const record = (x: unknown): x is Row => !!x && typeof x === 'object' && !Array.isArray(x);
function utc(value: unknown): string | null {
  if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:00 UTC$/.test(value))return null;
  const iso=value.replace(' ','T').replace(' UTC',':00Z');
  return Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString().slice(0,19)+'Z'===iso ? iso : null;
}
function number(value: unknown, low: number, high: number): number | null {
  return typeof value==='number' && Number.isFinite(value) && value>=low && value<=high ? value : null;
}
function direction(value: unknown): string | null {
  return typeof value==='string' && ['Utara','Timur Laut','Timur','Tenggara','Selatan','Barat Daya','Barat','Barat Laut'].includes(value) ? value : null;
}
function base(now: number) {
  return {contract:'coastal-v1',source:SOURCE,sourceUrl:SOURCE_URL,apiUrl:API_URL,docsUrl:DOCS_URL,
    checkedAt:new Date(now).toISOString(),tier:'official-coastal-forecast',station:STATION,datum:null,datumNote:DATUM_NOTE,
    units:{tideM:'m',waveHeightM:'m',currentSpeedKnots:'knots',windSpeedKnots:'knots',windGustKnots:'knots'},
    cadence:'First forecast day: hourly; following forecast days: three-hourly. Published points only; no interpolation.',
    freshnessPolicy:'Valid interval must contain the check time and the issue must be no more than 72 hours old. A future issue beyond five minutes is rejected. These are display checks, not a BMKG service guarantee.'};
}
export function cleanCoastal(input: unknown, now = Date.now()) {
  const empty = (error:string) => ({...base(now),available:false,stale:false,issuedAt:null,validFrom:null,validTo:null,points:[],error});
  if(!record(input) || input.code!=='XJ001' || input.name!==STATION.name)return empty('Invalid BMKG port forecast identity.');
  const issuedAt=utc(input.issued),validFrom=utc(input.valid_from),validTo=utc(input.valid_to);
  if(!issuedAt || !validFrom || !validTo)return empty('Invalid BMKG forecast dates.');
  const issue=Date.parse(issuedAt),from=Date.parse(validFrom),to=Date.parse(validTo);
  if(issue>now+5*60000 || issue>from || to<=from || to-from>5*86400000)return empty('Invalid BMKG forecast time interval.');
  const day1=input.forecast_day1,following=input['forecast_day2-4'];
  if(!Array.isArray(day1)||!Array.isArray(following)||day1.length+following.length>MAX_POINTS)return empty('Invalid BMKG forecast row bounds.');
  const seen=new Set<string>();
  const points=[...day1,...following].flatMap(raw=>{
    if(!record(raw))return [];
    const validAt=utc(raw.time),tideM=number(raw.tides,-20,20);
    if(!validAt || tideM===null || Date.parse(validAt)<from || Date.parse(validAt)>=to || seen.has(validAt))return [];
    seen.add(validAt);
    return [{validAt,tideM,waveHeightM:number(raw.wave_height,0,30),currentSpeedKnots:number(raw.current_speed,0,100),currentTo:direction(raw.current_to),
      windSpeedKnots:number(raw.wind_speed,0,200),windGustKnots:number(raw.wind_gust,0,250),windFrom:direction(raw.wind_from)}];
  }).sort((a,b)=>a.validAt.localeCompare(b.validAt));
  const stale=now>=to || now-issue>MAX_ISSUE_AGE_MS;
  const available=!stale && from<=now && points.some(p=>Date.parse(p.validAt)>=now);
  return {...base(now),issuedAt,validFrom,validTo,points,available,stale,error:available?null:stale?'BMKG forecast is expired or its issue is older than the display limit.':'No valid BMKG forecast points cover the remaining interval.'};
}
async function boundedJson(response: Response) {
  const declared=Number(response.headers.get('content-length'));
  if(!response.ok || !response.headers.get('content-type')?.includes('application/json') || declared>MAX_BYTES)throw Error('Publisher response rejected');
  if(!response.body)throw Error('Publisher response empty');
  const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
  try {
    while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>MAX_BYTES)throw Error('Publisher response oversized');chunks.push(chunk.value);}
  }catch(error){await reader.cancel().catch(()=>{});throw error;}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
export async function handleCoastal() {
  const cacheKey=new Request('https://jakarta.nonarkara.org/api/cache/coastal-v1');
  const now=Date.now();let cache:Cache|undefined;
  try{cache=(caches as unknown as {default:Cache}).default;}catch{/* cache is optional */}
  // Cache raw publisher evidence; re-derive validity at every response, including cache hits.
  try{
    const hit=await cache?.match(cacheKey);
    if(hit){const stored=await hit.json() as {savedAt?:unknown;raw?:unknown};if(typeof stored.savedAt==='number'&&stored.savedAt<=now&&now-stored.savedAt<CACHE_MS){const body=cleanCoastal(stored.raw,now);if(body.available)return Response.json(body,{headers:{'cache-control':'public,max-age=60'}});}}
  }catch{/* cache failure does not erase the provider */}
  try {
    const upstream=await fetch(API_URL,{signal:AbortSignal.timeout(12000),headers:{accept:'application/json'}});
    const raw=await boundedJson(upstream),body=cleanCoastal(raw,Date.now());
    if(!body.available)return Response.json(body,{status:503,headers:{'cache-control':'no-store'}});
    try{await cache?.put(cacheKey,Response.json({savedAt:Date.now(),raw},{headers:{'cache-control':'public,max-age=300'}}));}catch{/* fetched evidence survives cache write faults */}
    return Response.json(body,{headers:{'cache-control':'public,max-age=60'}});
  }catch{
    return Response.json({...base(Date.now()),available:false,stale:false,issuedAt:null,validFrom:null,validTo:null,points:[],error:'BMKG port forecast unavailable; no zero tide or wave height is assumed.'},{status:503,headers:{'cache-control':'no-store'}});
  }
}
