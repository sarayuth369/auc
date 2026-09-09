import {
  ProviderInvalidResponseError,
  ProviderRateLimitedError,
  ProviderServerError,
  ProviderUnsupportedPairError,
  timedFetch,
  type CryptoMarketProvider,
  type CryptoPriceQuote,
} from './types';

// Binance.com has no direct USD markets for most assets (it trades against
// USDT) - substituting USDT for a "USD" quote request is standard practice
// (near-1:1 stablecoin parity), not a fabricated price: it's a real traded
// market price for the actual USDT pair.
const BINANCE_QUOTE_SUBSTITUTE: Record<string, string> = { USD: 'USDT' };

/**
 * Binance's public ticker/price endpoint - keyless, no auth, generous
 * weight-based rate limit (a single ticker call costs ~2 of a ~1200/min
 * budget). Note: binance.com is geo-restricted for some jurisdictions
 * (notably US IPs get HTTP 451) - since a Cloudflare Worker's egress IP can
 * originate from many countries, this provider may transiently fail for
 * reasons outside its own health; the gateway's normal failover already
 * covers this (see final report).
 */
export class BinanceProvider implements CryptoMarketProvider {
  readonly name = 'binance';

  supportsPair(_base: string, _quote: string): boolean {
    return true;
  }

  async getPrice(
    base: string,
    quote: string,
    timeoutMs: number,
    fetchImpl: typeof fetch,
  ): Promise<CryptoPriceQuote> {
    const effectiveQuote = BINANCE_QUOTE_SUBSTITUTE[quote] ?? quote;
    const symbol = `${base}${effectiveQuote}`;
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`;
    const response = await timedFetch(url, timeoutMs, fetchImpl);

    // 418 = Binance's automated-IP-ban status for repeated rate-limit
    // violations - treated the same as 429 (fail over, cool down).
    if (response.status === 429 || response.status === 418) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 0;
      throw new ProviderRateLimitedError(Number.isFinite(retryAfterMs) ? retryAfterMs : 0);
    }
    if (response.status === 400) {
      throw new ProviderUnsupportedPairError(`Binance has no market for ${symbol}.`);
    }
    if (!response.ok) {
      throw new ProviderServerError(response.status);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ProviderInvalidResponseError('Binance returned invalid JSON.');
    }

    const raw = (body as { price?: unknown } | null)?.price;
    const price = typeof raw === 'string' ? Number(raw) : NaN;
    if (!Number.isFinite(price) || price <= 0) {
      throw new ProviderInvalidResponseError('Binance returned an invalid price.');
    }
    return { price };
  }
}
