import { XMLParser } from 'fast-xml-parser';
const parser = new XMLParser({removeNSPrefix:true,parseTagValue:false,ignoreAttributes:true,processEntities:false});
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
const number = (value,min,max) => typeof value==='number' && Number.isFinite(value) && value>=min && value<=max ? value : null;
export function utc(value) {
 if(typeof value!=='string')return null;
 const v=value.trim().replace(' ','T');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(v))return null;
 const time=Date.parse(/[Z]|[+-]\d{2}:\d{2}$/.test(v)?v:v+'Z');
 return Number.isFinite(time)?new Date(time).toISOString():null;
}
const fresh = (stamp,age) => stamp && Date.now()-Date.parse(stamp)<=age && Date.parse(stamp)<=Date.now()+300000;
function json(body,status=200){return Response.json(body,{status,headers:{'cache-control':status===200?'public, max-age=120':'no-store','access-control-allow-origin':'*'}});}
async function provider(url,ttl,xml=false){
 const key=new Request(url);const cache=globalThis.caches?.default;
 try{const hit=await cache?.match(key);if(hit)return await hit.json();}catch{}
 try{
  const r=await fetch(url,{headers:{'User-Agent':'JakartaDashboard/1.0 (jakarta.nonarkara.org)'},signal:AbortSignal.timeout(12000)});
  if(!r.ok)return {available:false,error:'HTTP '+r.status,fetchedAt:new Date().toISOString()};
  const text=await r.text();if(text.length>2000000||xml&&/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('invalid provider body');
  const result={available:true,body:xml?parser.parse(text):JSON.parse(text),fetchedAt:new Date().toISOString()};
  try{await cache?.put(key,Response.json(result,{headers:{'cache-control':`public, max-age=${ttl}`}}));}catch{}
  return result;
 }catch{return {available:false,error:'Provider unavailable or invalid',fetchedAt:new Date().toISOString()};}
}
export function normalizeForecast(body,code){
 const location=body?.lokasi;const rows=list(body?.data).flatMap(d=>list(d?.cuaca).flat());
 if(location?.adm4!==code||!Number.isFinite(location?.lat)||!Number.isFinite(location?.lon)||location.lat< -7||location.lat> -5||location.lon<106||location.lon>108)return null;
 const forecast=rows.flatMap(row=>{
  const validAt=utc(row?.utc_datetime||row?.datetime),issuedAt=utc(row?.analysis_date);
  if(!validAt||!fresh(issuedAt,36*3600000))return [];
  return [{validAt,issuedAt,temperatureC:number(row.t,-10,55),humidityPct:number(row.hu,0,100),windKph:number(row.ws,0,300),windDirection:typeof row.wd==='string'?row.wd:null,cloudPct:number(row.tcc,0,100),conditionId:String(row.weather_desc||''),conditionEn:String(row.weather_desc_en||row.weather_desc||'')}];
 }).filter(r=>Date.parse(r.validAt)>=Date.now()-3*3600000).sort((a,b)=>Date.parse(a.validAt)-Date.parse(b.validAt));
 if(!forecast.length)return null;
 return {code,name:location.desa,kecamatan:location.kecamatan,kota:location.kotkab,lat:location.lat,lng:location.lon,timezone:location.timezone,issuedAt:forecast[0].issuedAt,forecast};
}
const codes=['31.71.03.1001','31.72.01.1001','31.73.01.1001','31.74.01.1001','31.75.01.1001'];
async function weather(){
 const rows=await Promise.all(codes.map(async code=>{
  const url='https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4='+code;const p=await provider(url,1800);
  const data=p.available?normalizeForecast(p.body,code):null;
  return {code,available:!!data,...data,sourceUrl:url,source:'BMKG',tier:'official-forecast',fetchedAt:p.fetchedAt,error:data?null:p.error||'Invalid or outdated forecast'};
 }));
 return json({points:rows,source:'BMKG',tier:'official-forecast',fetchedAt:new Date().toISOString()},rows.some(p=>p.available)?200:503);
}
export function normalizeCap(body,sourceUrl){
 const cap=body?.alert;if(!cap||cap.status!=='Actual'||cap.msgType==='Cancel')return [];
 return list(cap.info).flatMap(info=>{
  const effective=utc(info.effective||info.onset),expires=utc(info.expires),sent=utc(cap.sent);
  if(!sent||!effective||!expires||!fresh(sent,12*3600000)||Date.parse(expires)<=Date.now()||Date.parse(effective)>Date.now())return [];
  const polygons=list(info.area).flatMap(a=>list(a.polygon).flatMap(p=>{
   if(typeof p!=='string')return [];
   const coords=p.trim().split(/\s+/).map(pair=>pair.split(',').map(Number)).map(([lat,lng])=>[lng,lat]);
   if(coords.length<3||coords.length>20000||coords.some(([x,y])=>!Number.isFinite(x)||!Number.isFinite(y)||x< -180||x>180||y< -90||y>90))return [];
   if(coords[0][0]!==coords.at(-1)[0]||coords[0][1]!==coords.at(-1)[1])coords.push(coords[0]);
   return [{type:'Feature',properties:{name:info.headline||info.event,source:'BMKG'},geometry:{type:'Polygon',coordinates:[coords]}}];
  }));
  return [{id:cap.identifier,headline:String(info.headline||info.event||''),description:String(info.description||''),instruction:String(info.instruction||''),sent,effective,expires,severity:info.severity,certainty:info.certainty,urgency:info.urgency,sourceUrl,areas:list(info.area).map(a=>String(a.areaDesc||'')),geometry:{type:'FeatureCollection',features:polygons}}];
 });
}
async function alerts(lang){
 const sourceUrl='https://www.bmkg.go.id/alerts/nowcast/'+lang;const p=await provider(sourceUrl,180,true);
 if(!p.available||!p.body?.rss?.channel)return json({available:false,alerts:[],source:'BMKG',sourceUrl,tier:'official-warning',fetchedAt:p.fetchedAt,error:p.error||'Invalid RSS'},503);
 const channel=p.body.rss.channel;const buildTime=Date.parse(channel.lastBuildDate);const publishedAt=Number.isFinite(buildTime)?new Date(buildTime).toISOString():null;
 const selected=list(channel.item).filter(i=>/Jakarta|Jawa Barat|Banten/i.test(String(i.title))).slice(0,6);
 const results=await Promise.all(selected.map(async item=>{
  let u;try{u=new URL(String(item.link));}catch{return {available:false,alerts:[]};}
  if(u.origin!=='https://www.bmkg.go.id'||!new RegExp('^/alerts/nowcast/'+lang+'/[a-zA-Z0-9_-]+\\.xml$').test(u.pathname))return {available:false,alerts:[]};
  const d=await provider(u.href,180,true);return {available:d.available,alerts:d.available?normalizeCap(d.body,u.href):[]};
 }));
 const available=!!fresh(publishedAt,3*3600000)&&results.every(r=>r.available);
 return json({available,alerts:results.flatMap(r=>r.alerts),publishedAt,scope:'DKI Jakarta, Jawa Barat, Banten',source:'BMKG',sourceUrl,tier:'official-warning',fetchedAt:p.fetchedAt,error:available?null:'Stale bulletin or incomplete alert details'},available?200:503);
}
export function normalizeQuake(body){
 const d=body?.Infogempa?.gempa;if(!d)return null;
 const coords=String(d.Coordinates).split(',').map(Number),observedAt=utc(d.DateTime);
 if(coords.length!==2||!Number.isFinite(coords[0])||!Number.isFinite(coords[1])||Math.abs(coords[0])>90||Math.abs(coords[1])>180||!observedAt||Date.parse(observedAt)>Date.now()+300000)return null;
 const m=Number(d.Magnitude),depth=Number.parseFloat(d.Kedalaman);
 if(!Number.isFinite(m)||m<0||m>10||!Number.isFinite(depth)||depth<0||depth>1000)return null;
 return {lat:coords[0],lng:coords[1],magnitude:m,depthKm:depth,observedAt,region:String(d.Wilayah||''),felt:String(d.Dirasakan||''),potential:String(d.Potensi||'')};
}
async function earthquake(){
 const sourceUrl='https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json';const p=await provider(sourceUrl,300),event=p.available?normalizeQuake(p.body):null;
 return json({available:!!event,event,source:'BMKG',sourceUrl,tier:'official-event',scope:'Latest Indonesia event; may be outside Jakarta',fetchedAt:p.fetchedAt},event?200:503);
}
async function floods(){
 const sourceUrl='https://api.petabencana.id/reports?admin=ID-JK&geoformat=geojson&disaster=flood';const p=await provider(sourceUrl,300);
 const result=p.body?.result;const valid=p.available&&result?.type==='FeatureCollection'&&Array.isArray(result.features);
 const reports=valid?result.features.flatMap(f=>{
  const stamp=utc(f?.properties?.created_at),coords=f?.geometry?.coordinates;
  if(!fresh(stamp,3600000)||f.geometry?.type!=='Point'||!Array.isArray(coords)||coords.length<2||!coords.every(Number.isFinite)||coords[0]<106||coords[0]>108||coords[1]< -7||coords[1]> -5)return [];
  // Display aggregate counts only; resident text/photos/household coordinates are not redistributed.
  return [{observedAt:stamp}];
 }):[];
 return json({available:!!valid,reportCount:valid?reports.length:null,windowSeconds:3600,state:!valid?'unavailable':reports.length?'reports-returned':'no-reports-returned',source:'PetaBencana',sourceUrl,tier:'crowdsourced-report',fetchedAt:p.fetchedAt,license:'CC BY-NC 4.0; commercial agreement required',note:'No reports returned does not establish that streets are dry.'},valid?200:503);
}
export async function handleJakarta(request){
 const url=new URL(request.url),lang=url.searchParams.get('lang')==='en'?'en':'id';
 switch(url.pathname){
 case '/api/jakarta/weather':return weather();
 case '/api/jakarta/alerts':return alerts(lang);
 case '/api/jakarta/earthquake':return earthquake();
 case '/api/jakarta/flood-reports':return floods();
 default:return json({error:'not_found'},404);
 }
}
