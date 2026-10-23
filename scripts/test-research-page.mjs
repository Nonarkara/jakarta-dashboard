// The research page: bilingual, house style, and every figure read from a
// shipped file at load time rather than typed into the HTML.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('public/research.html'), js = read('public/research.js'), server = read('src/index.ts');

assert.match(server, /path === "\/research"/, '/research is routed');
assert.match(read('public/dashboard.html'), /href="\/research"/, 'the dashboard links to it');
assert.match(read('public/index.html'), /href="\/research"/, 'the atlas links to it');

const en = (html.match(/<span lang="en">/g) || []).length, id = (html.match(/<span lang="id">/g) || []).length;
assert.ok(en > 40 && en === id, `every English span has an Indonesian twin (${en} en / ${id} id)`);

const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
assert.doesNotMatch(style, /border-radius|gradient|box-shadow/, 'no radius, gradient or shadow');
assert.doesNotMatch(html, /Roboto|Inter\b|Poppins|Montserrat|Open Sans|Lato|Sarabun|Looped/, 'no banned fonts');
assert.ok(new Set(style.match(/--(display|body|micro):\d+px/g)).size === 3, 'three type sizes');

// Figures come from files, not from the markup.
assert.doesNotMatch(html, /3[ ,.]?380[ ,.]?317|2[ ,.]?619/, 'no live or baked count is typed into the HTML');
for (const f of ['buildings-stats.json', 'source-catalog.json', 'transit.json', '/api/atlas/synoptic', '/api/atlas/fires']) assert.ok(js.includes(f), `reads ${f}`);
// The live panel runs the atlas modules themselves, not a re-implementation.
for (const m of ['./synoptic.js', './haze-transport.js', './flow-canvas.js']) assert.ok(js.includes(`from '${m}'`), `imports ${m}`);
assert.match(js, /cancelAnimationFrame/, 'the animation stops when the page is hidden');
assert.match(js, /prefers-reduced-motion/, 'reduced motion draws a still frame');

const stats = JSON.parse(read('public/data/jakarta-v1/buildings-stats.json'));
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
assert.equal(sum(stats.height), stats.count, 'every building has exactly one height source');
assert.equal(sum(stats.source), stats.count, 'and exactly one footprint source');
// The Research page documents the atlas, so it must draw the atlas's contour
// interval rather than a second hardcoded copy. It did carry its own 2 hPa loop
// while the rain lens drew 1 hPa, and the prose then described the wrong number
// in BOTH languages — a bilingual-parity guard cannot catch that, because the
// two languages agree with each other and are both wrong.
{
  const syn = await import('../public/synoptic.js');
  assert.match(js, /isobarLevels/, 'Research draws isobars through the shared isobarLevels()');
  assert.match(js, /ISOBAR_STEP_HPA/, 'Research reads the interval from the module that draws it');
  assert.doesNotMatch(js, /\/\s*2\s*\)\s*\*\s*2;\s*L\s*\+=\s*2/, 'Research carries no second hardcoded contour interval');
  for (const [lang, re] of [['id', /tiap[^<]*<span data-isobar-step>/], ['en', /every[^<]*<span data-isobar-step>/]]) {
    assert.match(html, re, `the ${lang} prose states the interval from the module, not a typed-in number`);
  }
  assert.equal(html.match(/data-isobar-step/g).length, 2, 'both languages mark the interval span');
  // Matching the identifier alone is not enough: it also appears in the import,
  // so deleting the stamping line would leave the HTML's literal in charge with
  // every check still green. Tie the selector to the constant itself.
  assert.match(js, /\[data-isobar-step\][\s\S]{0,140}ISOBAR_STEP_HPA/, 'the prose span is stamped from ISOBAR_STEP_HPA at runtime, not left as an HTML literal');
  assert.ok(Number.isInteger(syn.ISOBAR_STEP_HPA), 'the exported interval is an integer this page can print');
}
console.log('test-research-page: ok');

// Unstated licence is not an established prohibition or a claim of no copying.
assert.doesNotMatch(html,/most publishers here do not permit redistribution|nothing is copied out of them/);
assert.match(html,/redistribution rights remain unresolved/);assert.match(html,/hak redistribusi belum dipastikan/);
