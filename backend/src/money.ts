/**
 * Money Intelligence: the single entry point that classifies and resolves
 * BOTH fiat and crypto requests, deterministically, before AI ever sees
 * them. This is the fix for the core bug this module exists to solve: a
 * currency/crypto code or name must be classified as money BEFORE it is
 * ever handed to the physical Unit Registry - a stray "thb"/"btc" reaching
 * the dimension-unaware registry is what produced "Unknown unit: ...".
 *
 *   Input -> arithmetic detection (local-extract/ArithmeticEvaluator)
 *         -> money detection (this module)
 *         -> unit detection (dimensions.ts / Flutter's Unit Registry)
 *         -> AI fallback
 *
 * Fiat rates come from Frankfurter (currency.ts); crypto prices come from
 * CoinGecko (crypto.ts). Neither is ever treated as a physical unit factor,
 * and AI is never asked for (or trusted with) either kind of rate - see
 * resolveMoneyRequest below, which is pure deterministic arithmetic once
 * the two prices/rates are fetched.
 */
import { resolveCurrencyCode, type CurrencyRateProvider } from './currency';
import { resolveCryptoSymbol, type CryptoPriceProvider } from './crypto';
import { dimensionOf } from './dimensions';

export type AssetType = 'fiat' | 'crypto';

export interface MoneyAsset {
  type: AssetType;
  code: string;
}

/** Resolves a raw token to a known fiat or crypto asset, or null if neither. */
export function resolveMoneyAsset(token: string): MoneyAsset | null {
  const fiat = resolveCurrencyCode(token);
  if (fiat) return { type: 'fiat', code: fiat };
  const crypto = resolveCryptoSymbol(token);
  if (crypto) return { type: 'crypto', code: crypto };
  return null;
}

const NUMBER_TOKEN = /\d+(?:[.,]\d+)?/g;

// Connector alternatives MUST be ordered longest-first wherever one is a
// prefix of another (e.g. "เท่ากับกี่" before "เท่ากับ", "เป็นเงินเท่าไหร่"
// before "เป็นเงิน"/"เป็นกี่"/"เป็น") - regex alternation tries options
// left-to-right and stops at the first match, so a shorter prefix listed
// earlier would grab only part of a longer phrase and leave the rest
// (e.g. a stray "กี่") stuck onto the target asset.
const CONNECTOR =
  /\bto\b|=|→|เป็นเงินเท่าไหร่|เท่ากับกี่|เป็นเงิน|เท่าไหร่|เป็นกี่|เท่ากับ|เป็น/i;

export interface MoneyRequest {
  amount: number;
  from: MoneyAsset;
  to: MoneyAsset;
}

interface SplitPhrase {
  amount: number;
  sourcePhrase: string;
  targetPhrase: string;
}

/**
 * The shape-only half of extraction: "<one number> <phrase> <connector>
 * <phrase>" - no asset resolution yet. Shared by [extractMoneyRequest] and
 * [detectAmbiguousMoneyRequest] so the phrasing/connector logic exists in
 * exactly one place.
 */
function splitMoneyShape(text: string): SplitPhrase | null {
  const trimmed = text.trim();
  const numbers = [...trimmed.matchAll(NUMBER_TOKEN)];
  if (numbers.length !== 1) return null;

  const connector = CONNECTOR.exec(trimmed);
  if (!connector) return null;

  const numberEnd = numbers[0].index! + numbers[0][0].length;
  if (connector.index <= numberEnd) return null;

  const amount = Number(numbers[0][0].replace(',', '.'));
  if (!Number.isFinite(amount)) return null;

  const sourcePhrase = trimmed.slice(numberEnd, connector.index);
  const targetPhrase = trimmed
    .slice(connector.index + connector[0].length)
    .replace(/[?？.!]+\s*$/, '');

  return { amount, sourcePhrase, targetPhrase };
}

/**
 * Deliberately narrow, deterministic extraction of "<one number> <asset>
 * <connector> <asset>" where BOTH sides resolve to a known fiat or crypto
 * asset. Returns null for anything else (multi-item input, no connector,
 * an asset this registry doesn't know) so ambiguous/non-money input is left
 * to the normal AI-assisted pipeline untouched.
 */
export function extractMoneyRequest(text: string): MoneyRequest | null {
  const split = splitMoneyShape(text);
  if (!split) return null;

  const from = resolveMoneyAsset(split.sourcePhrase);
  const to = resolveMoneyAsset(split.targetPhrase);
  if (!from || !to) return null;

  return { amount: split.amount, from, to };
}

/**
 * Catches the "1 abc = thb" shape: the phrasing is clearly money (one
 * number, a connector, ONE side is a recognized currency/asset) but the
 * OTHER side isn't anything this registry knows. Lets resolve.ts return a
 * friendly "Unknown currency or asset" instead of routing to AI (which
 * can't supply a rate for an asset it can't identify either) or letting a
 * stray fiat/crypto code slip into the physical Unit Registry's generic
 * "Unknown unit" error. Returns null when NEITHER side is money-shaped at
 * all (a normal unit conversion) or when BOTH resolve (handled by
 * extractMoneyRequest instead).
 */
export function detectAmbiguousMoneyRequest(text: string): { unrecognizedToken: string } | null {
  const split = splitMoneyShape(text);
  if (!split) return null;

  const from = resolveMoneyAsset(split.sourcePhrase);
  const to = resolveMoneyAsset(split.targetPhrase);
  if (from && to) return null; // both resolve -> not ambiguous, handled elsewhere
  if (!from && !to) return null; // neither resolves -> not money-shaped at all

  const unrecognizedPhrase = (from ? split.targetPhrase : split.sourcePhrase).trim();
  if (!unrecognizedPhrase) return null;

  // If the "unrecognized" side is actually a real, known PHYSICAL unit
  // (e.g. "100 kg = USD"), this is a genuine dimension mismatch, not an
  // unrecognized money asset - let the normal pipeline's dimension guard
  // handle it instead of misreporting a valid unit as an unknown currency.
  const words = unrecognizedPhrase.toLowerCase().split(/\s+/).filter(Boolean);
  const joined = words.join('_');
  if (dimensionOf(joined) || dimensionOf(words[words.length - 1] ?? '')) return null;

  return { unrecognizedToken: unrecognizedPhrase };
}

export class MoneyRateUnavailableError extends Error {}

export interface MoneyResolvers {
  fiatRateProvider: CurrencyRateProvider;
  cryptoPriceProvider: CryptoPriceProvider;
}

/**
 * Computes the final amount for any fiat/crypto/mixed pair. Pure
 * deterministic arithmetic on top of whatever the two providers return -
 * this function never fabricates a number itself, and AI is never called
 * anywhere in this path. Crypto legs always route through USD as the
 * common quote currency (e.g. ETH -> BTC is ETH/USD divided by BTC/USD).
 */
export async function resolveMoneyRequest(
  request: MoneyRequest,
  resolvers: MoneyResolvers,
): Promise<{ result: number; rate: number }> {
  const { amount, from, to } = request;

  try {
    if (from.type === 'fiat' && to.type === 'fiat') {
      const rate = await resolvers.fiatRateProvider.getRate(from.code, to.code);
      return { result: amount * rate, rate };
    }

    if (from.type === 'crypto' && to.type === 'crypto') {
      const [fromUsd, toUsd] = await Promise.all([
        resolvers.cryptoPriceProvider.getUsdPrice(from.code),
        resolvers.cryptoPriceProvider.getUsdPrice(to.code),
      ]);
      const rate = fromUsd / toUsd;
      return { result: amount * rate, rate };
    }

    if (from.type === 'crypto' && to.type === 'fiat') {
      const cryptoUsd = await resolvers.cryptoPriceProvider.getUsdPrice(from.code);
      const usdAmount = amount * cryptoUsd;
      if (to.code === 'USD') {
        return { result: usdAmount, rate: cryptoUsd };
      }
      const fxRate = await resolvers.fiatRateProvider.getRate('USD', to.code);
      return { result: usdAmount * fxRate, rate: cryptoUsd * fxRate };
    }

    // from.type === 'fiat' && to.type === 'crypto'
    const cryptoUsd = await resolvers.cryptoPriceProvider.getUsdPrice(to.code);
    let usdAmount = amount;
    let fxRate = 1;
    if (from.code !== 'USD') {
      fxRate = await resolvers.fiatRateProvider.getRate(from.code, 'USD');
      usdAmount = amount * fxRate;
    }
    const rate = fxRate / cryptoUsd;
    return { result: usdAmount / cryptoUsd, rate };
  } catch (err) {
    throw new MoneyRateUnavailableError(err instanceof Error ? err.message : 'Rate/price unavailable.');
  }
}
