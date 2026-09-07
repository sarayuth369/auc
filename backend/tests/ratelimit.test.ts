import { describe, expect, it } from 'vitest';
import { checkRateLimit, type RateLimitEntry } from '../src/ratelimit';

describe('checkRateLimit', () => {
  it('allows requests under the limit', () => {
    const store = new Map<string, RateLimitEntry>();
    expect(checkRateLimit(store, 'ip1', 0, 3, 1000)).toBe(true);
    expect(checkRateLimit(store, 'ip1', 100, 3, 1000)).toBe(true);
    expect(checkRateLimit(store, 'ip1', 200, 3, 1000)).toBe(true);
  });

  it('blocks once the limit is exceeded within the window', () => {
    const store = new Map<string, RateLimitEntry>();
    checkRateLimit(store, 'ip1', 0, 2, 1000);
    checkRateLimit(store, 'ip1', 100, 2, 1000);
    expect(checkRateLimit(store, 'ip1', 200, 2, 1000)).toBe(false);
  });

  it('resets after the window passes', () => {
    const store = new Map<string, RateLimitEntry>();
    checkRateLimit(store, 'ip1', 0, 1, 1000);
    expect(checkRateLimit(store, 'ip1', 500, 1, 1000)).toBe(false);
    expect(checkRateLimit(store, 'ip1', 1500, 1, 1000)).toBe(true);
  });

  it('tracks separate keys independently', () => {
    const store = new Map<string, RateLimitEntry>();
    checkRateLimit(store, 'ip1', 0, 1, 1000);
    expect(checkRateLimit(store, 'ip2', 0, 1, 1000)).toBe(true);
  });
});
