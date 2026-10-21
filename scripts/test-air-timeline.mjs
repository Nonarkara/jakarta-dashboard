// Air timeline + wind transport contract: the Worker route validates UTC,
// grid distance, units and exact air/wind timestamp joins before showing one
// CAMS cell; the client transport is bearing (FROM+180) and speed × elapsed,
// never a concentration. Outages are 503/no-store, never an all-clear 200.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { windTransportPoint, windTrajectoryPoint, transportWindow, currentTransportRow } from '../public/air-timeline.js';
import { workerModuleUrl } from './worker-test-module.mjs';
const worker = (await import(workerModuleUrl)).default;
const originalFetch = globalThis.fetch;
globalThis.caches = { default: { match: async () => null, put: async () => {} } };

// ── uniform-wind transport math ─────────────────────────────────────────────
const start = [106.8272, -6.1754];
const south = windTransportPoint(start, 0, 10, 3600);      // wind FROM north → blows south
assert.ok(south && south[1] < start[1] - 0.03, 'wind from the north carries the marker south');
const west = windTransportPoint(start, 90, 10, 3600);      // wind FROM east → blows west
assert.ok(west && west[0] < start[0] - 0.03, 'wind from the east carries the marker west');
const zero = windTransportPoint(start, 270, 0, 3600);
assert.ok(zero && Math.abs(zero[0] - start[0]) < 1e-9 && Math.abs(zero[1] - start[1]) < 1e-9, 'zero wind stays at the anchor');
const half = windTransportPoint(start, 180, 5, 1800), full = windTransportPoint(start, 180, 5, 3600);
assert.ok(Math.abs(full[1] - start[1]) > 1.9 * Math.abs(half[1] - start[1]), 'distance scales with elapsed time');
assert.equal(windTransportPoint(start, 0, -1, 10), null, 'negative speed refused');
assert.equal(windTransportPoint(start, 0, 10, -1), null, 'negative elapsed refused');
assert.equal(windTransportPoint(null, 0, 10, 10), null, 'missing anchor refused');
const calm = windTransportPoint(start, 0, 10, 0);
assert.ok(Math.abs(calm[1] - start[1]) < 1e-9, 'zero elapsed stays exactly at the anchor');

// ── piecewise trajectory: each scenario hour follows that hour's wind ─────
const uniform=[{windMs:10,windFromDeg:0},{windMs:10,windFromDeg:0},{windMs:10,windFromDeg:0}];
const straight=windTrajectoryPoint(start,uniform,3*3600);
assert.ok(straight && straight.coordinates[1] < start[1] - 0.08, 'three uniform hours carry the marker south');
const dogleg=windTrajectoryPoint(start,[{windMs:10,windFromDeg:0},{windMs:10,windFromDeg:90},{windMs:10,windFromDeg:0}],3*3600);
assert.ok(dogleg.coordinates[0] < straight.coordinates[0] - 0.02 && dogleg.coordinates[1] < start[1] - 0.04, 'a differing middle hour bends the path west');
const paused=windTrajectoryPoint(start,[{windMs:null,windFromDeg:null},{windMs:null,windFromDeg:null},{windMs:null,windFromDeg:null}],3*3600);
assert.ok(paused && Math.abs(paused.coordinates[0]-start[0])<1e-9 && Math.abs(paused.coordinates[1]-start[1])<1e-9, 'all-unknown wind hours pause the marker at the anchor, never assume calm');
const mixed=windTrajectoryPoint(start,[{windMs:null,windFromDeg:null},{windMs:null,windFromDeg:null},{windMs:10,windFromDeg:0}],3*3600);
assert.ok(mixed && Math.abs(Math.abs(mixed.coordinates[1]-start[1]) - Math.abs(straight.coordinates[1]-start[1])/3) < 0.02, 'two unknown hours carry the marker only one hour of travel');
const oneHour=windTrajectoryPoint(start,[{windMs:10,windFromDeg:180}],1*3600);
assert.ok(oneHour && oneHour.coordinates[1] > start[1], 'wind from the south carries the marker north');
assert.equal(windTrajectoryPoint(start,uniform,-1),null,'negative elapsed refused');
assert.equal(windTrajectoryPoint(start,null,3600),null,'missing wind hours refused');
const capped=windTrajectoryPoint(start,[{windMs:10,windFromDeg:0}],10*3600);
assert.equal(capped.hours,1,'the trajectory stops at the end of the published hours');

// ── handler fixtures ────────────────────────────────────────────────────────
const now = Date.now();
const hours = Array.from({ length: 48 }, (_, i) => new Date(Math.floor(now / 3600000) * 3600000 + i * 3600000).toISOString().slice(0, 16) + 'Z');
const airGood = { utc_offset_seconds: 0, latitude: -6.199997, longitude: 106.80002,
  hourly_units: { pm2_5: 'μg/m³', pm10: 'μg/m³', dust: 'μg/m³', aerosol_optical_depth: '' },
  hourly: { time: hours, pm2_5: Array(48).fill(12.5), pm10: Array(48).fill(30), dust: Array(48).fill(1), aerosol_optical_depth: Array(48).fill(0.4) } };
const windGood = { utc_offset_seconds: 0, latitude: -6.151142, longitude: 106.8421,
  hourly_units: { wind_speed_10m: 'm/s', wind_direction_10m: '°' },
  hourly: { time: hours, wind_speed_10m: Array(48).fill(3.2), wind_direction_10m: Array(48).fill(170) } };
const shape = (air, wind) => async url => {
  const host = new URL(url).hostname;
  if (host === 'air-quality-api.open-meteo.com') return air === null ? new Response(null, { status: 503 }) : Response.json(air);
  if (host === 'api.open-meteo.com') return wind === null ? new Response(null, { status: 503 }) : Response.json(wind);
  throw new Error('unexpected provider ' + host);
};
const call = async () => { const r = await worker.fetch(new Request('https://atlas.test/api/atlas/air-timeline'), {}, {}); return { status: r.status, cache: r.headers.get('cache-control'), body: await r.json() }; };

globalThis.fetch = shape(airGood, windGood);
let ok = await call();
assert.equal(ok.status, 200);assert.ok(ok.body.available);
assert.equal(ok.body.times.length, 48);assert.equal(ok.body.tier, 'model-forecast');
assert.equal(ok.body.times[0].pm25, 12.5);assert.equal(ok.body.times[0].windMs, 3.2);assert.equal(ok.body.times[0].windFromDeg, 170);
assert.ok(Math.abs(ok.body.grid.air.lat + 6.199997) < 1e-3 && Math.abs(ok.body.grid.wind.lat + 6.151142) < 1e-3, 'model cell identity retained for both branches');
assert.match(ok.body.note, /never zero/i);

globalThis.fetch = shape({ ...airGood, utc_offset_seconds: 7 * 3600 }, windGood);
let shifted = await call();
assert.equal(shifted.status, 503, 'non-UTC provider output refused');assert.equal(shifted.cache, 'no-store');assert.equal(shifted.body.available, false);assert.equal(shifted.body.airAvailable, false);

globalThis.fetch = shape({ ...airGood, latitude: -6.5, longitude: 106.5 }, windGood);
assert.equal((await call()).status, 503, 'air grid beyond 35 km refused');

function assertAirWithoutWind(result,reason){
  assert.equal(result.status,200,reason+' retains validated air');assert.equal(result.body.airAvailable,true);assert.equal(result.body.windAvailable,false);assert.equal(result.body.grid.wind,null);
  assert.equal(result.body.times[0].pm25,12.5);assert.ok(result.body.times.every(r=>r.windMs===null&&r.windFromDeg===null),'unknown wind never becomes calm');assert.match(result.body.windNote,/no calm or transport/i);
}
globalThis.fetch=shape(airGood,null);assertAirWithoutWind(await call(),'wind provider outage');
globalThis.fetch=shape(airGood,{...windGood,hourly_units:{...windGood.hourly_units,wind_speed_10m:'km/h'}});assertAirWithoutWind(await call(),'unexpected wind units');
globalThis.fetch = shape(airGood, { ...windGood, latitude: -6.5, longitude: 106.5 });
assertAirWithoutWind(await call(), 'wind grid beyond 20 km refused');

const mismatched = { ...windGood, hourly: { ...windGood.hourly, time: [...hours.slice(1), '2099-01-01T00:00:00Z'] } };
globalThis.fetch = shape(airGood, mismatched);
assertAirWithoutWind(await call(), 'wind timestamps must join the air timestamps exactly');

// A declared unit is not proof that its value array exists or matches the timeline.
for(const field of ['pm2_5','pm10','dust','aerosol_optical_depth']) {
  const broken=structuredClone(airGood);delete broken.hourly[field];
  globalThis.fetch=shape(broken,windGood);const missing=await call();
  assert.equal(missing.status,503,field+' missing array returns unavailable, not a thrown500');assert.equal(missing.cache,'no-store');
  broken.hourly[field]=[null];globalThis.fetch=shape(broken,windGood);
  assert.equal((await call()).status,503,field+' misaligned array rejected');
}
for(const field of ['wind_speed_10m','wind_direction_10m']) {
  const broken=structuredClone(windGood);delete broken.hourly[field];
  globalThis.fetch=shape(airGood,broken);assertAirWithoutWind(await call(),field+' missing array rejected');
  broken.hourly[field]=[0];globalThis.fetch=shape(airGood,broken);assertAirWithoutWind(await call(),field+' shortened array rejected');
}
const badTimes=Array(48).fill('invalid');globalThis.fetch=shape({...airGood,hourly:{...airGood.hourly,time:badTimes}},{...windGood,hourly:{...windGood.hourly,time:badTimes}});
assert.equal((await call()).status,503,'matching invalid timestamps do not form a valid join');
globalThis.fetch = shape(null, windGood);
let partial = await call();
assert.equal(partial.status, 503, 'no valid air branch is an outage, never an all-clear');assert.equal(partial.body.windAvailable, true);

globalThis.fetch = shape({ ...airGood, hourly: { ...airGood.hourly, pm2_5: Array(48).fill(null), pm10: Array(48).fill(null), dust: Array(48).fill(null), aerosol_optical_depth: Array(48).fill(null) } }, { ...windGood, hourly: { ...windGood.hourly, wind_speed_10m: Array(48).fill(null), wind_direction_10m: Array(48).fill(null) } });
let empty = await call();
assert.equal(empty.status, 503, 'an all-null model window is unavailable, never zeros');
assert.match(empty.body.note, /zero/i, 'an empty window states that nothing becomes zero');

globalThis.fetch = shape({ ...airGood, hourly: { ...airGood.hourly, pm2_5: Array(48).fill(-5) } }, windGood);
let clamped = await call();
assert.equal(clamped.status, 200);
assert.equal(clamped.body.times[0].pm25, null, 'an out-of-range model value stays null, never a negative');
assert.equal(clamped.body.times[0].windMs, 3.2, 'the wind branch still answers beside a rejected pollutant');

globalThis.fetch = originalFetch;
console.log('PASS air timeline: UTC/grid/unit/timestamp-join validation, outage and null honesty, piecewise wind-trajectory transport math');

// Fractional hours use only their elapsed duration, and missing wind consumes time.
{
const start=[106.8272,-6.1754], uniform=[{windMs:10,windFromDeg:0},{windMs:10,windFromDeg:90}];
for(const seconds of [0,1,900,1800,3599,3600]){
 const actual=windTrajectoryPoint(start,uniform,seconds).coordinates;
 const expected=windTransportPoint(start,0,10,seconds);
 assert.ok(Math.hypot(actual[0]-expected[0],actual[1]-expected[1])<1e-10,'exact fractional travel '+seconds);
}
const boundary=windTransportPoint(start,0,10,3600);
const partial=windTransportPoint(boundary,90,10,900);
assert.deepEqual(windTrajectoryPoint(start,uniform,4500).coordinates,partial,'second hour is partial');
assert.deepEqual(windTrajectoryPoint(start,[{},uniform[0]],4500).coordinates,windTransportPoint(start,0,10,900),'unknown first hour never borrows future wind');
const rows=[0,1,3].map(i=>({validAt:new Date(Date.UTC(2026,9,18,i)).toISOString(),windMs:i,windFromDeg:0}));
assert.equal(currentTransportRow(rows,Date.UTC(2026,9,18,1,35)),rows[1],'launch anchors current hour, not first usable midnight wind');
assert.equal(currentTransportRow(rows,Date.UTC(2026,9,18,2,35)),null,'missing current hour cannot borrow next wind');
const window=transportWindow(rows,rows[1].validAt,3);
assert.equal(window[0].windMs,1);assert.equal(window[1].windMs,null);assert.equal(window[2].windMs,3);
console.log('PASS fractional transport and time-anchored wind gaps');

}
