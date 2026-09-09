/**
 * Cryptocurrency support, deliberately separate from currency.ts's fiat FX
 * (a different kind of price, from a different provider) and from
 * dimensions.ts's physical unit factors (crypto is not an SI unit and has
 * no fixed factor at all - its "factor" is a live market price that must
 * never be treated as constant, or invented by AI).
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

export interface CryptoPriceProvider {
  /** Current USD price of one unit of `symbol`. Never invented. */
  getUsdPrice(symbol: string): Promise<number>;
}

/**
 * CoinGecko's public, keyless /simple/price endpoint - no API key, so
 * nothing to manage as a secret for this feature. Fetches ALL currently
 * known symbols in one request so a mixed request (e.g. ETH -> BTC) never
 * makes two separate round-trips.
 */
export class CoinGeckoPriceProvider implements CryptoPriceProvider {
  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  async getUsdPrice(symbol: string): Promise<number> {
    const prices = await this.getUsdPrices([symbol]);
    const price = prices[symbol];
    if (price === undefined) {
      throw new CryptoPriceUnavailableError(`No price available for ${symbol}.`);
    }
    return price;
  }

  async getUsdPrices(symbols: string[]): Promise<Record<string, number>> {
    const ids = symbols.map(coinGeckoId);
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=usd`;

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
      });
    } catch (err) {
      throw new CryptoPriceUnavailableError(
        err instanceof Error ? err.message : 'Could not reach the crypto price provider.',
      );
    }
    if (!response.ok) {
      throw new CryptoPriceUnavailableError(`Crypto price provider responded with HTTP ${response.status}.`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
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

interface CacheEntry {
  price: number;
  expiresAt: number;
}

/**
 * Short-TTL cache (crypto prices move faster than fiat FX, so this uses a
 * much shorter default than CachingRateProvider's fiat cache) - module-scope,
 * lives for the Worker isolate's lifetime.
 */
export class CachingCryptoPriceProvider implements CryptoPriceProvider {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly inner: CryptoPriceProvider,
    private readonly ttlMs: number = 2 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  async getUsdPrice(symbol: string): Promise<number> {
    const cached = this.cache.get(symbol);
    const nowMs = this.now();
    if (cached && cached.expiresAt > nowMs) {
      return cached.price;
    }
    const price = await this.inner.getUsdPrice(symbol);
    this.cache.set(symbol, { price, expiresAt: nowMs + this.ttlMs });
    return price;
  }
}
