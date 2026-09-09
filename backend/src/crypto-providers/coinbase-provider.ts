import {
  ProviderInvalidResponseError,
  ProviderRateLimitedError,
  ProviderServerError,
  ProviderUnsupportedPairError,
  timedFetch,
  type CryptoMarketProvider,
  type CryptoPriceQuote,
} from './types';

/**
 * Coinbase's public v2 spot-price endpoint - keyless, no auth. Asset codes
 * match this app's own symbol registry (BTC, ETH, XRP, ...) with no
 * translation table needed, unlike Kraken's legacy asset codes. Coinbase
 * also serves crypto-crypto pairs (e.g. ETH-BTC) directly when a real
 * market exists, so this doubles as the primary "direct pair" attempt.
 *
 * Public rate limit is ~3-10 req/s per IP (Coinbase's documented burst
 * limit for unauthenticated market-data endpoints); no commercial-use
 * prohibition was found for reading public price data, but this has not
 * been reviewed by counsel - see the task's own final report requirement.
 */
export class CoinbaseProvider implements CryptoMarketProvider {
  readonly name = 'coinbase';

  supportsPair(_base: string, _quote: string): boolean {
    // Coinbase's pair coverage isn't something we can cheaply predict -
    // let the actual request be the source of truth (an unsupported pair
    // comes back 404, handled below as ProviderUnsupportedPairError).
    return true;
  }

  async getPrice(
    base: string,
    quote: string,
    timeoutMs: number,
    fetchImpl: typeof fetch,
  ): Promise<CryptoPriceQuote> {
    const url = `https://api.coinbase.com/v2/prices/${base}-${quote}/spot`;
    const response = await timedFetch(url, timeoutMs, fetchImpl);

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 0;
      throw new ProviderRateLimitedError(Number.isFinite(retryAfterMs) ? retryAfterMs : 0);
    }
    if (response.status === 404 || response.status === 400) {
      throw new ProviderUnsupportedPairError(`Coinbase has no market for ${base}-${quote}.`);
    }
    if (!response.ok) {
      throw new ProviderServerError(response.status);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ProviderInvalidResponseError('Coinbase returned invalid JSON.');
    }

    const amount = (body as { data?: { amount?: unknown } } | null)?.data?.amount;
    const price = typeof amount === 'string' ? Number(amount) : NaN;
    if (!Number.isFinite(price) || price <= 0) {
      throw new ProviderInvalidResponseError('Coinbase returned an invalid price.');
    }
    return { price };
  }
}
