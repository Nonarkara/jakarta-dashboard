// Mutation tests need source and declared reference inputs, not a second copy
// of raw GIS archives, Wrangler state, or the built site on every iteration.
import {cpSync,statSync,rmSync} from 'node:fs';
import {relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
export const fixtureRoot=fileURLToPath(new URL('../',import.meta.url));
const roots=new Set(['public','scripts','docs','src','design']);
const references=new Set(['public/data/jakarta-v1/waterways.geojson']);
export function copyMutationFixture(repo,dir){
 cpSync(repo,dir,{recursive:true,filter:source=>{
  const rel=relative(repo,source).split(sep).join('/');
  if(!rel||['package.json','AGENTS.md'].includes(rel))return true;
  if(!roots.has(rel.split('/')[0]))return false;
  if(rel==='public/data'||rel==='public/data/jakarta-v1')return true;
  if(rel.startsWith('public/data/'))return references.has(rel);
  return statSync(source).isDirectory()||/\.(?:mjs|js|css|html|ts|md|json)$/.test(rel);
 }});
}
export function verifyMutationFixture(dir,test){
 try{execFileSync(process.execPath,[test],{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});}
 catch(error){rmSync(dir,{recursive:true,force:true});throw error;}
 console.log('PASS clean reduced fixture: '+test);
}

// An infrastructure failure is not a killed mutation, even if captured text
// contains an assertion prefix before the child was interrupted.
export const normalMutationFailure=result=>Number.isInteger(result?.status)&&result.status!==0&&!result.signal&&!result.error;
