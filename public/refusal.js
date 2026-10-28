// One reader for a refused request.
//
// The failure this exists to prevent: the API refuses a request — HTTP 429,
// "too many requests" — and the client treats the refusal as a missing or
// broken source. The water lens answered "0 current levels · 58 without a
// usable level" for a request that was never measured, which is a claim
// about the city's water made from a request that was refused.
//
// A refusal is not an outage, not a zero and not an all-clear. Nothing was
// measured, so nothing may be claimed about the subject. The server answers a
// refusal with a `retry-after` header and a body carrying `retryAfterSeconds`;
// the reader never drops that window, because a refusal that reaches the
// screen must say when to come back.
//
// This module reads and states. It never renders, and it never decides what a
// panel means — each lens says the refusal in its own words, in the reader's
// language, using the shared reason below.

export const REFUSAL_STATUS = 429;

// The window the server asks the client to wait, in seconds. The body is the
// server's own count; the header is the HTTP contract. Either may be absent,
// and a refusal without a window is still a refusal.
export function refusalSeconds(response, body) {
  const fromBody = body?.retryAfterSeconds;
  if ((typeof fromBody === 'number' || typeof fromBody === 'string') && String(fromBody).trim() && Number.isFinite(Number(fromBody)) && Number(fromBody) > 0) return Math.ceil(Number(fromBody));
  const raw = response?.headers?.get?.('retry-after');
  const header = Number(raw);
  if (Number.isFinite(header) && header > 0) return Math.ceil(header);
  if (raw && !Number.isFinite(header)) {
    const date = Date.parse(raw);
    if (Number.isFinite(date) && date > Date.now()) return Math.ceil((date - Date.now()) / 1000);
  }
  return null;
}

// The refusal as a plain value, for callers that handle it without a throw.
export function readRefusal(response, body) {
  if (!response || response.status !== REFUSAL_STATUS) return null;
  return { refused: true, retryAfterSeconds: refusalSeconds(response, body) };
}

export class RefusalError extends Error {
  constructor(retryAfterSeconds) {
    super('request refused');
    this.name = 'RefusalError';
    this.refused = true;
    this.retryAfterSeconds = retryAfterSeconds ?? null;
  }
}

// A refusal must be distinguishable from every other failure. A caller that
// catches an error and cannot tell a refusal from a broken source will report
// a refusal as an outage, which is the defect this module exists to stop.
export function isRefusalError(error) {
  if (!error) return false;
  if (error instanceof RefusalError) return true;
  return error.refused === true || error.name === 'RefusalError';
}

// The one way a client reads an API payload. A refused request throws a
// RefusalError carrying its retry window; any other failure throws the plain
// error the clients have always handled.
export async function readJson(response) {
  if (!response) throw new Error('no response');
  if (response.ok) return await response.json();
  if (response.status === REFUSAL_STATUS) {
    let body = null;
    try { body = await response.json(); } catch { /* the header still carries the window */ }
    throw new RefusalError(refusalSeconds(response, body));
  }
  throw new Error('source ' + response.status);
}

// The compact form, for a control label that has no room for a sentence. It
// still names the cause and the window — a label that says only "refused"
// leaves the reader with no next step.
export function refusalLabel(seconds, t) {
  const wait = Number(seconds);
  if (Number.isFinite(wait) && wait > 0) {
    const n = Math.max(1, Math.round(wait));
    return t(`rate limited · retry interval ${n} s`, `dibatasi · jeda coba ulang ${n} dtk`);
  }
  return t('refused · retry shortly', 'ditolak · coba lagi sebentar lagi');
}

// Bilingual copy for a refusal. The data was refused, not lost: nothing was
// measured, so the reader is told the cause and the window, and never handed
// a number that would read as a measurement.
//
// `t` takes English first and Indonesian second, the convention every live
// lens already uses.
export function refusalMessage(seconds, t) {
  const wait = Number(seconds);
  if (Number.isFinite(wait) && wait > 0) {
    const n = Math.max(1, Math.round(wait));
    return t(
      `Request rate limited. Server retry interval: ${n} seconds. No new reading was received.`,
      `Permintaan dibatasi. Jeda coba ulang dari server: ${n} detik. Belum ada pembacaan baru yang diterima.`);
  }
  return t(
    'Request rate limited. Try again shortly. No new reading was received.',
    'Permintaan dibatasi. Coba lagi sebentar lagi. Belum ada pembacaan baru yang diterima.');
}
