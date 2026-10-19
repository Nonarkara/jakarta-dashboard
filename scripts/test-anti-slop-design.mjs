// Objective contracts only. Responsive screenshot + independent review is a separate gate.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {currentResearchField,createResearchSession,researchFires} from '../public/research-session.js';
import {labelPosition} from '../public/research-labels.js';
// research.js imports the atlas synoptic module; the sandbox strips import
// statements, so the real module is injected here rather than stubbed. Without
// it, drawing the shared contour interval throws ISOBAR_STEP_HPA is not defined.
import * as synoptic from '../public/synoptic.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('public/research.html'), css=read('public/jakarta-design.css'), js=read('public/research.js');
const style=html.match(/<style>([\s\S]*?)<\/style>/)[1];
assert.match(html,/href="\/jakarta-design\.css\?v=/,'Research shares the actual city design');
assert.match(html,/src="\/theme\.js"/,'Research shares saved reading conditions');
const faces=[...css.matchAll(/@font-face\s*\{\s*font-family:\s*"([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(faces,['Universa Civic','Source Sans 3'],'two authored font families');
assert.match(style,/--sans:var\(--font-sans\)/,'body uses the shared reading family');
assert.match(style,/h1\{[^}]*var\(--font-display\)/,'Bayer face remains the display choice');
assert.doesNotMatch(style,/system-ui|-apple-system|BlinkMacSystemFont|border-radius|box-shadow|gradient/,'no isolated system design or depth ornaments');
assert.match(style,/html\{scroll-padding-top:52px\}/,'section anchors clear the sticky bar');
assert.doesNotMatch(js,/ui-monospace|Menlo|-apple-system/,'canvas text uses the same authored fonts');
assert.match(style,/p\{max-width:65ch\}/,'all Research prose has a reading measure');
assert.doesNotMatch(style,/repeat\(7/,'no seven narrow process columns');
for(const selector of ['figures','status']) {
 const rule=style.match(new RegExp('\\.'+selector+'\\{([^}]+)'))[1];
 assert.match(rule,/display:flex;flex-wrap:wrap/,'metrics wrap to their contents');
 assert.doesNotMatch(rule,/border-left|grid-template-columns/,'metrics are not equal framed tiles');
}
assert.match(style,/\.maths\{display:grid;gap:24px\}/,'maths retain a sequential reading order');
assert.match(read('public/dashboard.css'),/\.warning p\{max-width:65ch\}/,'warning text no longer owns a nested scrollbar');
for(const id of ['field','flow','height-stack','height-legend','figures','src-status']) assert.match(html,new RegExp('id="'+id+'"'),'earned visual '+id+' remains');
for(const id of ['h-live','h-pipe','h-sat','h-height','h-maths','h-rules','h-src']) assert.match(html,new RegExp('id="'+id+'"'),'earned section '+id+' remains');
assert.match(html,/class="stage" hidden/,'loading/outage cannot leave a huge empty diagram');
assert.match(js,/base\.parentElement\.hidden = false/,'valid data restores the diagram');
assert.match(js,/if \(document.hidden \|\| !ctx \|\| !playing \|\| reduced\(\)\) return/,'animation is gated by intent and reduced motion');

// Execute the real Research client with one failed and one indefinitely slow source.
// A stalled file must not block other figures; a missing catalogue must never become 0.
const nodes=new Map();
const node=()=>({children:[],textContent:'',hidden:false,disabled:false,style:{},attributes:{},parentElement:{hidden:true},append(...n){this.children.push(...n)},replaceChildren(...n){this.children=n},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,f){this[k]=f}});
const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
const links=[{href:'https://jakarta.nonarkara.org/atlas?lens=rain'}];
const root={dataset:{},lang:'id'};
const source=js.replace(/^import .* from .*;\n/gm,'');
const doc={documentElement:root,getElementById:get,querySelectorAll:()=>links,createElement:()=>node(),createTextNode:text=>({textContent:text}),addEventListener(){}};
const fixture={count:123,height:{estimated:123}};
const context=vm.createContext({...synoptic,document:doc,currentResearchField,createResearchSession,researchFires,researchFires,location:{search:'?lang=en',href:'https://jakarta.nonarkara.org/research?lang=en'},localStorage:{getItem(){return null},setItem(){}},URL,URLSearchParams,AbortSignal,Date,console,window:{addEventListener(){}},getComputedStyle:()=>({getPropertyValue:()=> '#123747'}),fetch:async url=> {
 if(url.includes('transit'))return new Promise(()=>{});
 return {ok:!url.includes('source-catalog'),json:async()=>url.includes('buildings-stats')?fixture:null};
}});
vm.runInContext(source,context);
await new Promise(resolve=>setImmediate(resolve));
assert.equal(get('fig-buildings').textContent,'123','slow transit does not hold the building figure hostage');
assert.equal(get('figures').children[2].children[0].textContent,'—','failed catalogue is unknown, not 0 integrated');
assert.equal(get('figures').children[3].children[0].textContent,'—','failed catalogue is unknown, not 0 assessed');
assert.equal(get('field').parentElement.hidden,true,'model outage leaves no empty fixed-aspect stage');
assert.equal(get('field-motion').hidden,true,'no play control for an unavailable field');
assert.match(links[0].href,/lens=rain&lang=en/,'cross-page links retain lens and language');
assert.match(get('live-caption').textContent,/did not answer/,'outage is visible');

// Repeated slow-wind points must not overlap their time labels or leave the canvas.
const occupied=[{x:230,y:210,width:100,height:36}];
for(const [x,y] of [[220,210],[225,212],[230,214],[235,216]]) {
 const box=labelPosition(x,y,60,36,{width:1080,height:1080},occupied);
 assert.ok(box,'all four nearby time labels get a slot');
 assert.ok(!occupied.some(b=>box.x<b.x+b.width+6&&box.x+box.width+6>b.x&&box.y<b.y+b.height+6&&box.y+box.height+6>b.y),'label rectangles do not overlap');
 occupied.push(box);
}
assert.equal(labelPosition(0,0,100,100,{width:20,height:20},[]),null,'too small is explicitly unplaceable');
const edge=labelPosition(1070,1070,60,36,{width:1080,height:1080},[]);
assert.ok(edge.x+edge.width<=1076&&edge.y+edge.height<=1076,'edge labels stay inside');
const pkg=JSON.parse(read('package.json'));
assert.match(pkg.scripts.test,/npm run audit:design/,'design contracts run in every full test/release');
assert.match(read('AGENTS.md'),/ANTI-SLOP-DESIGN/,'instructions travel with the repository');
console.log('PASS anti-slop contracts, preserved visuals, independent loading, truthful unknowns, motion and language continuity');

// ── A containing block on an ancestor silently hides the lens panel ────────
// .atlas-lens-popup is position:fixed and lives INSIDE the .atlas-lenses
// scroller. Any mask, filter, transform, perspective or contain on that
// ancestor establishes a containing block, which clips the panel to the 36px
// strip and makes it vanish from the page. This shipped once and every
// computed-style check still passed; only a screenshot caught it.
{
  const traps = /(^|[;\s])(?:-webkit-)?mask(?:-image)?\s*:|(^|[;\s])filter\s*:|(^|[;\s])transform\s*:|(^|[;\s])perspective\s*:|(^|[;\s])contain\s*:/;
  for (const block of css.split('}')) {
    const head = block.split('{')[0];
    if (!/\.atlas-lenses\b|#atlas-lens-evidence\b/.test(head)) continue;
    assert.doesNotMatch(block, traps,
      `no containing-block property on "${head.trim().slice(0, 60)}" — it would trap the fixed lens panel`);
  }
  console.log('PASS no ancestor of the fixed lens panel establishes a containing block');
}
