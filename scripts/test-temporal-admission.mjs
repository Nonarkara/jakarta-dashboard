import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { admitModel, currentHourIndex, currentHourStart, MODEL_STALE_MS } from '../public/temporal-admission.js';

const now = Date.UTC(2026, 9, 19, 3, 20);
const hour = currentHourStart(now);
const iso = (h) => new Date(h).toISOString();

// ── The anchor never rounds towards the nearest hour ───────────────────────
// This is the defect that lived in two lenses: a model that does not cover now
// was drawn from whichever hour sat closest, and read as if it were now.
const hours = [hour - 3 * 3600000, hour - 2 * 3600000, hour - 3600000, hour, hour + 3600000, hour + 2 * 3600000].map(iso);
assert.equal(currentHourIndex(hours, now), 3, 'the exact current hour is found');

// Drop the current hour. Nothing adjacent may be substituted.
const without = hours.filter((h) => Date.parse(h) !== hour);
assert.equal(currentHourIndex(without, now), -1, 'a gap returns -1, never a neighbour');
assert.equal(currentHourIndex(without, now - 3600000), 2, 'an hour whose own hour is present still resolves exactly');
assert.equal(currentHourIndex([], now), -1);
assert.equal(currentHourIndex(null, now), -1);
assert.equal(currentHourIndex(['not-a-date', iso(hour)], now), 1, 'unparseable entries are skipped, not guessed');

// ── Admission ───────────────────────────────────────────────────────────────
const envelope = (over = {}) => ({
  available: true,
  checkedAt: new Date(now).toISOString(),
  hours,
  cells: [{ lat: -6, lng: 106, mslpHpa: 1012 }],
  ...over,
});

const ok = admitModel(envelope(), now);
assert.equal(ok.ok, true, 'a fresh envelope covering this hour is admitted');
assert.equal(ok.index, 3, 'admission returns the index it anchored to');

assert.equal(admitModel(envelope({ available: false }), now).reason, 'unavailable');
assert.equal(admitModel(envelope({ checkedAt: undefined }), now).reason, 'unavailable', 'a payload with no checkedAt is not a current field');
assert.equal(admitModel(null, now).reason, 'unavailable');
assert.equal(admitModel(envelope({ checkedAt: new Date(now + 10 * 60000).toISOString() }), now).reason, 'future');
assert.equal(admitModel(envelope({ checkedAt: new Date(now - MODEL_STALE_MS - 1000).toISOString() }), now).reason, 'expired');
assert.equal(admitModel(envelope({ checkedAt: new Date(now - MODEL_STALE_MS + 1000).toISOString() }), now).ok, true, 'just inside the window is still admitted');
assert.equal(admitModel(envelope({ cells: [] }), now).reason, 'empty');
assert.equal(admitModel(envelope({ hours: without }), now).reason, 'no-current-hour',
  'a fresh model that does not cover now is a gap, not a current field');

// ── Every live lens must ask the same question ─────────────────────────────
// A third copy of the borrow rule is how this came back twice. The lenses
// import the one admission module, and none of them keeps its own scan.
for (const file of ['synoptic.js', 'haze-transport.js', 'wind-field.js', 'research-session.js']) {
  const src = readFileSync(new URL('../public/' + file, import.meta.url), 'utf8');
  assert.match(src, /from '\.\/temporal-admission\.js'/, `${file} uses the shared admission rule`);
  assert.doesNotMatch(src, /Math\.abs\(Date\.parse\(h\)\s*-\s*now\)/,
    `${file} does not keep a "closest hour" scan that can borrow a neighbour`);
}

console.log('PASS temporal admission: exact-hour anchor, no neighbour borrow, one shared rule across every live lens');