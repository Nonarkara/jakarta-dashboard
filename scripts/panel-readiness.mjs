// Runs inside the audited page. Quiet text is not proof that a request ended.
// Expansion repeats because an opened lazy section may create more disclosures.
export async function panelReadiness({expand=false,timeoutMs=45000,quietMs=700,pollMs=100}={}){
 const start=Date.now();let signature=null,stableSince=start,opened=0,lastPending=[];
 while(Date.now()-start<timeoutMs){
  const body=document.getElementById('atlas-lens-body');
  if(!body){await new Promise(r=>setTimeout(r,pollMs));continue;}
  let changed=false;
  if(expand)for(const d of body.querySelectorAll('details'))if(!d.open){d.open=true;opened++;changed=true;}
  const pending=[];
  if(/^(Loading\b|Memuat\b|Joining boundary\b|Menggabungkan batas\b)/i.test(body.textContent.trim()))pending.push('panel loading copy');
  if(body.getAttribute('aria-busy')==='true')pending.push('panel requests');
  for(const e of body.querySelectorAll('[aria-busy="true"]'))pending.push(e.className||e.tagName);
  // Older lenses have explicit loading copy but no busy attribute yet. Their
  // loading state must terminate too; an outage is a terminal, honest result.
  for(const e of body.querySelectorAll('p,output,[role="status"]'))if(/^(Loading\b|Memuat\b|Joining boundary\b|Menggabungkan batas\b)/i.test(e.textContent.trim()))pending.push(e.textContent.trim().slice(0,80));
  for(const node of body.childNodes||[])if(node.nodeType===3&&/^(Loading\b|Memuat\b|Joining boundary\b|Menggabungkan batas\b)/i.test(node.textContent.trim()))pending.push('direct loading text');
  const controls=[...body.querySelectorAll('button,summary,input,select,textarea')];
  const next=body.textContent+'\n'+controls.map(e=>[e.tagName,e.textContent,e.value,e.disabled,e.hidden].join('|')).join('\n');
  if(changed||next!==signature||pending.length){signature=next;stableSince=pending.length?null:Date.now();}
  if(!pending.length&&stableSince===null)stableSince=Date.now();
  lastPending=pending;
  if(!changed&&!pending.length&&body.textContent.trim().length&&Date.now()-stableSince>=quietMs)return {ready:true,opened,controls:controls.length,elapsedMs:Date.now()-start};
  await new Promise(r=>setTimeout(r,pollMs));
 }
 return {ready:false,opened,elapsedMs:Date.now()-start,pending:lastPending,reason:signature===null?'panel absent':lastPending.length?'sources still loading':'panel never settled or had no controls'};
}
