// Shared by the live smoke and failure fixtures. Availability is a separate
// observation; a structurally honest outage must never be called live imagery.
export const ENVIRONMENT_IDS = ['surface-water','aerosol','satellite-rain','himawari','true-colour','night-lights','aerosol-viirs','aerosol-index','night-lights-2016','ndvi'];
function validStamp(value) {
 if(typeof value!=='string')return false;
 const time=Date.parse(value);if(!Number.isFinite(time)||time>Date.now()+300000)return false;
 const iso=new Date(time).toISOString();
 return /^\d{4}-\d{2}-\d{2}$/.test(value)?iso.slice(0,10)===value:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)&&iso.replace('.000Z','Z')===value.replace('.000Z','Z');
}
export function validImageryProduct(p) {
 if(!p || typeof p.available!=='boolean' || !Array.isArray(p.tiles) || !Array.isArray(p.dates) || typeof p.source!=='string' || !p.source.trim() || typeof p.tier!=='string' || !p.tier.trim())return false;
 const ext=p.ext??'png';
 if(!['png','jpg'].includes(ext))return false;
 if(!p.available)return p.date===null && p.tiles.length===0 && p.dates.every(validStamp) && ['catalog_unavailable','layer_time_unavailable','no_usable_published_frame'].includes(p.availabilityReason) && (p.fetchedAt===null || validStamp(p.fetchedAt));
 return validStamp(p.date) && p.availabilityReason===null && p.dates.every(validStamp) && p.dates.includes(p.date) && p.tiles.length===1 && typeof p.tiles[0]==='string' && /^https:\/\/gibs\.earthdata\.nasa\.gov\/wmts\/epsg3857\/best\//.test(p.tiles[0]) && p.tiles[0]===`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${p.layer}/default/${p.date}/GoogleMapsCompatible_Level${p.maxzoom}/{z}/{y}/{x}.${ext}` && validStamp(p.fetchedAt) && (p.id==='himawari'?p.date.includes('T')&&Date.now()-Date.parse(p.date)<=3*3600000:/^\d{4}-\d{2}-\d{2}$/.test(p.date));
}
export function validImageryCatalogue(status,products) {
 return status===200 && Array.isArray(products) && products.length===ENVIRONMENT_IDS.length && ENVIRONMENT_IDS.every(id=>products.filter(p=>p?.id===id).length===1) && products.every(validImageryProduct);
}
