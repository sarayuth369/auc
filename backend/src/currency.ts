/**
 * Currency conversion is deliberately a SEPARATE category from
 * dimensions.ts/local-extract.ts, which only ever deal with physical,
 * constant conversion factors. Exchange rates change continuously and must
 * never be treated as a fixed Unit Registry factor, and AI must never be
 * asked for (or trusted with) a rate - currency codes are a small, closed,
 * unambiguous set, detected deterministically here without AI, and the
 * actual rate always comes from a CurrencyRateProvider.
 */

const CURRENCY_CODES = new Set([
  'THB', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'KRW', 'INR',
  'AUD', 'CAD', 'SGD', 'HKD', 'CHF', 'NZD',
]);

// A few extremely common full-name/informal aliases - deliberately small,
// not an exhaustive currency-name dictionary (that's AI's job for anything
// this doesn't cover; this only needs to catch the obvious cases so they
// never reach AI, which must never supply a rate anyway).
//
// "dollar" alone defaults to USD (the common/global interpretation); a
// clearly-specified national dollar (Australian/Canadian/Singapore/Hong
// Kong) maps to its own code instead - checked as a distinct, more specific
// key, so it isn't shadowed by the bare "dollar" entry.
const CURRENCY_NAME_ALIASES: Record<string, string> = {
  baht: 'THB',
  'thai baht': 'THB',
  'บาท': 'THB',
  dollar: 'USD',
  dollars: 'USD',
  'us dollar': 'USD',
  'us dollars': 'USD',
  'ดอลลาร์': 'USD',
  'ดอลล่าร์': 'USD',
  'ดอลลาร์สหรัฐ': 'USD',
  'australian dollar': 'AUD',
  'australian dollars': 'AUD',
  'canadian dollar': 'CAD',
  'canadian dollars': 'CAD',
  'singapore dollar': 'SGD',
  'singapore dollars': 'SGD',
  'hong kong dollar': 'HKD',
  'hong kong dollars': 'HKD',
  euro: 'EUR',
  euros: 'EUR',
  'ยูโร': 'EUR',
  pound: 'GBP',
  pounds: 'GBP',
  sterling: 'GBP',
  'ปอนด์': 'GBP',
  yen: 'JPY',
  'เยน': 'JPY',
  yuan: 'CNY',
  rmb: 'CNY',
  renminbi: 'CNY',
  'หยวน': 'CNY',
  won: 'KRW',
  'วอน': 'KRW',
  rupee: 'INR',
  rupees: 'INR',
};

/** Resolves a raw token to a known ISO 4217 code, or null if unrecognized. */
export function resolveCurrencyCode(token: string): string | null {
  const normalized = token.trim().toLowerCase();
  if (!normalized) return null;
  const upper = normalized.toUpperCase();
  if (CURRENCY_CODES.has(upper)) return upper;
  return CURRENCY_NAME_ALIASES[normalized] ?? null;
}

const NUMBER_TOKEN = /\d+(?:[.,]\d+)?/g;
// Mirrors the connectors the Flutter LocalParser recognizes ("=", "→", "to")
// so a currency request phrased either way is detected the same.
const CONNECTOR = /\bto\b|=|→/i;

export interface CurrencyRequest {
  amount: number;
  from: string;
  to: string;
}

/**
 * Deliberately narrow, deterministic extraction of "<one number> <currency>
 * to|= <currency>". Returns null for anything else (multi-item, no
 * connector, unrecognized currency token) so ambiguous/non-currency input
 * is left to the normal /api/resolve pipeline untouched.
 */
export function extractCurrencyRequest(text: string): CurrencyRequest | null {
  const trimmed = text.trim();
  const numbers = [...trimmed.matchAll(NUMBER_TOKEN)];
  if (numbers.length !== 1) return null;

  const connector = CONNECTOR.exec(trimmed);
  if (!connector) return null;

  const numberEnd = numbers[0].index! + numbers[0][0].length;
  if (connector.index <= numberEnd) return null;

  const sourcePhrase = trimmed.slice(numberEnd, connector.index);
  const targetPhrase = trimmed
    .slice(connector.index + connector[0].length)
    .replace(/[?？.!]+\s*$/, '');

  const from = resolveCurrencyCode(sourcePhrase);
  const to = resolveCurrencyCode(targetPhrase);
  if (!from || !to) return null;

  const amount = Number(numbers[0][0].replace(',', '.'));
  if (!Number.isFinite(amount)) return null;

  return { amount, from, to };
}

export class CurrencyRateUnavailableError extends Error {}

export interface CurrencyRateProvider {
  /** Current units of `to` per 1 unit of `from`. Never invented - throws CurrencyRateUnavailableError if it can't get a real rate. */
  getRate(from: string, to: string): Promise<number>;
}

/**
 * Frankfurter (https://frankfurter.dev) publishes ECB reference rates,
 * refreshed daily, free and keyless - no secret to manage, nothing to leak.
 * Chosen specifically so no API key/Worker secret is needed for this
 * feature at all (see task: "do not add unnecessary API keys if a reliable
 * public source is appropriate").
 */
export class FrankfurterRateProvider implements CurrencyRateProvider {
  // Default calls the global fetch through a wrapper rather than passing the
  // bare function reference - Cloudflare Workers' fetch relies on being
  // invoked as `fetch(...)`, not detached and called as `this.fetchImpl(...)`
  // (an "Illegal invocation: incorrect `this` reference" error otherwise).
  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;

    const url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`;
    let response: Response;
    try {
      response = await this.fetchImpl(url);
    } catch (err) {
      throw new CurrencyRateUnavailableError(
        err instanceof Error ? err.message : 'Could not reach the currency rate provider.',
      );
    }
    if (!response.ok) {
      throw new CurrencyRateUnavailableError(`Currency rate provider responded with HTTP ${response.status}.`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new CurrencyRateUnavailableError('Currency rate provider returned invalid JSON.');
    }

    const rates = (body as Record<string, unknown> | null)?.rates;
    const rate = (rates as Record<string, unknown> | undefined)?.[to];
    if (typeof rate !== 'number' || !Number.isFinite(rate)) {
      throw new CurrencyRateUnavailableError(`No rate available for ${from} -> ${to}.`);
    }
    return rate;
  }
}

interface CacheEntry {
  rate: number;
  expiresAt: number;
}

/**
 * Wraps any CurrencyRateProvider with a short in-memory cache (module-scope,
 * lives for the Worker isolate's lifetime) so repeated requests for the
 * same pair within the TTL don't refetch - rates don't move fast enough to
 * need per-request freshness, and this keeps latency/cost down.
 */
export class CachingRateProvider implements CurrencyRateProvider {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly inner: CurrencyRateProvider,
    private readonly ttlMs: number = 60 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  async getRate(from: string, to: string): Promise<number> {
    const key = `${from}_${to}`;
    const cached = this.cache.get(key);
    const nowMs = this.now();
    if (cached && cached.expiresAt > nowMs) {
      return cached.rate;
    }
    const rate = await this.inner.getRate(from, to);
    this.cache.set(key, { rate, expiresAt: nowMs + this.ttlMs });
    return rate;
  }
}
