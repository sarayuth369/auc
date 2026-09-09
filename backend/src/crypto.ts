/**
 * Crypto symbol registry: deliberately separate from currency.ts's fiat FX
 * (a different market, different providers) and from dimensions.ts's
 * physical unit factors (crypto is not an SI unit and has no fixed factor
 * at all - its "factor" is a live market price that must never be treated
 * as constant, or invented by AI).
 *
 * Live price resolution itself lives in crypto-gateway.ts (multi-provider
 * failover across crypto-providers/*) - this file only owns symbol
 * identity: which tokens are known crypto assets and what they normalize
 * to. Centralized here so no other file needs its own copy of this list.
 */
export const KNOWN_CRYPTO_SYMBOLS: ReadonlySet<string> = new Set([
  'BTC',
  'ETH',
  'USDT',
  'USDC',
  'BNB',
  'SOL',
  'XRP',
  'ADA',
  'DOGE',
  'TRX',
  'AVAX',
  'DOT',
  'LINK',
]);

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
  if (KNOWN_CRYPTO_SYMBOLS.has(upper)) return upper;
  return CRYPTO_NAME_ALIASES[normalized] ?? null;
}

/** Machine-readable reason a live/cached crypto price couldn't be resolved -
 *  lets resolve.ts show a distinct, honest, user-friendly message per
 *  failure mode instead of one generic string for everything. */
export type CryptoUnavailableReason =
  | 'NO_PROVIDER_AVAILABLE'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UNSUPPORTED_ASSET'
  | 'NO_MARKET_PAIR'
  | 'INVALID_PROVIDER_RESPONSE'
  | 'NETWORK_ERROR';

export class CryptoPriceUnavailableError extends Error {
  constructor(
    message: string,
    readonly reason: CryptoUnavailableReason = 'NO_PROVIDER_AVAILABLE',
  ) {
    super(message);
  }
}
