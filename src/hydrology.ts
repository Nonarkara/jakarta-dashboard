// Public hydrology adapters. Level, predicted discharge and satellite/model pixels stay separate.
import type { Env } from './index';
const EWS = 'https://ewscilicis.id';
const JAXA = 'https://www.eorc.jaxa.jp/cgi-bin/water/tilemap';
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
export function cleanGauge(row: any, now = Date.now()) {
  if (!row || typeof row !== 'object') return null;
  const at = typeof row.reading_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(row.reading_at) ? row.reading_at + (/[Z+-]\d/.test(row.reading_at.slice(10)) || row.reading_at.endsWith('Z') ? '' : '+07:00') : null;
  const stamp = at ? Date.parse(at) : NaN;
  const valid = Number.isFinite(stamp) && stamp <= now + 5 * 60000;
  if (!Number.isFinite(row.longitude) || !Number.isFinite(row.latitude) || row.longitude < 106.4 || row.longitude > 107.2 || row.latitude < -6.9 || row.latitude > -5.9) return null;
  return { id:String(row.id),name:String(row.name || ''),lng:row.longitude,lat:row.latitude,basin:String(row.watershed_name || ''),
    levelM:valid && row.unit_display === 'm' && Number.isFinite(row.water_level) ? row.water_level : null,
    observedAt:valid ? at : null, rejectedTimestamp:!valid, dischargeM3s:null,
    tier:'publisher-gauge-level', source:'BBWS Ciliwung Cisadane / EWS Sodetan Ciliwung', sourceUrl:EWS };
}
export function parseDischargePredictions(html: string) {
  const rows = [];
  const cards = html.match(/<li\b[^>]*class="completed[^]*?<\/li>/g) || [];
  for (const card of cards) {
    const name = card.match(/<h4[^>]*>\s*(PDA [^<]+)<\/h4>/)?.[1];
    const date = card.match(/(\d{1,2}) (\w+) (\d{4}) (\d{2})\.(\d{2})/);
    const flow = card.match(/<h4[^>]*>\s*(\d+(?:\.\d+)?)\s*<sup>m<sup>3/);
    const month = date ? MONTHS.indexOf(date[2]) + 1 : 0;
    if (!name || !date || !flow || !month) continue;
    const value = Number(flow[1]); if (!Number.isFinite(value) || value < 0 || value > 10000) continue;
    rows.push({name:name.trim(),dischargeM3s:value,validAt:`${date[3]}-${String(month).padStart(2,'0')}-${date[1].padStart(2,'0')}T${date[4]}:${date[5]}:00+07:00`,tier:'publisher-prediction',source:'BBWS Ciliwung Cisadane · Prediksi waktu tempuh air / debit air',sourceUrl:EWS});
  }
  return rows;
}
async function publicFetch(url: string, format: 'json'|'text') {
  const response = await fetch(url,{signal:AbortSignal.timeout(15000),headers:{accept:format==='json'?'application/json':'text/html'}});
  if (!response.ok) throw new Error('publisher '+response.status);
  return format==='json'?response.json():response.text();
}
async function cached(key: string, fetcher: () => Promise<unknown>) {
  const cache = (caches as unknown as {default:Cache}).default;
  const request = new Request('https://jakarta.nonarkara.org/api/cache/'+key);
  const hit = await cache.match(request); if(hit) return hit;
  try { const response=Response.json(await fetcher(),{headers:{'cache-control':'public,max-age=300'}}); await cache.put(request,response.clone());return response; }
  catch { return Response.json({available:false,checkedAt:new Date().toISOString(),error:'Publisher unavailable; no zero flow is assumed.'},{status:503}); }
}
export async function handleHydrology(request: Request, env: Env) {
  const url=new URL(request.url);
  if(url.pathname==='/api/atlas/traffic-stream'||url.pathname.startsWith('/api/atlas/traffic-stream/')) {
    const pathParts=url.pathname.slice('/api/atlas/traffic-stream/'.length).split('/');
    const fromPath=url.pathname.startsWith('/api/atlas/traffic-stream/');
    const camera=fromPath?pathParts.shift():url.searchParams.get('camera'),asset=fromPath?pathParts.join('/'):url.searchParams.get('asset')||'index.m3u8';
    if(!/^[0-9a-f-]{36}$/.test(camera||'')||! /^(index\.m3u8|segment\/\d{1,10}\/file\.ts)$/.test(asset))return new Response('invalid stream',{status:400});
    const catalogResponse=await env.ASSETS.fetch(new Request('https://jakarta.nonarkara.org/data/jakarta-v1/toll-cameras.json'));
    if(!catalogResponse.ok)return new Response('catalog unavailable',{status:503});
    const catalog=await catalogResponse.json() as {streams:Array<{url:string}>};
    const source=catalog.streams?.find(row=>row.url===`https://jmlive.jasamarga.com/hls/2/${camera}/index.m3u8`);
    if(!source)return new Response('unknown camera',{status:404});
    try {
      const response=await fetch(source.url.replace('index.m3u8',asset),{signal:AbortSignal.timeout(15000)});
      if(!response.ok)return new Response('source unavailable',{status:502});
      if(asset==='index.m3u8') {
        const playlist=await response.text();
        if(!playlist.startsWith('#EXTM3U')||playlist.length>65536||playlist.includes('#EXT-X-KEY'))return new Response('unsupported playlist',{status:502});
        const lines=playlist.split(/\r?\n/).map(line=>{if(!line||line.startsWith('#'))return line;if(!/^segment\/\d{1,10}\/file\.ts$/.test(line.trim()))throw new Error('unpublished segment');return `/api/atlas/traffic-stream/${camera}/${line.trim()}`;});
        return new Response(lines.join('\n'),{headers:{'content-type':'application/vnd.apple.mpegurl','cache-control':'no-store'}});
      }
      return new Response(response.body,{headers:{'content-type':'video/mp2t','cache-control':'no-store'}});
    }catch{return new Response('source stream unavailable',{status:502});}
  }
  if(url.pathname==='/api/atlas/hydrology')return cached('hydrology',async()=>{
    const [gauges,html]=await Promise.allSettled([publicFetch(EWS+'/Home/GetAwlrLastReading','json'),publicFetch(EWS+'/','text')]);
    const raw=gauges.status==='fulfilled'?(gauges.value as {response?:unknown})?.response:[];
    const stations=Array.isArray(raw)?raw.map(x=>cleanGauge(x)).filter(Boolean):[];
    const predictions=(html.status==='fulfilled'?parseDischargePredictions(typeof html.value==='string'?html.value:''):[]).map(prediction=>{
      const station=stations.find(row=>row?.name===prediction.name);
      return {...prediction,lng:station?.lng??null,lat:station?.lat??null,basin:station?.basin??null,coordinateMatch:station?'exact-publisher-name':'not-published'};
    });
    return {available:stations.length>0||predictions.length>0,checkedAt:new Date().toISOString(),stations,predictions,levelsAvailable:gauges.status==='fulfilled',predictionsAvailable:html.status==='fulfilled',sourceUrl:EWS,levelDatum:'Local gauge datum; not comparable between stations',flowNote:'Predicted discharge is separate from observed gauge levels. Serial stations must not be summed as independent inflows.'};
  });
  if(url.pathname==='/api/atlas/jaxa-water')return cached('jaxa-water',async()=>{
    const d=await publicFetch(JAXA+'/latest_global_10km.cgi','json') as {init?:{y:number;m:number;d:number;h:number}};
    const init=d?.init; if(!init||![init.y,init.m,init.d,init.h].every(Number.isInteger))throw new Error('invalid model run');
    const date=`${init.y}${String(init.m).padStart(2,'0')}${String(init.d).padStart(2,'0')}${String(init.h).padStart(2,'0')}`;
    const validAt=`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T${date.slice(8,10)}:00:00Z`;
    if(!Number.isFinite(Date.parse(validAt))||Date.parse(validAt)>Date.now()+6*3600000)throw new Error('invalid run time');
    return {available:true,date,validAt,checkedAt:new Date().toISOString(),tier:'hydrological-model',source:'JAXA Today’s Earth TE-Global v2 monitor',sourceUrl:'https://www.eorc.jaxa.jp/water/map/index.html?area=global',resolution:'0.1° / approximately 10 km',products:[{id:'OUTFLW',units:'m³/s',name:'Model discharge'},{id:'FLDFRC',units:'fraction',name:'Model flood fraction'}],note:'Satellite-informed model; not a satellite observation or street-level inundation confirmation.'};
  });
  if(url.pathname==='/api/atlas/jaxa-tile'){
    const product=url.searchParams.get('product'),date=url.searchParams.get('date');
    const z=Number(url.searchParams.get('z')),x=Number(url.searchParams.get('x')),y=Number(url.searchParams.get('y'));
    if(!['OUTFLW','FLDFRC'].includes(product||'')||!/^\d{10}$/.test(date||'')||![z,x,y].every(Number.isInteger)||z<0||z>9||x<0||y<0||x>=2**z||y>=2**z)return new Response('invalid tile',{status:400});
    const stamp=Date.parse(`${date!.slice(0,4)}-${date!.slice(4,6)}-${date!.slice(6,8)}T${date!.slice(8,10)}:00:00Z`);
    if(!Number.isFinite(stamp)||stamp<Date.now()-45*86400000||stamp>Date.now()+6*86400000)return new Response('invalid date',{status:400});
    const upstream=`${JAXA}/tilemap_global_H_10km_v2r3.py?prod=${product}&date=${date}&min=0&max=${product==='OUTFLW'?1000:1}&z=${z}&x=${x}&y=${2**z-1-y}`;
    try{const response=await fetch(upstream,{signal:AbortSignal.timeout(12000),cf:{cacheTtl:3600,cacheEverything:true}});if(!response.ok||!response.headers.get('content-type')?.includes('image/png'))throw new Error('tile unavailable');return new Response(response.body,{headers:{'content-type':'image/png','cache-control':'public,max-age=3600'}});}catch{return new Response('JAXA tile unavailable',{status:502});}
  }
  return new Response('not found',{status:404});
}
