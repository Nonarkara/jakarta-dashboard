// Wait for actual committed asset bytes before touching the production smoke keys.
// Disposable probe keys avoid caching stale assets under the real release URL.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=body=>createHash('sha256').update(body).digest('hex');
const read=path=>readFileSync(new URL('../public/'+path,import.meta.url));
const tag=read('app.js').toString().match(/const ATLAS_BUILD_TAG = "([^"]+)"/)[1];
if(process.env.EXPECTED_BUILD&&process.env.EXPECTED_BUILD!==tag)throw new Error('Local build differs from release stamp');
const assets=[['/atlas','index.html'],['/','dashboard.html'],...['app.js','dashboard.js','style.css','jakarta-design.css','translations.js','official-data.js','data/jakarta-v1/water-scenario.json'].map(path=>['/'+path+'?v='+tag,path])];
const expected=assets.map(([url,path])=>({url,path,hash:sha(read(path))}));
const destinations=[process.env.ATLAS_CANONICAL||'https://jakarta-3d-atlas.drnon.workers.dev',process.env.ATLAS_URL||'https://jakarta.nonarkara.org'];
for(const base of destinations){
 let streak=0;
 for(let attempt=0;attempt<30&&streak<3;attempt++){
  const results=await Promise.allSettled(expected.map(async asset=>{
   const url=new URL(asset.url,base);url.searchParams.set('probe',tag+'-'+Date.now()+'-'+attempt);
   const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error(asset.path+' HTTP '+response.status);
   if(sha(Buffer.from(await response.arrayBuffer()))!==asset.hash)throw new Error(asset.path+' old bytes');
  }));
  const failures=results.filter(r=>r.status==='rejected');
  streak=failures.length?0:streak+1;
  if(failures.length)console.log('Waiting for '+new URL(base).host+': '+failures.map(r=>r.reason.message).join(', '));
  if(streak<3)await new Promise(resolve=>setTimeout(resolve,1500));
 }
 if(streak<3)throw new Error('Byte convergence failed: '+base);
 console.log('PASS three consecutive matching byte probes: '+base+' · '+tag);
}
