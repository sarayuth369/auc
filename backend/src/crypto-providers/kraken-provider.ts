import {
  ProviderInvalidResponseError,
  ProviderRateLimitedError,
  ProviderServerError,
  ProviderUnsupportedPairError,
  timedFetch,
  type CryptoMarketProvider,
  type CryptoPriceQuote,
} from './types';

// Kraken's legacy asset codes diverge from the rest of the market (BTC is
// "XBT", Dogecoin is "XDG") - this table is Kraken-specific and stays
// isolated to this file, never leaking into the shared symbol registry.
const KRAKEN_ASSET_CODE: Record<string, string> = {
  BTC: 'XBT',
  DOGE: 'XDG',
};

// Kraken simply has no market for these - skip without a wasted request.
const KRAKEN_UNSUPPORTED = new Set(['BNB']);

function krakenAsset(symbol: string): string {
  return KRAKEN_ASSET_CODE[symbol] ?? symbol;
}

/**
 * Kraken's public Ticker endpoint - keyless, no auth. Public endpoints are
 * documented as uncounted against the trading rate-limit budget, with
 * roughly 1 req/sec per IP as a safe informal ceiling.
 */
export class KrakenProvider implements CryptoMarketProvider {
  readonly name = 'kraken';

  supportsPair(base: string, quote: string): boolean {
    return !KRAKEN_UNSUPPORTED.has(base) && !KRAKEN_UNSUPPORTED.has(quote);
  }

  async getPrice(
    base: string,
    quote: string,
    timeoutMs: number,
    fetchImpl: typeof fetch,
  ): Promise<CryptoPriceQuote> {
    const pair = `${krakenAsset(base)}${krakenAsset(quote)}`;
    const url = `https://api.kraken.com/0/public/Ticker?pair=${encodeURIComponent(pair)}`;
    const response = await timedFetch(url, timeoutMs, fetchImpl);

    if (response.status === 429) {
      throw new ProviderRateLimitedError(0);
    }
    if (!response.ok) {
      throw new ProviderServerError(response.status);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ProviderInvalidResponseError('Kraken returned invalid JSON.');
    }

    // Kraken reports an unknown pair as HTTP 200 with a populated `error`
    // array (e.g. "EQuery:Unknown asset pair") rather than a 4xx status.
    const errors = (body as { error?: unknown } | null)?.error;
    if (Array.isArray(errors) && errors.length > 0) {
      throw new ProviderUnsupportedPairError(`Kraken: ${errors.join('; ')}`);
    }

    const result = (body as { result?: Record<string, unknown> } | null)?.result;
    const entry = result ? Object.values(result)[0] : undefined;
    const closeArray = (entry as { c?: unknown } | undefined)?.c;
    const lastTrade = Array.isArray(closeArray) ? closeArray[0] : undefined;
    const price = typeof lastTrade === 'string' ? Number(lastTrade) : NaN;
    if (!Number.isFinite(price) || price <= 0) {
      throw new ProviderInvalidResponseError('Kraken returned an invalid price.');
    }
    return { price };
  }
}
