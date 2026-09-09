/**
 * Shared contract every crypto market-data adapter implements, plus the
 * error taxonomy CryptoPriceGateway uses to decide "fail over to the next
 * provider" vs "cool this provider down" vs "give up." Each adapter file
 * (coinbase/kraken/binance/coingecko) is isolated and testable on its own -
 * no shared mutable state lives here, only types and a stateless fetch
 * helper to avoid repeating the same AbortController boilerplate four times.
 */

export interface CryptoPriceQuote {
  price: number;
}

export interface CryptoMarketProvider {
  readonly name: string;
  /** Cheap, synchronous plausibility check - NOT a guarantee. Lets the
   *  gateway skip a provider that structurally can't serve a pair (e.g.
   *  Kraken has no BNB market) without wasting a network round-trip; the
   *  real answer always comes from getPrice's actual response. */
  supportsPair(base: string, quote: string): boolean;
  getPrice(
    base: string,
    quote: string,
    timeoutMs: number,
    fetchImpl: typeof fetch,
  ): Promise<CryptoPriceQuote>;
}

/** The pair/asset isn't offered by this provider at all - not a health
 *  problem, so the gateway tries the next provider without any cooldown. */
export class ProviderUnsupportedPairError extends Error {}

export class ProviderRateLimitedError extends Error {
  constructor(readonly retryAfterMs: number) {
    super('Provider rate limit (429).');
  }
}

export class ProviderTimeoutError extends Error {}

export class ProviderServerError extends Error {
  constructor(readonly status: number) {
    super(`Provider server error (HTTP ${status}).`);
  }
}

export class ProviderInvalidResponseError extends Error {}
export class ProviderNetworkError extends Error {}

export type CryptoUnavailableReason =
  | 'NO_PROVIDER_AVAILABLE'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UNSUPPORTED_ASSET'
  | 'NO_MARKET_PAIR'
  | 'INVALID_PROVIDER_RESPONSE'
  | 'NETWORK_ERROR';

/** Maps a provider-level failure to the gateway's user-facing unavailable reason. */
export function classifyProviderError(err: unknown): CryptoUnavailableReason {
  if (err instanceof ProviderRateLimitedError) return 'RATE_LIMITED';
  if (err instanceof ProviderTimeoutError) return 'TIMEOUT';
  if (err instanceof ProviderUnsupportedPairError) return 'UNSUPPORTED_ASSET';
  if (err instanceof ProviderInvalidResponseError) return 'INVALID_PROVIDER_RESPONSE';
  if (err instanceof ProviderNetworkError) return 'NETWORK_ERROR';
  return 'NO_PROVIDER_AVAILABLE';
}

export const CRYPTO_USER_AGENT = 'SmartConverter/1.0 (+https://auc-backend.biz2success.workers.dev)';

/** Shared fetch-with-timeout used by every adapter - a stateless utility,
 *  not shared state, so it doesn't compromise per-provider isolation. */
export async function timedFetch(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': CRYPTO_USER_AGENT },
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ProviderTimeoutError(`Request to ${url} timed out.`);
    }
    throw new ProviderNetworkError(err instanceof Error ? err.message : 'Network error.');
  } finally {
    clearTimeout(timeout);
  }
}
