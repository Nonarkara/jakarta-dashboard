/**
 * A rate limit for the public API.
 *
 * Two mechanisms, one interface:
 *
 * 1. **Cloudflare's native Workers Rate Limiting**, through the
 *    `RATE_LIMITER` binding in wrangler.toml (bound since 26 Oct 2026). It is
 *    the real one: it counts across isolates, per Cloudflare location.
 * 2. **An in-isolate sliding window with burst allowance**, used when that
 *    binding is absent. It is honest about what it is: it counts the requests
 *    that reach THIS isolate, so a client spread across many connections is
 *    under-counted. It stops a single hot path, not a distributed one.
 *
 * The limit applies to the API routes only. The pages and the map assets are
 * cheap and cacheable, and rate-limiting a page a reader is trying to open
 * would punish them for the sake of protecting nothing.
 *
 * The rule is deliberately generous: a reader opening the atlas and the
 * research page makes a handful of API calls, and many readers share one
 * address behind a carrier NAT. The limit exists to stop a script, not to
 * ration a person.
 *
 * Hardening (2026-11-24):
 * - Sliding window (not fixed) with configurable burst allowance
 * - Per-scope keys with explicit namespace
 * - Automatic cleanup of expired entries
 * - Key cap with LRU-style eviction
 * - Structured verdict includes mechanism for observability
 */

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface RateLimitEnv {
  RATE_LIMITER?: RateLimitBinding;
}

export interface RateLimitOptions {
  /** How many requests are allowed inside the window. */
  limit: number;
  /** The window's length in seconds. */
  windowSeconds: number;
  /** What the limit counts, for the key. */
  scope: string;
  /** Burst allowance: extra requests allowed in a short burst (default 10% of limit). */
  burstAllowance?: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Seconds until the window frees up. Only meaningful when blocked. */
  retryAfter: number;
  /** Which mechanism answered — so the caller can say so if it must. */
  mode: "native" | "isolate";
  /** Remaining requests in current window (native may not provide). */
  remaining?: number;
}

// Per-isolate sliding-window counters. An isolate is a short-lived sandbox,
// so this map is bounded and self-expiring: a key that has passed its window
// is removed the next time it is seen, and the whole map is trimmed when it
// grows past the cap rather than being allowed to follow the number of clients.
interface CounterEntry {
  timestamps: number[];
  resetAt: number;
}

const counters = new Map<string, CounterEntry>();
const MAX_KEYS = 8192;
const CLEANUP_INTERVAL_MS = 60000;

function clientKey(request: Request, scope: string): string {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  // Namespace by scope to prevent cross-endpoint contamination
  return `rl:${scope}:${ip}`;
}

function cleanupCounters(now: number): void {
  if (counters.size < MAX_KEYS) return;
  // First pass: remove expired entries
  for (const [k, v] of counters) {
    if (v.resetAt <= now) counters.delete(k);
  }
  // Second pass: if still over cap, evict oldest (LRU by resetAt)
  if (counters.size >= MAX_KEYS) {
    const entries = [...counters.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toEvict = entries.slice(0, entries.length - MAX_KEYS + 1024);
    for (const [k] of toEvict) counters.delete(k);
  }
}

export async function checkRateLimit(
  request: Request,
  env: RateLimitEnv | undefined,
  options: RateLimitOptions,
): Promise<RateLimitVerdict> {
  const key = clientKey(request, options.scope);
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const burstAllowance = options.burstAllowance ?? Math.max(1, Math.floor(options.limit * 0.1));
  const effectiveLimit = options.limit + burstAllowance;

  // The native binding, when it exists, is authoritative.
  if (env && env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === "function") {
    try {
      const result = await env.RATE_LIMITER.limit({ key });
      if (result && result.success === false) {
        return { allowed: false, retryAfter: options.windowSeconds, mode: "native" };
      }
      return { allowed: true, retryAfter: 0, mode: "native", remaining: effectiveLimit };
    } catch {
      // A fault in the limiter is not a fault in the publisher. If the
      // limiter cannot answer, the request is served: an outage in the
      // protection must not become an outage in the data.
      return { allowed: true, retryAfter: 0, mode: "native", remaining: effectiveLimit };
    }
  }

  cleanupCounters(now);

  const entry = counters.get(key);
  if (!entry || entry.resetAt <= now) {
    if (counters.size >= MAX_KEYS) cleanupCounters(now);
    counters.set(key, { timestamps: [now], resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0, mode: "isolate", remaining: effectiveLimit - 1 };
  }

  // Sliding window: count requests within the window
  const windowStart = now - windowMs;
  const recent = entry.timestamps.filter(t => t > windowStart);
  if (recent.length >= effectiveLimit) {
    const oldest = recent[0];
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
      mode: "isolate",
      remaining: 0,
    };
  }

  recent.push(now);
  entry.timestamps = recent;
  entry.resetAt = now + windowMs;
  return { allowed: true, retryAfter: 0, mode: "isolate", remaining: effectiveLimit - recent.length };
}

/** Exposed for the test: the in-isolate window's state. */
export function rateLimitStateForTest(): { size: number } {
  return { size: counters.size };
}

export function resetRateLimitStateForTest(): void {
  counters.clear();
}
