import assert from 'node:assert/strict';
import {normalMutationFailure} from './mutation-fixture.mjs';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const source=readFileSync(new URL('./panel-readiness.mjs',import.meta.url),'utf8');
const tests=[
 ['start quiet time before pending work ends','stableSince=pending.length?null:Date.now();','stableSince=Date.now();',/unchanged pending requests must not pass/],
 ['ignore plain loading text',source.split('\n').find(l=>l.includes("pending.push('panel loading copy')")),'',/plain root loading text is never a ready panel/],
 ['ignore trailing loading text',source.split('\n').find(l=>l.includes("pending.push('direct loading text')")),'',/direct loading text after controls is never ready/],
 ['ignore unchanged in-flight requests',"if(body.getAttribute('aria-busy')==='true')pending.push('panel requests');",'',/unchanged pending requests must not pass/],
 ['expand only the original disclosure','if(expand)for','if(expand&&opened===0)for',/AssertionError/],
 ['compare only text length',"body.textContent+'\\n'","body.textContent.length+'\\n'",/same-length replacement must restart/],
];
for(const [name,from,to,expected] of tests){
 assert.ok(from,'missing mutation anchor: '+name);
 assert.equal(source.split(from).length-1,1,'mutation anchor must match exactly once: '+name);
 const code=source.replace(from,to),module='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
 const result=spawnSync(process.execPath,[new URL('./test-panel-readiness.mjs',import.meta.url).pathname],{encoding:'utf8',env:{...process.env,PANEL_READINESS_MODULE:module},timeout:30000});
 assert.ok(normalMutationFailure(result)&&expected.test(result.stdout+result.stderr),'survived or failed for the wrong reason: '+name+' '+(result.error?.message||result.stderr));
 console.log('KILL '+name);
}
console.log('PASS panel readiness mutants: '+tests.length+'/'+tests.length+' killed, no missing anchors');
