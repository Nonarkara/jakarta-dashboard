import {coastalModuleUrl} from './coastal-test-module.mjs';
import {hydrologyModuleUrl} from "./hydrology-test-module.mjs";
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace("./coastal.js",coastalModuleUrl).replace("./hydrology.js",hydrologyModuleUrl).replace("./jakarta.js", new URL("../src/jakarta.js", import.meta.url).href);
const worker = (await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))).default;
const originalFetch = globalThis.fetch, originalCaches = globalThis.caches;
let radar, capabilities, weather, air = [], gdacs = { type: 'FeatureCollection', features: [] };
const date = new Date().toISOString().slice(0,10), now = Date.now();
const ids = [['MODIS_Combined_Flood_3-Day',9], ['MODIS_Terra_Aerosol',6], ['IMERG_Precipitation_Rate',6], ['VIIRS_NOAA20_CorrectedReflectance_TrueColor',9]];
capabilities = '<Capabilities>' + ids.map(([id,z]) => `<Layer><ows:Identifier>${id}</ows:Identifier><Dimension><Default>${date}</Default></Dimension><TileMatrixSet>GoogleMapsCompatible_Level${z}</TileMatrixSet></Layer>`).join('') + '</Capabilities>';
radar = { host: 'https://tilecache.rainviewer.com', radar: { past: [
  { time: now/1000 - 600, path: '/v2/radar/frame1' }, { time: now/1000, path: '/v2/radar/../../evil' },
  { time: now/1000 + 3600, path: '/v2/radar/future' }, { time: now/1000 - 4*3600, path: '/v2/radar/old' },
] } };
const hourlyStart = Math.floor(now / 3600000) * 3600000;
weather = Array.from({length:5}, () => ({ utc_offset_seconds:0, current_units:{precipitation:'mm'}, hourly_units:{precipitation:'mm'}, latitude:-6.18, longitude:106.83,
  current:{time:new Date(hourlyStart).toISOString().slice(0,16), interval:900, precipitation:0},
  hourly:{time:Array.from({length:25}, (_,i) => new Date(hourlyStart+i*3600000).toISOString().slice(0,16)), precipitation:Array(25).fill(1), precipitation_probability:Array(25).fill(40)} }));
globalThis.caches = { default:{ match:async()=>null, put:async()=>{} } };
globalThis.fetch = async url => {
  const host = new URL(url).hostname;
  if (host === 'gibs.earthdata.nasa.gov') return new Response(capabilities);
  if (host === 'api.rainviewer.com') return Response.json(radar);
  if (host === 'api.open-meteo.com') return Response.json(weather);
  if (host === 'air-quality-api.open-meteo.com') return Response.json(air);
  if (host === 'www.gdacs.org') return Response.json(gdacs);
  throw new Error('Unexpected provider ' + host);
};
const request = path => worker.fetch(new Request('https://atlas.test'+path), {}, {});
try {
  let r=await request('/api/atlas/environment'), data=await r.json();
  // Assert the SET, not a bare count: a new product should make this test say
  // which product appeared, instead of failing on an arithmetic mismatch.
  assert.deepEqual(data.products.map(p=>p.id).slice(0,9),
    ['surface-water','aerosol','satellite-rain','himawari','true-colour','night-lights','aerosol-viirs','aerosol-index','night-lights-2016'],
    'the first nine satellite products keep their order and identity');
  assert.equal(data.products.length,10);
  assert.ok(data.products.slice(0,3).every(p=>p.available && p.date===date));
  assert.equal(data.products[3].available,false);
  assert.equal(data.products[4].available,true); assert.match(data.products[4].tiles[0], /\.jpg$/); assert.equal(data.products[4].legendUrl,null);
  assert.equal(data.radar.frames.length,1); assert.ok(data.products[0].tiles[0].includes('Level9/{z}/{y}/{x}.png'));
  assert.equal(data.products[0].windowDays,3);
  {
    const saved=capabilities, past='2016-01-01', gapDay=new Date(now-2*86400000).toISOString().slice(0,10);
    const products=[['VIIRS_NOAA20_GapFilled_BRDF_Corrected_DayNightBand_Radiance',8,gapDay],['VIIRS_NOAA20_AOD_Deep_Blue_Land_Ocean',6,date],['OMPS_NOAA20_NadirMapper_AerosolIndex_380',6,date],['VIIRS_Night_Lights',8,past],['VIIRS_NOAA20_NDVI_8Day',8,gapDay]];
    // GIBS publishes most products as a date RANGE, not a single day. Give NDVI
    // that shape so the longer window is actually exercised.
    capabilities='<Capabilities>'+products.map(([id,z,day])=>{
      const range = id==='VIIRS_NOAA20_NDVI_8Day'
        ? `<Value>${new Date(Date.parse(day)-40*86400000).toISOString().slice(0,10)}/${day}/P1D</Value>`
        : `<Value>${day}</Value>`;
      return `<Layer><ows:Identifier>${id}</ows:Identifier><Dimension><Default>${day}</Default>${range}</Dimension><Format>image/png</Format><TileMatrixSet>GoogleMapsCompatible_Level${z}</TileMatrixSet></Layer>`;
    }).join('')+'</Capabilities>';
    const satellite=(await (await request('/api/atlas/environment')).json()).products;
    for(const id of ['night-lights','aerosol-viirs','aerosol-index','night-lights-2016']){const p=satellite.find(p=>p.id===id);assert.equal(p.available,true,id);assert.ok(p.tiles[0].endsWith('.png'));assert.ok(p.date<=date);}
    // NDVI declares a longer history, so it keeps its own date window.
    const ndviFound=satellite.find(p=>p.id==='ndvi');
    assert.ok(ndviFound,'ndvi is a declared product');
    assert.equal(ndviFound.available,true,'ndvi is available when the provider lists its layer');
    assert.match(ndviFound.tiles[0],/VIIRS_NOAA20_NDVI_8Day/,'ndvi tiles name its own layer');
    assert.match(ndviFound.tiles[0],/GoogleMapsCompatible_Level8/,'ndvi uses the tile matrix the provider declares');
    assert.equal(ndviFound.units,'NDVI (unitless index)','ndvi units say index, not area');
    assert.ok(ndviFound.dates.length>7,'ndvi keeps a longer history than a 7-day daily product: got '+ndviFound.dates.length);
    const night=satellite.find(p=>p.id==='night-lights');assert.equal(night.date,gapDay);assert.equal(night.tier,'satellite-corrected-gap-filled');assert.match(night.units,/nW/);assert.match(night.resolution,/750 m sensor/);
    const old=satellite.find(p=>p.id==='night-lights-2016');assert.equal(old.date,past);assert.equal(old.timePrecision,'annual composite');assert.equal(old.windowDays,null);assert.equal(old.legendUrl,null);
    assert.match(satellite.find(p=>p.id==='aerosol-index').resolution,/12 × 17/);
    capabilities=capabilities.replaceAll('GoogleMapsCompatible_Level8','GoogleMapsCompatible_Level7');
    const wrong=(await (await request('/api/atlas/environment')).json()).products.find(p=>p.id==='night-lights');assert.equal(wrong.available,false);assert.deepEqual(wrong.tiles,[]);
    capabilities=saved;
  }

  capabilities = '<Capabilities>' + ids.map(([id,z]) => `<Layer><ows:Identifier>${id}</ows:Identifier><Dimension><Default>${date}</Default><Value>${date}</Value><Value>${new Date(now-2*86400000).toISOString().slice(0,10)}</Value></Dimension><TileMatrixSet>GoogleMapsCompatible_Level${z}</TileMatrixSet></Layer>`).join('') + '</Capabilities>';
  data=await (await request('/api/atlas/environment')).json();
  assert.equal(data.products[0].dates.length,2,'unpublished days must not be guessed');
  assert.equal(data.products[0].date,new Date(now-2*86400000).toISOString().slice(0,10));
  {
    const today=new Date().toISOString().slice(0,10), tomorrow=new Date(now+86400000).toISOString().slice(0,10);
    const weekAgo=new Date(now-7*86400000).toISOString().slice(0,10), saved=capabilities;
    capabilities='<Capabilities><Layer><ows:Identifier>MODIS_Terra_Aerosol</ows:Identifier><Dimension><Default>'+tomorrow+'</Default><Value>'+weekAgo+'/'+tomorrow+'/P1D</Value></Dimension><TileMatrixSet>GoogleMapsCompatible_Level6</TileMatrixSet></Layer></Capabilities>';
    data=await (await request('/api/atlas/environment')).json();
    const aerosol=data.products.find(p=>p.id==='aerosol');
    assert.equal(aerosol.available,true,'a staged <Default> ahead of today is not an outage');
    assert.ok(aerosol.date && aerosol.date<=today,'a future date is never served as current');
    assert.ok(aerosol.tiles[0].includes('/'+aerosol.date+'/GoogleMapsCompatible_Level6/'),'the tile carries the resolved past date');
    assert.equal(aerosol.latestAvailableDate,tomorrow,'the staged default is still reported honestly');
    capabilities=saved;
  }
  {
    // GIBS serves some Cloudflare egresses a caps variant whose daily dates
    // carry a T00:00:00Z suffix; the day must still resolve.
    const saved=capabilities;
    const weekAgo=new Date(now-7*86400000).toISOString().slice(0,10);
    capabilities='<Capabilities><Layer><ows:Identifier>MODIS_Terra_Aerosol</ows:Identifier><Dimension><Default>'+date+'T00:00:00Z</Default><Value>'+weekAgo+'T00:00:00Z/'+date+'T00:00:00Z/P1D</Value></Dimension><TileMatrixSet>GoogleMapsCompatible_Level6</TileMatrixSet></Layer></Capabilities>';
    data=await (await request('/api/atlas/environment')).json();
    const aerosol=data.products.find(p=>p.id==='aerosol');
    assert.equal(aerosol.available,true,'time-suffixed daily caps dates still resolve the product');
    assert.ok(aerosol.date && aerosol.date<=date,'the resolved date is a bare day, never ahead of today');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(aerosol.date),'the served day carries no time suffix');
    assert.ok(aerosol.tiles[0].includes('/'+aerosol.date+'/GoogleMapsCompatible_Level6/'),'the tile carries the resolved day');
    assert.equal(aerosol.latestAvailableDate,date,'the staged default keeps its day form');
    capabilities=saved;
  }

  const frame = new Date(Math.floor(now / 600000) * 600000).toISOString().replace('.000Z','Z');
  capabilities += `<Layer><ows:Identifier>Himawari_AHI_Band13_Clean_Infrared</ows:Identifier><Dimension><Default>${frame}</Default><Value>${frame}</Value></Dimension><TileMatrixSet>GoogleMapsCompatible_Level6</TileMatrixSet></Layer>`;
  data=await (await request('/api/atlas/environment')).json();
  assert.equal(data.products[3].date,frame); assert.equal(data.products[3].timePrecision,'10 minutes');
  assert.ok(data.products[3].tiles[0].includes('/'+frame+'/GoogleMapsCompatible_Level6/'));
  capabilities = capabilities.replace(frame, new Date(now+3600000).toISOString().replace('.000Z','Z'));
  data=await (await request('/api/atlas/environment')).json(); assert.equal(data.products[3].available,false,'future Himawari cannot be current');
  radar.host='https://evil.test'; capabilities='<Capabilities/>';
  data=await (await request('/api/atlas/environment')).json();
  assert.equal(data.radar.available,false); assert.ok(data.products.every(p=>!p.available && p.tiles.length===0 && p.date===null));
  r=await request('/api/atlas/rainfall'); data=await r.json();
  assert.equal(r.status,200); assert.equal(data.points[0].precipitationMm,0); assert.equal(data.points[0].next24hMm,24);
  assert.ok(data.points[0].validAt.endsWith('Z'));
  weather[0].hourly.precipitation[3]=null;
  data=await (await request('/api/atlas/rainfall')).json(); assert.equal(data.points[0].next24hMm,null,'missing hours cannot become zero');
  weather.forEach(p=>p.current.time=new Date(now+7*3600000).toISOString().slice(0,16));
  r=await request('/api/atlas/rainfall');data=await r.json();assert.equal(r.status,503);assert.ok(data.points.every(p=>!p.available && p.precipitationMm===null && p.windKph===null));
  const coords=[[-6.18,106.83],[-6.12,106.88],[-6.17,106.75],[-6.27,106.81],[-6.23,106.90]];
  const stamp=new Date(hourlyStart).toISOString().slice(0,16);
  weather=coords.map(([lat,lng],i)=>({utc_offset_seconds:0,latitude:lat,longitude:lng,current_units:{precipitation:'mm',wind_speed_10m:'km/h',wind_gusts_10m:'km/h',wind_direction_10m:'°',pressure_msl:'hPa'},hourly_units:{precipitation:'mm'},current:{time:stamp,interval:900,precipitation:i===0?12:0,wind_speed_10m:10,wind_gusts_10m:i===2?80:20,wind_direction_10m:90,pressure_msl:i===3?990:1010},hourly:{time:Array.from({length:25},(_,h)=>new Date(hourlyStart+h*3600000).toISOString().slice(0,16)),precipitation:Array(25).fill(0),precipitation_probability:Array(25).fill(0)}}));
  air=coords.map(([lat,lng],i)=>({utc_offset_seconds:0,latitude:lat,longitude:lng,current_units:{pm2_5:'µg/m³',pm10:'µg/m³',us_aqi:'USAQI'},current:{time:stamp,interval:3600,pm2_5:i===1?36.4:8,pm10:10,us_aqi:i===1?152:42}}));
  const future=new Date(now+86400000).toISOString().slice(0,19);
  gdacs={type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Point',coordinates:[107.5,-9.5]},properties:{eventtype:'TC',eventid:9,name:'Old Storm',iscurrent:'false',todate:'2020-01-01T00:00:00',alertlevel:'Red'}},
    {type:'Feature',geometry:{type:'Point',coordinates:[107.5,-9.5]},properties:{eventtype:'TC',eventid:2,name:'Near Storm',iscurrent:'true',todate:future,alertlevel:'Orange'}},
    {type:'Feature',geometry:{type:'Point',coordinates:[0,0]},properties:{eventtype:'TC',eventid:3,name:'Far Storm',iscurrent:true,todate:future,alertlevel:'Green'}},
  ]};
  r=await request('/api/atlas/watch'); data=await r.json();
  assert.equal(r.status,200);
  assert.equal(data.traffic.congestion,'unavailable');
  assert.equal(data.places[0].precipitationMm,12); assert.equal(data.places[0].gustKph,20); assert.equal(data.places[0].forecast,undefined);
  assert.deepEqual(data.notices.map(n=>n.topic),['rain','wind','pressure','storm','air']);
  assert.equal(data.notices.find(n=>n.topic==='air').placeId,'utara');
  assert.equal(data.storm.systems.length,1); assert.equal(data.storm.systems[0].name,'Near Storm');
  gdacs={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[106.83,-6.18]},properties:{eventtype:'TC',eventid:1,name:'Closed',iscurrent:'false',todate:future,alertlevel:'Red'}}]};
  air.forEach(p=>{p.current.us_aqi=40; p.current.pm2_5=null;});
  weather.forEach(p=>{p.current.precipitation=12; p.current.wind_gusts_10m=10; p.current.pressure_msl=1012; p.current.interval=7200;});
  data=await (await request('/api/atlas/watch')).json();
  assert.deepEqual(data.notices,[]);
  assert.equal(data.storm.available,true); assert.equal(data.storm.systems.length,0);
  assert.equal(data.places[1].air.pm25,null); assert.equal(data.places[1].air.usAqi,40);
  weather={bad:true};assert.equal((await request('/api/atlas/rainfall')).status,503);
} finally { globalThis.fetch=originalFetch;globalThis.caches=originalCaches; }
console.log('PASS environment contract: provider dates, product matrices, fixed radar host/paths, stale/future frames, UTC, complete forecast sums, zero and missing data');
