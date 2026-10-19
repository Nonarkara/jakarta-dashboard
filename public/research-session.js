// Research is a current view, not an indefinitely retained forecast snapshot.
// The admission rule itself lives in temporal-admission.js so every live lens
// answers "is this current?" identically.
import { admitModel } from './temporal-admission.js';
export function currentResearchField(data, now = Date.now()) {
  return admitModel(data, now).ok;
}
// FIRMS has a FeatureCollection/fetchedAt contract, not the model's envelope.
export function researchFires(data, now=Date.now()) {
  const fetched=Date.parse(data?.fetchedAt);
  if(data?.type!=='FeatureCollection'||data.windowHours!==24||!Array.isArray(data.features)||!Number.isFinite(fetched)||fetched>now+300000||now-fetched>45*60000)return null;
  const features=data.features.filter(f=>{const at=Date.parse(f?.properties?.observedAt);return Number.isFinite(at)&&at<=now+300000&&now-at<=86400000;});
  return {...data,features,count:features.length};
}
export function createResearchSession({load,render,status,document:doc=globalThis.document,now=Date.now,setTimer=setInterval,clearTimer=clearInterval}) {
  let disposed=false,busy=false,generation=0,lastAttempt=-Infinity,cleanup=null,controller=null;
  const clearView=()=>{cleanup?.();cleanup=null;};
  async function refresh() {
    if(disposed||busy||doc.hidden)return;
    busy=true;lastAttempt=now();const token=++generation;
    clearView();status('loading');controller=new AbortController();
    try {
      const value=await load(controller.signal);
      if(disposed||token!==generation)return;
      cleanup=render(value)||null;
    } catch {
      if(!disposed&&token===generation)status('unavailable');
    } finally {if(token===generation){busy=false;controller=null;}}
  }
  const tick=()=>{if(!doc.hidden&&now()-lastAttempt>=300000)void refresh();};
  const visibility=()=>{
    // Never resume an old animation. Retire its listeners before a fresh fetch.
    if(doc.hidden){generation++;controller?.abort();controller=null;busy=false;clearView();status('paused');}
    else void refresh();
  };
  doc.addEventListener('visibilitychange',visibility);
  const timer=setTimer(tick,30000);timer?.unref?.();
  void refresh();
  return {refresh,clear(){disposed=true;generation++;controller?.abort();clearView();clearTimer(timer);doc.removeEventListener('visibilitychange',visibility);}};
}
