/**
 * CryptoPriceGateway: the single entry point money.ts uses for any crypto
 * price/rate, replacing the old single-provider (CoinGecko-only) cache from
 * the previous hardening pass. This is a redesign, not a patch - see the
 * task's own mandate: "provider ใด provider หนึ่งล่ม SmartConverter ยัง
 * สามารถทำงานต่อได้" (no single provider's outage should break conversion).
 *
 * Flow for getRate(base, quote):
 *   1. normalize symbols, identity short-circuit (base === quote -> 1)
 *   2. fresh cache hit -> return instantly, no network call
 *   3. in-flight request for the same pair -> await the same promise
 *      (request coalescing - a burst of identical requests makes exactly
 *      one set of provider calls, not one per request)
 *   4. direct-pair provider priority loop (skips providers in cooldown and
 *      providers that declare they don't support the pair), bounded by a
 *      per-provider timeout AND an overall deadline so a chain of failing
 *      providers can never add up to a long wait
 *   5. if no direct pair worked and this isn't already a USD leg, fall back
 *      to a cross-rate via USD (recursive getRate calls, each with their
 *      own cache/coalescing/failover - never a second, parallel set of
 *      "try all providers again" calls)
 *   6. if everything failed, serve a stale cached value if one exists
 *      (flagged `stale: true` - never presented as live)
 *   7. otherwise throw a clean, typed CryptoPriceUnavailableError - never a
 *      fabricated price
 *
 * Provider health/cooldown and the cache are both module-instance state
 * (one gateway = one Worker isolate's lifetime), matching the existing
 * project pattern (see currency.ts's CachingRateProvider) - an
 * optimization, never a source of truth, per the task's own note that a
 * Worker's in-memory state may not be shared across isolates/locations.
 */
import {
  classifyProviderError,
  ProviderRateLimitedError,
  ProviderTimeoutError,
  ProviderServerError,
  ProviderUnsupportedPairError,
  type CryptoMarketProvider,
} from './crypto-providers/types';
import { CryptoPriceUnavailableError, type CryptoUnavailableReason } from './crypto';

export interface GatewayRate {
  rate: number;
  stale: boolean;
  provider: string;
}

interface CacheEntry {
  rate: number;
  fetchedAt: number;
  provider: string;
}

interface ProviderHealth {
  cooldownUntil: number;
  successCount: number;
  failureCount: number;
  lastFailureReason?: CryptoUnavailableReason;
}

type GatewayLogCategory =
  | 'CRYPTO_CACHE_HIT'
  | 'CRYPTO_CACHE_STALE_HIT'
  | 'CRYPTO_CACHE_MISS'
  | 'CRYPTO_PROVIDER_ATTEMPT'
  | 'CRYPTO_PROVIDER_SUCCESS'
  | 'CRYPTO_PROVIDER_RATE_LIMITED'
  | 'CRYPTO_PROVIDER_TIMEOUT'
  | 'CRYPTO_PROVIDER_SERVER_ERROR'
  | 'CRYPTO_PROVIDER_INVALID_RESPONSE'
  | 'CRYPTO_PROVIDER_NETWORK_ERROR'
  | 'CRYPTO_PROVIDER_UNSUPPORTED'
  | 'CRYPTO_PROVIDER_COOLDOWN_SKIP'
  | 'CRYPTO_CROSS_RATE'
  | 'CRYPTO_ALL_PROVIDERS_FAILED';

function log(category: GatewayLogCategory, detail: string): void {
  console.log(`[${category}] ${detail}`);
}

// Per-provider request timeout and the overall deadline for one getRate()
// call (a chain of failing providers must never add up to more than this -
// the whole reason the old design could make a user wait a long time).
const PROVIDER_TIMEOUT_MS = 5000;
const OVERALL_DEADLINE_MS = 9000;

const FRESH_TTL_MS = 60 * 1000;
const STALE_TTL_MS = 5 * 60 * 1000;

const COOLDOWN_RATE_LIMITED_MS = 60 * 1000;
const COOLDOWN_TIMEOUT_MS = 30 * 1000;
const COOLDOWN_SERVER_ERROR_MS = 30 * 1000;
const COOLDOWN_NETWORK_ERROR_MS = 30 * 1000;

function cooldownFor(err: unknown): number {
  if (err instanceof ProviderRateLimitedError) return COOLDOWN_RATE_LIMITED_MS;
  if (err instanceof ProviderTimeoutError) return COOLDOWN_TIMEOUT_MS;
  if (err instanceof ProviderServerError) return COOLDOWN_SERVER_ERROR_MS;
  if (err instanceof ProviderUnsupportedPairError) return 0; // not a health problem
  return COOLDOWN_NETWORK_ERROR_MS;
}

function logCategoryFor(err: unknown): GatewayLogCategory {
  if (err instanceof ProviderRateLimitedError) return 'CRYPTO_PROVIDER_RATE_LIMITED';
  if (err instanceof ProviderTimeoutError) return 'CRYPTO_PROVIDER_TIMEOUT';
  if (err instanceof ProviderServerError) return 'CRYPTO_PROVIDER_SERVER_ERROR';
  if (err instanceof ProviderUnsupportedPairError) return 'CRYPTO_PROVIDER_UNSUPPORTED';
  return 'CRYPTO_PROVIDER_NETWORK_ERROR';
}

export class CryptoPriceGateway {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<GatewayRate>>();
  private readonly health = new Map<string, ProviderHealth>();

  constructor(
    private readonly providers: CryptoMarketProvider[],
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly now: () => number = Date.now,
  ) {}

  async getRate(base: string, quote: string): Promise<GatewayRate> {
    const b = base.trim().toUpperCase();
    const q = quote.trim().toUpperCase();
    if (b === q) return { rate: 1, stale: false, provider: 'identity' };

    const key = `crypto:${b}:${q}`;
    const nowMs = this.now();

    const fresh = this.cache.get(key);
    if (fresh && nowMs - fresh.fetchedAt < FRESH_TTL_MS) {
      log('CRYPTO_CACHE_HIT', key);
      return { rate: fresh.rate, stale: false, provider: fresh.provider };
    }
    log('CRYPTO_CACHE_MISS', key);

    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = this.resolvePair(b, q, key).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }

  /** For observability (task section 46): per-provider success/failure counts
   *  and current cooldown state, so a real deployment can tell which
   *  provider is having trouble. Never includes secrets. */
  getProviderStats(): Record<string, { success: number; failure: number; cooldownRemainingMs: number }> {
    const nowMs = this.now();
    const stats: Record<string, { success: number; failure: number; cooldownRemainingMs: number }> = {};
    for (const provider of this.providers) {
      const h = this.health.get(provider.name);
      stats[provider.name] = {
        success: h?.successCount ?? 0,
        failure: h?.failureCount ?? 0,
        cooldownRemainingMs: h ? Math.max(0, h.cooldownUntil - nowMs) : 0,
      };
    }
    return stats;
  }

  private async resolvePair(base: string, quote: string, key: string): Promise<GatewayRate> {
    const nowMs = this.now();
    const deadline = nowMs + OVERALL_DEADLINE_MS;

    const direct = await this.tryProviders(base, quote, deadline);
    if (direct) {
      this.cache.set(key, { rate: direct.rate, fetchedAt: this.now(), provider: direct.provider });
      return { rate: direct.rate, stale: false, provider: direct.provider };
    }

    // Cross-rate fallback via USD - only meaningful when neither side is
    // already the USD leg (avoids infinite recursion: getRate(x, 'USD')
    // never itself falls into this branch).
    if (base !== 'USD' && quote !== 'USD' && this.now() < deadline) {
      try {
        const [baseUsd, quoteUsd] = await Promise.all([this.getRate(base, 'USD'), this.getRate(quote, 'USD')]);
        const rate = baseUsd.rate / quoteUsd.rate;
        const stale = baseUsd.stale || quoteUsd.stale;
        log('CRYPTO_CROSS_RATE', `${base}/${quote} via USD (${baseUsd.provider}, ${quoteUsd.provider})`);
        this.cache.set(key, { rate, fetchedAt: this.now(), provider: 'cross-rate-usd' });
        return { rate, stale, provider: 'cross-rate-usd' };
      } catch {
        // fall through to stale-cache / clean-error below
      }
    }

    const stale = this.staleFallback(key);
    if (stale) {
      log('CRYPTO_CACHE_STALE_HIT', key);
      return stale;
    }

    log('CRYPTO_ALL_PROVIDERS_FAILED', key);
    throw new CryptoPriceUnavailableError(`No provider could resolve ${base}/${quote}.`, 'NO_PROVIDER_AVAILABLE');
  }

  private async tryProviders(
    base: string,
    quote: string,
    deadline: number,
  ): Promise<{ rate: number; provider: string } | null> {
    for (const provider of this.providers) {
      if (this.now() >= deadline) break;

      const health = this.health.get(provider.name);
      if (health && this.now() < health.cooldownUntil) {
        log('CRYPTO_PROVIDER_COOLDOWN_SKIP', provider.name);
        continue;
      }
      if (!provider.supportsPair(base, quote)) continue;

      const remaining = deadline - this.now();
      const timeoutMs = Math.min(PROVIDER_TIMEOUT_MS, remaining);
      if (timeoutMs <= 0) break;

      log('CRYPTO_PROVIDER_ATTEMPT', `${provider.name} ${base}/${quote}`);
      try {
        const quoteResult = await provider.getPrice(base, quote, timeoutMs, this.fetchImpl);
        if (!Number.isFinite(quoteResult.price) || quoteResult.price <= 0) {
          throw new CryptoPriceUnavailableError('Provider returned an invalid price.', 'INVALID_PROVIDER_RESPONSE');
        }
        this.recordSuccess(provider.name);
        log('CRYPTO_PROVIDER_SUCCESS', `${provider.name} ${base}/${quote}`);
        return { rate: quoteResult.price, provider: provider.name };
      } catch (err) {
        this.recordFailure(provider.name, err);
        log(logCategoryFor(err), `${provider.name} ${base}/${quote}: ${err instanceof Error ? err.message : 'unknown error'}`);
        continue;
      }
    }
    return null;
  }

  private recordSuccess(providerName: string): void {
    const health = this.health.get(providerName) ?? { cooldownUntil: 0, successCount: 0, failureCount: 0 };
    health.successCount += 1;
    this.health.set(providerName, health);
  }

  private recordFailure(providerName: string, err: unknown): void {
    const health = this.health.get(providerName) ?? { cooldownUntil: 0, successCount: 0, failureCount: 0 };
    health.failureCount += 1;
    health.lastFailureReason = classifyProviderError(err);
    const cooldownMs = cooldownFor(err);
    if (cooldownMs > 0) health.cooldownUntil = this.now() + cooldownMs;
    this.health.set(providerName, health);
  }

  private staleFallback(key: string): GatewayRate | null {
    const cached = this.cache.get(key);
    if (cached && this.now() - cached.fetchedAt < STALE_TTL_MS) {
      return { rate: cached.rate, stale: true, provider: cached.provider };
    }
    return null;
  }
}
