/**
 * A rate limit for the public API.
 *
 * Two mechanisms, one interface:
 *
 * 1. **Cloudflare's native Workers Rate Limiting**, through the
 *    `RATE_LIMITER` binding in wrangler.toml (bound since 26 Oct 2026). It is
 *    the real one: it counts across isolates, per Cloudflare location.
 * 2. **An in-isolate fixed window**, used when that binding is absent. It is
 *    honest about what it is: it counts the requests that reach THIS
 *    isolate, so a client spread across many connections is under-counted.
 *    It stops a single hot path, not a distributed one.
 *
 * The limit applies to the API routes only. The pages and the map assets are
 * cheap and cacheable, and rate-limiting a page a reader is trying to open
 * would punish them for the sake of protecting nothing.
 *
 * The rule is deliberately generous: a reader opening the atlas and the
 * research page makes a handful of API calls, and many readers share one
 * address behind a carrier NAT. The limit exists to stop a script, not to
 * ration a person.
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
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Seconds until the window frees up. Only meaningful when blocked. */
  retryAfter: number;
  /** Which mechanism answered — so the caller can say so if it must. */
  mode: "native" | "isolate";
}

// Per-isolate counters. An isolate is a short-lived sandbox, so this map is
// bounded and self-expiring: a key that has passed its window is removed the
// next time it is seen, and the whole map is trimmed when it grows past the
// cap rather than being allowed to follow the number of clients.
const counters = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 4096;

function clientKey(request: Request, scope: string): string {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return `${scope}:${ip}`;
}

export async function checkRateLimit(
  request: Request,
  env: RateLimitEnv | undefined,
  options: RateLimitOptions,
): Promise<RateLimitVerdict> {
  const key = clientKey(request, options.scope);

  // The native binding, when it exists, is authoritative.
  if (env && env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === "function") {
    try {
      const result = await env.RATE_LIMITER.limit({ key });
      if (result && result.success === false) {
        return { allowed: false, retryAfter: options.windowSeconds, mode: "native" };
      }
      return { allowed: true, retryAfter: 0, mode: "native" };
    } catch {
      // A fault in the limiter is not a fault in the publisher. If the
      // limiter cannot answer, the request is served: an outage in the
      // protection must not become an outage in the data.
      return { allowed: true, retryAfter: 0, mode: "native" };
    }
  }

  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const existing = counters.get(key);
  if (!existing || existing.resetAt <= now) {
    if (counters.size >= MAX_KEYS) {
      for (const [k, v] of counters) if (v.resetAt <= now) counters.delete(k);
      if (counters.size >= MAX_KEYS) counters.clear();
    }
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0, mode: "isolate" };
  }
  existing.count += 1;
  if (existing.count > options.limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      mode: "isolate",
    };
  }
  return { allowed: true, retryAfter: 0, mode: "isolate" };
}

/** Exposed for the test: the in-isolate window's state. */
export function rateLimitStateForTest(): { size: number } {
  return { size: counters.size };
}

export function resetRateLimitStateForTest(): void {
  counters.clear();
}
