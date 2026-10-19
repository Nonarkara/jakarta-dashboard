// One rule for admitting a model field to a live lens.
//
// The failure this exists to prevent: a lens fetches once, the tab stays open,
// and the drawn field silently becomes a neighbour's hour or an expired cache —
// still rendered as if it were now. Every live surface must ask this question
// the same way, or the bug returns wherever the copy was made.
//
// A neighbouring hour is stale data, not an approximation of now. Missing stays
// missing; it is never rounded towards the nearest available value.

export const MODEL_STALE_MS = 10 * 60 * 1000;
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

// The current wall-clock hour, truncated. Model hours are whole hours.
export function currentHourStart(now = Date.now()) {
  return Math.floor(now / 3600000) * 3600000;
}

// Index of the exact current hour, or -1. Never returns a neighbour.
export function currentHourIndex(hours, now = Date.now()) {
  if (!Array.isArray(hours) || !hours.length) return -1;
  const hour = currentHourStart(now);
  return hours.findIndex((h) => Date.parse(h) === hour);
}

// Admit a model envelope to a live surface.
// Returns { ok: true, index } or { ok: false, reason } — reason is a stable code
// the caller renders in its own language. This module never formats text.
export function admitModel(payload, now = Date.now(), maxAgeMs = MODEL_STALE_MS) {
  if (!payload || payload.available !== true) return { ok: false, reason: 'unavailable' };
  const checked = Date.parse(payload.checkedAt);
  if (!Number.isFinite(checked)) return { ok: false, reason: 'unavailable' };
  if (checked > now + FUTURE_TOLERANCE_MS) return { ok: false, reason: 'future' };
  if (now - checked > maxAgeMs) return { ok: false, reason: 'expired' };
  if (!Array.isArray(payload.cells) || !payload.cells.length) return { ok: false, reason: 'empty' };
  const index = currentHourIndex(payload.hours, now);
  if (index < 0) return { ok: false, reason: 'no-current-hour' };
  return { ok: true, index };
}

// A gap is different from a refusal. The hours a model does return are real,
// time-labelled forecast hours and stay explorable — but nothing here is "now",
// and the panel says so rather than opening on a neighbour.
export function scrubGapMessage(t) {
  return t('This model does not cover the current hour. The hours below are real forecast hours; the field opens at the earliest one and is not showing now.',
    'Model ini tidak mencakup jam saat ini. Jam di bawah adalah jam prakiraan yang nyata; medan ini dibuka dari jam paling awal dan bukan menampilkan kondisi saat ini.');
}

// Bilingual copy for the refusal. The reason is stated, never smoothed over, and
// a refusal never implies an all-clear.
export function admissionMessage(reason, t) {
  const pair = {
    unavailable: ['The pressure model did not answer. Nothing is drawn in its place.',
      'Model tekanan tidak menjawab. Tidak ada yang digambar sebagai gantinya.'],
    future: ['The source clock is ahead of this device. Nothing is drawn in its place.',
      'Jam sumber lebih maju daripada perangkat ini. Tidak ada yang digambar sebagai gantinya.'],
    expired: ['The model check is older than 10 minutes, so it is no longer a current field. Nothing is drawn in its place.',
      'Pemeriksaan model lebih lama dari 10 menit, jadi ini bukan medan terkini. Tidak ada yang digambar sebagai gantinya.'],
    empty: ['The model returned no usable cells for this hour. Nothing is drawn in its place.',
      'Model tidak mengembalikan sel yang dapat dipakai untuk jam ini. Tidak ada yang digambar sebagai gantinya.'],
    'no-current-hour': ['The model does not cover this hour, so no current field is available. Nothing is drawn in its place.',
      'Model tidak mencakup jam ini, jadi tidak ada medan terkini. Tidak ada yang digambar sebagai gantinya.'],
  }[reason] || ['No current field is available. Nothing is drawn in its place.',
    'Tidak ada medan terkini yang tersedia. Tidak ada yang digambar sebagai gantinya.'];
  return t(pair[0], pair[1]);
}