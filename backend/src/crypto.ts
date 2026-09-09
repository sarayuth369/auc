/**
 * Cryptocurrency support, deliberately separate from currency.ts's fiat FX
 * (a different kind of price, from a different provider) and from
 * dimensions.ts's physical unit factors (crypto is not an SI unit and has
 * no fixed factor at all - its "factor" is a live market price that must
 * never be treated as constant, or invented by AI).
 *
 * Stability hardening (see task): the crypto price provider (CoinGecko's
 * public /simple/price, keyless) has a real, observed rate limit under
 * repeated real-device use. CachingCryptoPriceProvider below is the fix -
 * a fresh/stale two-tier cache with request coalescing and batched
 * multi-symbol fetches - NOT a new provider. The provider itself only
 * gained a request timeout and a single bounded retry on 429.
 */

/** symbol -> CoinGecko coin id. Small, curated, easy to extend. */
const CRYPTO_REGISTRY: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  TRX: 'tron',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  LINK: 'chainlink',
};

// A few common full-name/informal aliases (English + Thai) - deliberately
// small, not an exhaustive token dictionary (that's AI's job for anything
// this doesn't cover; AI may only ever return an asset IDENTITY, never a
// price - see resolve.ts).
const CRYPTO_NAME_ALIASES: Record<string, string> = {
  bitcoin: 'BTC',
  'บิทคอยน์': 'BTC',
  'บิตคอยน์': 'BTC',
  ethereum: 'ETH',
  'อีเธอเรียม': 'ETH',
  ether: 'ETH',
  tether: 'USDT',
  'usd coin': 'USDC',
  usdcoin: 'USDC',
  binancecoin: 'BNB',
  'binance coin': 'BNB',
  solana: 'SOL',
  ripple: 'XRP',
  cardano: 'ADA',
  dogecoin: 'DOGE',
  tron: 'TRX',
  avalanche: 'AVAX',
  polkadot: 'DOT',
  chainlink: 'LINK',
};

/** Resolves a raw token to a known crypto symbol (e.g. "BTC"), or null. */
export function resolveCryptoSymbol(token: string): string | null {
  const normalized = token.trim().toLowerCase();
  if (!normalized) return null;
  const upper = normalized.toUpperCase();
  if (CRYPTO_REGISTRY[upper]) return upper;
  return CRYPTO_NAME_ALIASES[normalized] ?? null;
}

/** The CoinGecko coin id for a known symbol - only ever called with a symbol already validated by resolveCryptoSymbol. */
function coinGeckoId(symbol: string): string {
  const id = CRYPTO_REGISTRY[symbol];
  if (!id) throw new Error(`No CoinGecko mapping for crypto symbol "${symbol}" - this indicates a registry bug.`);
  return id;
}

export class CryptoPriceUnavailableError extends Error {}

/** A resolved price plus whether it came from the live provider just now
 *  ("fresh") or from cache past its normal freshness window ("stale", but
 *  still recent enough to be a reasonable, disclosed fallback - never
 *  invented). See CachingCryptoPriceProvider. */
export interface CryptoPrice {
  price: number;
  stale: boolean;
}

export interface CryptoPriceProvider {
  getUsdPrice(symbol: string): Promise<CryptoPrice>;
  /** Batched form - always prefer this for 2+ symbols (e.g. a crypto->crypto
   *  request) so it's one provider call, not one per symbol. */
  getUsdPrices(symbols: string[]): Promise<Record<string, CryptoPrice>>;
}

// Diagnostic-only categories (see task section 2) - no secrets, no user
// input beyond a known crypto symbol, safe to log. Not exposed to Flutter.
type CryptoLogCategory =
  | 'CRYPTO_CACHE_HIT'
  | 'CRYPTO_CACHE_STALE_HIT'
  | 'CRYPTO_CACHE_MISS'
  | 'CRYPTO_PROVIDER_200'
  | 'CRYPTO_PROVIDER_429'
  | 'CRYPTO_PROVIDER_4XX'
  | 'CRYPTO_PROVIDER_5XX'
  | 'CRYPTO_PROVIDER_TIMEOUT'
  | 'CRYPTO_PROVIDER_PARSE_ERROR'
  | 'CRYPTO_PROVIDER_RETRY';

function logCrypto(category: CryptoLogCategory, detail: string): void {
  console.log(`[${category}] ${detail}`);
}

/**
 * CoinGecko's public, keyless /simple/price endpoint - no API key, so
 * nothing to manage as a secret for this feature. Fetches ALL requested
 * symbols in one request. Has its own request timeout (separate from and
 * much shorter than the overall Worker/AI timeout budget, so a slow/hung
 * provider fails fast instead of making the user wait) and a single bounded
 * retry on 429 (respecting a short Retry-After if given).
 */
export class CoinGeckoPriceProvider implements CryptoPriceProvider {
  constructor(
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly timeoutMs: number = 6000,
  ) {}

  async getUsdPrice(symbol: string): Promise<CryptoPrice> {
    const prices = await this.getUsdPrices([symbol]);
    const price = prices[symbol];
    if (price === undefined) {
      throw new CryptoPriceUnavailableError(`No price available for ${symbol}.`);
    }
    return price;
  }

  async getUsdPrices(symbols: string[]): Promise<Record<string, CryptoPrice>> {
    const raw = await this.fetchWithRetry(symbols);
    const result: Record<string, CryptoPrice> = {};
    for (const [symbol, price] of Object.entries(raw)) {
      result[symbol] = { price, stale: false };
    }
    return result;
  }

  private async fetchWithRetry(symbols: string[]): Promise<Record<string, number>> {
    try {
      return await this.fetchOnce(symbols);
    } catch (err) {
      if (err instanceof RetryableRateLimitError) {
        // Bounded: at most one retry, and only wait if the provider gave a
        // short, honest Retry-After - never sleep long enough to make the
        // user feel like the app hung.
        logCrypto('CRYPTO_PROVIDER_RETRY', `symbols=${symbols.join(',')} retryAfterMs=${err.retryAfterMs}`);
        if (err.retryAfterMs > 0 && err.retryAfterMs <= 2000) {
          await new Promise((resolve) => setTimeout(resolve, err.retryAfterMs));
        }
        try {
          return await this.fetchOnce(symbols);
        } catch (retryErr) {
          if (retryErr instanceof RetryableRateLimitError) {
            throw new CryptoPriceUnavailableError('Crypto price provider is rate limited.');
          }
          throw retryErr;
        }
      }
      throw err;
    }
  }

  private async fetchOnce(symbols: string[]): Promise<Record<string, number>> {
    const ids = symbols.map(coinGeckoId);
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=usd`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const started = Date.now();

    let response: Response;
    try {
      // CoinGecko's public API 403s a bare Workers fetch (no default
      // User-Agent/Accept) as likely bot traffic - an explicit User-Agent
      // (identifying this app, not spoofing a browser) and Accept header
      // are enough to get a normal response.
      response = await this.fetchImpl(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'SmartConverter/1.0 (+https://auc-backend.biz2success.workers.dev)',
        },
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        logCrypto('CRYPTO_PROVIDER_TIMEOUT', `symbols=${symbols.join(',')} afterMs=${Date.now() - started}`);
        throw new CryptoPriceUnavailableError('Crypto price provider timed out.');
      }
      throw new CryptoPriceUnavailableError(
        err instanceof Error ? err.message : 'Could not reach the crypto price provider.',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      logCrypto('CRYPTO_PROVIDER_429', `symbols=${symbols.join(',')}`);
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 0;
      throw new RetryableRateLimitError(Number.isFinite(retryAfterMs) ? retryAfterMs : 0);
    }
    if (!response.ok) {
      logCrypto(response.status >= 500 ? 'CRYPTO_PROVIDER_5XX' : 'CRYPTO_PROVIDER_4XX', `status=${response.status}`);
      throw new CryptoPriceUnavailableError(`Crypto price provider responded with HTTP ${response.status}.`);
    }
    logCrypto('CRYPTO_PROVIDER_200', `symbols=${symbols.join(',')} durationMs=${Date.now() - started}`);

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      logCrypto('CRYPTO_PROVIDER_PARSE_ERROR', `symbols=${symbols.join(',')}`);
      throw new CryptoPriceUnavailableError('Crypto price provider returned invalid JSON.');
    }

    const result: Record<string, number> = {};
    for (const symbol of symbols) {
      const id = coinGeckoId(symbol);
      const entry = (body as Record<string, unknown> | null)?.[id];
      const usd = (entry as Record<string, unknown> | undefined)?.usd;
      if (typeof usd === 'number' && Number.isFinite(usd)) {
        result[symbol] = usd;
      }
    }
    return result;
  }
}

class RetryableRateLimitError extends Error {
  constructor(readonly retryAfterMs: number) {
    super('Crypto price provider rate limit (429).');
  }
}

interface CacheEntry {
  price: number;
  fetchedAt: number;
}

/**
 * Two-tier cache (fresh / stale-fallback) with in-flight request
 * coalescing and automatic multi-symbol batching for cache misses -
 * module-scope, lives for the Worker isolate's lifetime.
 *
 * - Fresh (< freshTtlMs): served instantly, no provider call.
 * - Stale (freshTtlMs .. staleTtlMs): a background-worthy refresh is
 *   attempted; if the provider fails (429/5xx/timeout), the stale value is
 *   returned instead of failing the request outright - flagged `stale:
 *   true` so the caller can disclose it, never presented as a live price.
 * - Beyond staleTtlMs with no successful refresh: no safe fallback: the
 *   caller gets a clean "unavailable" error rather than a fabricated price.
 *
 * Request coalescing: concurrent calls needing the exact same set of
 * missing symbols share one in-flight provider call instead of each
 * firing their own - this is what actually stops a "provider storm" when
 * several conversions land on the same isolate close together.
 */
export class CachingCryptoPriceProvider implements CryptoPriceProvider {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<Record<string, CryptoPrice>>>();

  constructor(
    private readonly inner: CryptoPriceProvider,
    private readonly freshTtlMs: number = 60 * 1000,
    private readonly staleTtlMs: number = 5 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  async getUsdPrice(symbol: string): Promise<CryptoPrice> {
    const prices = await this.getUsdPrices([symbol]);
    const price = prices[symbol];
    if (price === undefined) {
      throw new CryptoPriceUnavailableError(`No price available for ${symbol}.`);
    }
    return price;
  }

  async getUsdPrices(symbols: string[]): Promise<Record<string, CryptoPrice>> {
    const nowMs = this.now();
    const result: Record<string, CryptoPrice> = {};
    const missing: string[] = [];

    for (const symbol of symbols) {
      const cached = this.cache.get(symbol);
      if (cached && nowMs - cached.fetchedAt < this.freshTtlMs) {
        logCrypto('CRYPTO_CACHE_HIT', symbol);
        result[symbol] = { price: cached.price, stale: false };
      } else {
        if (cached) logCrypto('CRYPTO_CACHE_MISS', `${symbol} (expired, will refresh)`);
        else logCrypto('CRYPTO_CACHE_MISS', symbol);
        missing.push(symbol);
      }
    }
    if (missing.length === 0) return result;

    const fetched = await this.fetchMissingCoalesced(missing, nowMs);
    return { ...result, ...fetched };
  }

  /** Coalesces concurrent requests for the same missing-symbol set into one provider call. */
  private fetchMissingCoalesced(missing: string[], nowMs: number): Promise<Record<string, CryptoPrice>> {
    const key = [...missing].sort().join(',');
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = this.refreshMissing(missing, nowMs).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }

  private async refreshMissing(missing: string[], nowMs: number): Promise<Record<string, CryptoPrice>> {
    try {
      const fresh = await this.inner.getUsdPrices(missing);
      for (const [symbol, entry] of Object.entries(fresh)) {
        this.cache.set(symbol, { price: entry.price, fetchedAt: nowMs });
      }
      const result: Record<string, CryptoPrice> = { ...fresh };
      for (const symbol of missing) {
        if (result[symbol] === undefined) {
          const stale = this.staleFallback(symbol, nowMs);
          if (stale) result[symbol] = stale;
        }
      }
      return result;
    } catch (err) {
      // Provider failed entirely for this batch (network/429/5xx/timeout) -
      // fall back to stale cache per-symbol where available. A symbol with
      // no usable cache at all is simply left out of the result; the
      // caller (getUsdPrice/getUsdPrices) surfaces that as unavailable -
      // never a fabricated price.
      const result: Record<string, CryptoPrice> = {};
      for (const symbol of missing) {
        const stale = this.staleFallback(symbol, nowMs);
        if (stale) {
          logCrypto('CRYPTO_CACHE_STALE_HIT', symbol);
          result[symbol] = stale;
        }
      }
      if (Object.keys(result).length === 0) throw err;
      return result;
    }
  }

  private staleFallback(symbol: string, nowMs: number): CryptoPrice | null {
    const cached = this.cache.get(symbol);
    if (cached && nowMs - cached.fetchedAt < this.staleTtlMs) {
      return { price: cached.price, stale: true };
    }
    return null;
  }
}
