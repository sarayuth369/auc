export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window limiter backed by an in-memory Map. Best-effort only: a
 * Worker isolate is not guaranteed to persist between requests, and state
 * is never shared across isolates/regions. That is an accepted tradeoff for
 * an MVP that must not add infrastructure (no KV/Durable Objects/Redis).
 */
export function checkRateLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  now: number,
  limit: number,
  windowMs: number,
): boolean {
  const entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count += 1;
  return true;
}
