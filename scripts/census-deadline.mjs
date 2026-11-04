// Reject an unreadable measurement. A pending browser evaluation is not proof
// of stable geometry, and must never turn into a successful receipt.
export async function censusDeadline(operation,timeoutMs,describe){
 let timer;
 try{
  return await Promise.race([operation,new Promise((_,reject)=>{
   timer=setTimeout(()=>{const error=Error(`census timeout after ${timeoutMs}ms: ${describe()}`);error.code='CENSUS_TIMEOUT';reject(error);},timeoutMs);
  })]);
 }finally{clearTimeout(timer);}
}
