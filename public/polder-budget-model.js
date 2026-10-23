// One boundary, one rain profile, explicit assumptions. No terrain or routing.
export function distanceKm(a,b) {
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==2||b.length!==2||![...a,...b].every(Number.isFinite)||[a,b].some(p=>Math.abs(p[0])>180||Math.abs(p[1])>90))return Infinity;
 const rad=Math.PI/180,dlat=(b[1]-a[1])*rad,dlng=(b[0]-a[0])*rad;
 const h=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlng/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function rainForBoundary(payload,boundary,now=Date.now()) {
 const fetched=Date.parse(payload?.fetchedAt),hour=Math.floor(now/3600000)*3600000;
 if(payload?.timezone!=='UTC'||!Number.isFinite(fetched)||fetched>now+300000||now-fetched>1800000||!Array.isArray(payload.points))return null;
 const options=payload.points.flatMap(p=>{
  const from=Date.parse(p?.forecastFromUtc),to=Date.parse(p?.forecastToUtc),at=Date.parse(p?.validAt);
  const location=[p?.modelLocation?.lng,p?.modelLocation?.lat],km=distanceKm(boundary.representativePoint,location);
  if(p.available!==true||!Number.isFinite(at)||at>now+300000||now-at>10800000||from<hour||from>hour+3600000||to-from!==86400000||km>20||!Array.isArray(p.forecast)||p.forecast.length!==24)return [];
  if(!p.forecast.every((r,i)=>Date.parse(r.validAt)===from+(i+1)*3600000&&typeof r.precipitationMm==='number'&&Number.isFinite(r.precipitationMm)&&r.precipitationMm>=0&&r.precipitationMm<=1000))return [];
  return [{name:p.name||p.id||'Open-Meteo',distanceKm:km,modelLocation:location,from:new Date(from).toISOString(),to:new Date(to).toISOString(),fetchedAt:payload.fetchedAt,source:payload.source,sourceUrl:payload.sourceUrl,tier:payload.tier,mm:p.forecast.map(r=>r.precipitationMm)}];
 });
 return options.sort((a,b)=>a.distanceKm-b.distanceKm)[0]||null;
}
export function stormProfile(totalMm=50,hours=3) {
 if(typeof totalMm!=='number'||!Number.isFinite(totalMm)||totalMm<0||totalMm>1000||!Number.isInteger(hours)||hours<1||hours>24)return null;
 return Array.from({length:24},(_,i)=>i<hours?totalMm/hours:0);
}
export function waterBudget({areaM2,rainMm,runoffFraction=1,pumpM3s=0,initialM3=0,freeStorageM3=null}) {
 if(![areaM2,runoffFraction,pumpM3s,initialM3].every(v=>typeof v==='number'&&Number.isFinite(v))||areaM2<=0||runoffFraction<0||runoffFraction>1||pumpM3s<0||pumpM3s>10000||initialM3<0||!Array.isArray(rainMm)||rainMm.length!==24||!rainMm.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1000)||freeStorageM3!==null&&(!Number.isFinite(freeStorageM3)||typeof freeStorageM3!=='number'||freeStorageM3<0))return null;
 let remaining=initialM3,gross=0,runoff=0,removed=0,peak=initialM3;
 const rows=rainMm.map((mm,i)=>{
  const rainM3=areaM2*mm/1000,inflowM3=rainM3*runoffFraction;
  const availableM3=remaining+inflowM3,pumpedM3=Math.min(availableM3,pumpM3s*3600);
  remaining=availableM3-pumpedM3;gross+=rainM3;runoff+=inflowM3;removed+=pumpedM3;peak=Math.max(peak,remaining);
  return {hour:i+1,mm,rainM3,inflowM3,pumpedM3,cumulativeRunoffM3:runoff,remainingM3:remaining,aboveSpaceM3:freeStorageM3===null?null:Math.max(0,remaining-freeStorageM3)};
 });
 return {rows,grossRainM3:gross,runoffM3:runoff,removedM3:removed,remainingM3:remaining,peakM3:peak,maxAboveSpaceM3:freeStorageM3===null?null:Math.max(0,peak-freeStorageM3),initialM3,conservationErrorM3:initialM3+runoff-removed-remaining};
}
