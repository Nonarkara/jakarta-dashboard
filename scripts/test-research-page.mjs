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
console.log('test-research-page: ok');
