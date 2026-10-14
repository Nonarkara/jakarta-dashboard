import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
// Exercise actual adapter functions without network or exposing them in the Worker API.
const source=readFileSync(new URL('../src/index.ts',import.meta.url),'utf8');
const helpers=['normalizedUtc','boundedNumber','validObservation','airForecast','parseFires'].map(name=>{
 const start=source.indexOf('function '+name+'('); let end=source.indexOf('\n}',start)+2;
 assert.ok(start>=0&&end>start); return source.slice(start,end);
}).join('\n');
const constants=source.slice(source.indexOf('const FIRMS_HEADER ='),source.indexOf('function parseFires('));
const compiled=ts.transpileModule(constants+'\n'+helpers+'\nexport {parseFires,airForecast};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {parseFires,airForecast}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const header='latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight';
const now=Date.now();
function row(at=now-3600000,overrides={}){const d=new Date(at);const c=['-6.2','106.8','300','0.4','0.4',d.toISOString().slice(0,10),d.toISOString().slice(11,16).replace(':',''),'1','nominal','2.0NRT','290','12','D'];for(const [i,v]of Object.entries(overrides))c[Number(i)]=v;return c.join(',');}
const parse=(...rows)=>parseFires(header+'\n'+rows.join('\n'));
assert.equal(parse(row()).length,1);
for(const bad of [row(now-25*3600000),row(now+3600000),row(now,{0:''}),row(now,{12:'bad'}),row(now,{6:'2460'}),row(now,{5:'2026-02-31'}),row()+',extra'])assert.equal(parse(bad).length,0,'invalid date/position/schema must not become a detection');
assert.equal(parse(row(now,{11:''}))[0].properties.frp,null,'blank radiant power is unknown, not zero');
assert.equal(parseFires('x'.repeat(12000001)),null,'oversized CSV rejected');
assert.equal(parseFires(header+'\n'+('x\n').repeat(100001)),null,'oversized row count rejected');
const t=new Date(now+3600000).toISOString().slice(0,16),near=new Date(now+2*3600000).toISOString().slice(0,16),far=new Date(now+365*86400000).toISOString().slice(0,16);
const air={hourly_units:{pm2_5:'µg/m³',us_aqi:'USAQI'},hourly:{time:[near,t,t,far],pm2_5:[10,0,99,10],us_aqi:[20,0,88,10]}};
assert.deepEqual(airForecast(air,true).map(x=>[x.t,x.pm25,x.aqi]),[[t+'Z',0,0],[near+'Z',10,20]],'forecast sorted, deduplicated, bounded; real zeros preserved');
assert.deepEqual(airForecast(air,false),[]);
console.log('PASS NASA fires and air forecast: bounded CSV/schema, dates, unknown power, 24h observations, ordered bounded model hours');
