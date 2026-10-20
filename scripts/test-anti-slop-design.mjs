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
for(const id of ['field','flow','height-bars','figures','src-status','src-licence','src-licence-detail']) assert.match(html,new RegExp('id="'+id+'"'),'earned visual '+id+' remains');
for(const id of ['h-live','h-pipe','h-sat','h-height','h-maths','h-rules','h-src']) assert.match(html,new RegExp('id="'+id+'"'),'earned section '+id+' remains');
assert.match(html,/class="stage" hidden/,'loading/outage cannot leave a huge empty diagram');
assert.match(js,/base\.parentElement\.hidden = false/,'valid data restores the diagram');
assert.match(js,/if \(document.hidden \|\| !ctx \|\| !playing \|\| reduced\(\)\) return/,'animation is gated by intent and reduced motion');

// Execute the real Research client with one failed and one indefinitely slow source.
// A stalled file must not block other figures; a missing catalogue must never become 0.
const nodes=new Map();
const node=()=>({children:[],textContent:'',hidden:false,disabled:false,style:{},attributes:{},dataset:{},className:'',parentElement:{hidden:true},append(...n){this.children.push(...n)},replaceChildren(...n){this.children=n},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,f){this[k]=f}});
const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
const links=[{href:'https://jakarta.nonarkara.org/atlas?lens=rain'}];
const root={dataset:{},lang:'id'};
const source=js.replace(/^import .* from .*;\n/gm,'');
const meta=node();
const doc={documentElement:root,getElementById:get,querySelectorAll:()=>links,querySelector:s=>s==='meta[name="description"]'?meta:null,createElement:()=>node(),createTextNode:text=>({textContent:text}),addEventListener(){}};
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

// ── The evidence rail must state an order, not just sizes ─────────────────
// It once ran 13 / 12 / 12 / 11 — lens name, values, controls and caveats all
// within two pixels. Nothing could win, so the eye had no order to follow. A
// flat scale is not a quiet design; it is a missing hierarchy.
{
  // Match a selector as a whole token. Splitting the selector list on commas
  // means `.synoptic-toggles button` resolves to that rule, and `.synoptic-facts
  // dt` is never mistaken for `.synoptic-facts`.
  const rule = (sel, prop) => {
    let found = null;
    for (const block of css.split('}')) {
      const i = block.lastIndexOf('{');
      if (i < 0) continue;
      const sels = block.slice(0, i).split(',').map((x) => x.trim());
      if (!sels.some((x) => x === sel || x.endsWith(' ' + sel))) continue;
      const body = block.slice(i + 1);
      if (new RegExp(`${prop}\\s*:`).test(body)) found = body;
    }
    assert.ok(found, `the rail states ${prop} for ${sel}`);
    return found;
  };
  const px = (body, prop) => { const m = body.match(new RegExp(`${prop}\\s*:\\s*(\\d+)px`)); return m ? +m[1] : null; };

  const title = rule('.synoptic-title', 'font-size');
  const facts = px(rule('.synoptic-facts', 'font-size'), 'font-size');
  const note  = px(rule('.synoptic-note', 'font-size'), 'font-size');
  const btn   = px(rule('.synoptic-toggles button', 'font-size'), 'font-size');

  const scale = [px(title, 'font-size'), facts, btn, note];
  for (const v of scale) assert.equal(typeof v, 'number', 'every rank resolves to a px size');
  for (let i = 1; i < scale.length; i++) {
    assert.ok(scale[i] < scale[i - 1], `rank ${i} (${scale[i]}px) sits below rank ${i - 1} (${scale[i - 1]}px)`);
  }
  assert.ok(scale[0] - scale[3] >= 3, `the rail states an order: ${scale.join(' / ')}`);

  // Labels sit below the values they name, or a number and its label arrive as
  // one undifferentiated block of grey.
  const dt = rule('.synoptic-facts dt', 'font-size');
  assert.ok(px(dt, 'font-size') < facts, 'a label is smaller than the value it names');
  console.log(`PASS evidence rail states an order (${scale.join(' / ')}), labels below their values`);
}

// ── An index that hides sections is a missing hierarchy ───────────────────
// The research page carried eight sections and its own contents nav linked
// five. The three it dropped included the height-provenance section, which
// holds the only graphic that renders without a network call. The guard above
// only ever asked whether an id existed, so it stayed green while a third of
// the page was unreachable from its own table of contents. Presence is not
// reachability: assert that every section answers to a link.
{
  const nav = html.match(/<nav class="contents"[\s\S]*?<\/nav>/)[0];
  const linked = new Set([...nav.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]));
  const sections = [...html.matchAll(/<section[^>]*aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(sections.length >= 8, `the page keeps its sections (${sections.length} found)`);
  const orphans = sections.filter((id) => !linked.has(id));
  assert.deepEqual(orphans, [], `every section is reachable from the contents nav; orphans: ${orphans.join(', ')}`);
  const dead = [...linked].filter((id) => !sections.includes(id));
  assert.deepEqual(dead, [], `every contents link points at a real section; dangling: ${dead.join(', ')}`);

  // Both languages carry the same index, or the page is half navigable.
  const navIds = [...nav.matchAll(/<a href="#[^"]+"><span lang="id">[^<]*<\/span><span lang="en">[^<]*<\/span><\/a>/g)];
  assert.equal(navIds.length, sections.length, 'each contents entry carries both languages');
  console.log(`PASS research index reaches all ${sections.length} sections, bilingual`);
}

// ── The research page must be reachable from the map ──────────────────────
// It existed behind two clicks and was the one page nobody could get to from
// the atlas. This runs the real drawer block out of app.js and inspects the
// tree it builds, so removing the link — or burying it inside a collapsed
// <details> — fails here rather than on someone's screen.
{
  const app = read('public/app.js');
  const block = app.slice(app.indexOf('const embedded = window.parent'), app.indexOf("document.getElementById('atlas-lens-evidence').append(lensPopup)"));
  assert.ok(block.length > 200, 'the atlas page-tools block is present');

  const made = [];
  const mk = (tag) => {
    // The real DOM reports tagName upper-case for HTML elements.
    const n = { tagName: String(tag).toUpperCase(), children: [], attrs: {}, className: '', textContent: '', dataset: {},
      append(...k) { this.children.push(...k); }, replaceChildren(...k) { this.children = k; } };
    Object.defineProperty(n, 'classList', { value: { add() {} } });
    made.push(n);
    return n;
  };
  const mapWrap = { children: [], append(...k) { this.children.push(...k); } };
  const body = { classList: { add() {} } };
  const host = {
    document: {
      body,
      documentElement: { classList: { add() {} } },
      createElement: mk,
      getElementById: (id) => ({ append() {}, style: {} }),
      querySelector: (s) => (s === '.atlas-map-wrap' ? mapWrap : null),
      querySelectorAll: () => [],
      addEventListener() {},
    },
    window: { parent: {}, addEventListener() {} },
  };
  vm.createContext(host);
  vm.runInContext(block, host);

  assert.equal(mapWrap.children.length, 1, 'the page-tools row is mounted once');
  const tools = mapWrap.children[0];
  assert.equal(tools.className, 'atlas-page-tools', 'the row carries its own hook');
  const link = tools.children.find((n) => n.tagName === 'A');
  assert.ok(link, 'the atlas offers a link out to the research page');
  assert.equal(link.attrs.href ?? link.href, '/research', 'the research link points at the research page');
  assert.equal(link.className, 'atlas-research-link', 'the research link is styleable as chrome');
  assert.ok(!link.closest, 'the link is built directly, not inherited from a collapsed control');
  const drawer = tools.children.find((n) => n.tagName === 'DETAILS');
  assert.ok(drawer, 'the existing evidence drawer still ships beside it');
  assert.equal(link.textContent, 'Research & method', 'the research page has exactly one name');
  assert.match(read('public/translations.js'), /"Research & method": "Riset & metode"/, 'the research link is translated');
  console.log('PASS the atlas mounts a research door beside the evidence drawer, in both languages');
}
