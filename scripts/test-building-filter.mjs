import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(app.slice(app.indexOf('const BUILDING_TYPE_GROUPS'),app.indexOf('function reportBuildingView()')),context);
const normal=input=>context.normalizeBuildingFilter(input),expr=input=>context.buildingFilterExpression(input);
const base={min:0,max:500,kind:'all',source:'all',unknown:true};
for(const patch of [{min:-1},{max:501},{min:100,max:50},{min:NaN},{kind:'invented'},{source:'invented'},{unknown:'true'}])assert.equal(normal({...base,...patch}),null,'reject invalid filter');
assert.equal(expr(base),null,'unfiltered means restore existing layer filters');
function evaluate(node,p){
 if(!Array.isArray(node))return node;
 const [op,...args]=node;
 if(op==='get')return p[args[0]];
 if(op==='literal')return args[0];
 const values=args.map(n=>evaluate(n,p));
 if(op==='coalesce')return values.find(v=>v!=null);
 if(op==='to-number'){const n=Number(values[0]);return Number.isFinite(n)?n:values[1];}
 if(op==='all')return values.every(Boolean);
 if(op==='any')return values.some(Boolean);
 if(op==='in')return values[1].includes(values[0]);
 if(op==='>')return values[0]>values[1];
 if(op==='>=')return values[0]>=values[1];
 if(op==='<=')return values[0]<=values[1];
 throw Error('unexpected expression '+op);
}
const range={...base,min:50,max:150,unknown:false};
for(const [h,pass] of [[0,false],[49,false],[50,true],[150,true],[151,false]])assert.equal(evaluate(expr(range),{h}),pass);
assert.equal(evaluate(expr({...range,unknown:true}),{}),true,'unknown source heights are an explicit choice');
assert.equal(evaluate(expr({...range,kind:'housing',source:'measured'}),{h:100,cls:'house',hs:'measured'}),true);
assert.equal(evaluate(expr({...range,kind:'housing',source:'measured'}),{h:100,cls:'house',hs:'google'}),false,'satellite heights cannot pass a tagged-height filter');
assert.equal(evaluate(expr({...range,source:'ghsl'}),{h:100,hs:'satellite'}),true,'legacy GHSL tag is retained');
const part={height:6,exploreHeight:132,exploreKind:'landmark',exploreSource:'landmark'};
assert.equal(evaluate(expr({...range,kind:'landmark',source:'landmark'}),part),true,'filter landmark by its tallest published part');assert.equal(part.height,6,'filter never changes extrusion height');
console.log('PASS building filters: bounds, unknowns, height provenance, grouped tags and landmark-part semantics');
