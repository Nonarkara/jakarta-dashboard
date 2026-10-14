// Fail if a shared checkout changes after the stamped deploy inputs are frozen.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function snapshotInputs(root, paths) {
  return Object.fromEntries(paths.map(path=>[path,createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')]));
}
export function changedInputs(root, snapshot) {
  return Object.entries(snapshot).flatMap(([path,expected])=>{
    try {return snapshotInputs(root,[path])[path]===expected?[]:[path];}
    catch {return [path];}
  });
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [mode,file]=process.argv.slice(2);
  if (!['write','check'].includes(mode)||!file) throw new Error('usage: release-snapshot.mjs write|check FILE');
  if (mode==='write') {
    const paths=execFileSync('git',['ls-files','-z','--','public','src','scripts','package.json','package-lock.json','wrangler.toml','wrangler.jsonc'],{encoding:'utf8'}).split('\0').filter(Boolean);
    writeFileSync(file,JSON.stringify(snapshotInputs(process.cwd(),paths)),{flag:'wx'});
  } else {
    const changed=changedInputs(process.cwd(),JSON.parse(readFileSync(file,'utf8')));
    if(changed.length) throw new Error('Release inputs changed after stamping; do not commit a false deploy receipt: '+changed.join(', '));
  }
}
