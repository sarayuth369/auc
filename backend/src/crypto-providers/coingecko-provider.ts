import {
  ProviderInvalidResponseError,
  ProviderRateLimitedError,
  ProviderServerError,
  ProviderUnsupportedPairError,
  timedFetch,
  type CryptoMarketProvider,
  type CryptoPriceQuote,
} from './types';

// CoinGecko-specific coin ids - isolated to this file, same pattern as
// Kraken's asset-code table. Only USD quotes are supported (this provider's
// only job now is a fourth, low-priority fallback; direct crypto-crypto and
// non-USD-fiat quoting is left to the primary three providers).
const COINGECKO_ID: Record<string, string> = {
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

/**
 * CoinGecko's public /simple/price - the ORIGINAL sole provider this
 * gateway replaces. Kept as a fourth, lowest-priority fallback instead of
 * being deleted: it's already hardened (explicit headers so Cloudflare
 * Workers traffic isn't 403'd as a bot) and gives a fourth independent data
 * source at effectively no extra implementation cost.
 */
export class CoinGeckoProvider implements CryptoMarketProvider {
  readonly name = 'coingecko';

  supportsPair(base: string, quote: string): boolean {
    return quote === 'USD' && COINGECKO_ID[base] !== undefined;
  }

  async getPrice(
    base: string,
    _quote: string,
    timeoutMs: number,
    fetchImpl: typeof fetch,
  ): Promise<CryptoPriceQuote> {
    const id = COINGECKO_ID[base];
    if (!id) throw new ProviderUnsupportedPairError(`CoinGecko has no mapping for ${base}.`);

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`;
    const response = await timedFetch(url, timeoutMs, fetchImpl);

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 0;
      throw new ProviderRateLimitedError(Number.isFinite(retryAfterMs) ? retryAfterMs : 0);
    }
    if (!response.ok) {
      throw new ProviderServerError(response.status);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ProviderInvalidResponseError('CoinGecko returned invalid JSON.');
    }

    const entry = (body as Record<string, unknown> | null)?.[id];
    const usd = (entry as Record<string, unknown> | undefined)?.usd;
    if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0) {
      throw new ProviderInvalidResponseError('CoinGecko returned an invalid price.');
    }
    return { price: usd };
  }
}
