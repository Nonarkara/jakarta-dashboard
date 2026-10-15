import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const css=read('public/jakarta-design.css');
const html=read('public/dashboard.html');

// The phone Menu drawer. At 390px this panel is 180px wide and is anchored to the
// trailing edge of its trigger, which sits inside the masthead's right inset.
// Anchoring it at left:0 instead started the panel at the trigger's left edge and
// ran it to x=397, seven pixels past a 390px viewport.
//
// The rule is the fix; these assertions stop that geometry from coming back.
const rule=css.match(/body\[data-surface="jakarta-dashboard"\] \.city-navigation \.sections \{([^}]*)\}/);
assert.ok(rule,'the phone section drawer rule must exist');

const body=rule[1];
assert.match(body,/position:absolute/,'the drawer is an overlay, not document flow');
assert.match(body,/top:100%/,'the drawer hangs from its trigger');
assert.match(body,/right:0/,'anchor to the trigger trailing edge so the panel cannot run past the viewport');
assert.doesNotMatch(body,/(^|[;\s])left:0/,'a left:0 anchor placed this panel 7px outside a 390px viewport');
assert.doesNotMatch(body,/min-width:/,'min-width ignores the inline space actually available');
assert.match(body,/width:min\(180px,calc\(100vw - 16px\)\)/,'cap the drawer with the inline space the viewport has');
assert.match(body,/max-height:70svh/,'the drawer keeps its bounded height');
assert.match(body,/overflow:auto/,'drawer content scrolls instead of extending the page');

// The trigger must remain a right-aligned grid item for a trailing anchor to sit
// inside the viewport at phone widths. That alignment is established at the
// 1000px breakpoint, which the 390px phone inherits.
const narrow=css.slice(css.indexOf('@media(max-width:1000px)'));
assert.match(narrow,/\.city-navigation \{[^}]*justify-self:end/,'the trigger stays right-aligned so right:0 anchors inside the viewport');
assert.match(narrow,/\.city-navigation \{[^}]*position:relative/,'the trigger stays the containing block for the absolute drawer');

// The drawer ships open in the markup, so it is reachable without a tap target
// change and must remain keyboard reachable.
assert.match(html,/<details id="city-navigation" class="city-navigation" open>/,'the phone drawer ships open');
assert.match(html,/<nav class="sections" aria-label="Navigasi">/,'the drawer is a labelled navigation region');

// The masthead keeps its established compact phone height; this fix is drawer
// geometry only and must not restyle the bar.
const phone=css.slice(css.indexOf('@media(max-width:600px)'));
assert.match(phone,/\.city-navigation > summary \{[^}]*height:21px/,'the 21px phone masthead row is unchanged');

console.log('PASS phone menu drawer: trailing-edge anchor and viewport-capped width keep the 390px drawer inside the viewport');