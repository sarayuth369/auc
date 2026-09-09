import { describe, expect, it } from 'vitest';
import {
  detectAmbiguousMoneyRequest,
  extractMoneyRequest,
  MoneyRateUnavailableError,
  resolveMoneyAsset,
  resolveMoneyRequest,
} from '../src/money';

describe('resolveMoneyAsset', () => {
  it('classifies a fiat code', () => {
    expect(resolveMoneyAsset('THB')).toEqual({ type: 'fiat', code: 'THB' });
    expect(resolveMoneyAsset('usd')).toEqual({ type: 'fiat', code: 'USD' });
  });

  it('classifies a crypto symbol', () => {
    expect(resolveMoneyAsset('BTC')).toEqual({ type: 'crypto', code: 'BTC' });
    expect(resolveMoneyAsset('bitcoin')).toEqual({ type: 'crypto', code: 'BTC' });
  });

  it('returns null for a non-money token, never producing a fake asset', () => {
    expect(resolveMoneyAsset('kilometer')).toBeNull();
  });
});

describe('extractMoneyRequest - natural-language fiat connectors (the core bug fix)', () => {
  it('"100 บาทเป็นดอลลาร์" (no spaces, "เป็น" connector) -> THB -> USD', () => {
    expect(extractMoneyRequest('100 บาทเป็นดอลลาร์')).toEqual({
      amount: 100,
      from: { type: 'fiat', code: 'THB' },
      to: { type: 'fiat', code: 'USD' },
    });
  });

  it('"10 ดอลลาร์เป็นบาท" (reverse direction)', () => {
    expect(extractMoneyRequest('10 ดอลลาร์เป็นบาท')).toEqual({
      amount: 10,
      from: { type: 'fiat', code: 'USD' },
      to: { type: 'fiat', code: 'THB' },
    });
  });

  it('"100 บาทเท่ากับกี่ดอลลาร์" ("เท่ากับกี่" connector)', () => {
    expect(extractMoneyRequest('100 บาทเท่ากับกี่ดอลลาร์')).toEqual({
      amount: 100,
      from: { type: 'fiat', code: 'THB' },
      to: { type: 'fiat', code: 'USD' },
    });
  });

  it('"100 บาท เป็นกี่ ดอลลาร์" (with spaces, "เป็นกี่" connector)', () => {
    expect(extractMoneyRequest('100 บาท เป็นกี่ ดอลลาร์')).toEqual({
      amount: 100,
      from: { type: 'fiat', code: 'THB' },
      to: { type: 'fiat', code: 'USD' },
    });
  });

  it('longest-connector-first: "เป็นเงินเท่าไหร่" is not truncated to "เป็นเงิน" leaving a stray suffix', () => {
    const result = extractMoneyRequest('100 บาทเป็นเงินเท่าไหร่ดอลลาร์');
    expect(result).toEqual({
      amount: 100,
      from: { type: 'fiat', code: 'THB' },
      to: { type: 'fiat', code: 'USD' },
    });
  });

  it('still supports "=" and "to"', () => {
    expect(extractMoneyRequest('100 บาท = ดอลลาร์')).toEqual({
      amount: 100,
      from: { type: 'fiat', code: 'THB' },
      to: { type: 'fiat', code: 'USD' },
    });
    expect(extractMoneyRequest('10 USD to THB')).toEqual({
      amount: 10,
      from: { type: 'fiat', code: 'USD' },
      to: { type: 'fiat', code: 'THB' },
    });
  });
});

describe('extractMoneyRequest - crypto and mixed (the second reported bug)', () => {
  it('"1 btc = thb" (the exact reported failure) -> crypto -> fiat', () => {
    expect(extractMoneyRequest('1 btc = thb')).toEqual({
      amount: 1,
      from: { type: 'crypto', code: 'BTC' },
      to: { type: 'fiat', code: 'THB' },
    });
  });

  it('"1 ETH = BTC" -> crypto -> crypto', () => {
    expect(extractMoneyRequest('1 ETH = BTC')).toEqual({
      amount: 1,
      from: { type: 'crypto', code: 'ETH' },
      to: { type: 'crypto', code: 'BTC' },
    });
  });

  it('"1000 THB = BTC" -> fiat -> crypto', () => {
    expect(extractMoneyRequest('1000 THB = BTC')).toEqual({
      amount: 1000,
      from: { type: 'fiat', code: 'THB' },
      to: { type: 'crypto', code: 'BTC' },
    });
  });

  it('natural-language crypto: "1 Bitcoin = THB" and "1 บิทคอยน์ = บาท"', () => {
    expect(extractMoneyRequest('1 Bitcoin = THB')).toEqual({
      amount: 1,
      from: { type: 'crypto', code: 'BTC' },
      to: { type: 'fiat', code: 'THB' },
    });
    expect(extractMoneyRequest('1 บิทคอยน์ = บาท')).toEqual({
      amount: 1,
      from: { type: 'crypto', code: 'BTC' },
      to: { type: 'fiat', code: 'THB' },
    });
  });

  it('"100 บาทเป็น BTC" (mixed, Thai connector, fiat -> crypto)', () => {
    expect(extractMoneyRequest('100 บาทเป็น BTC')).toEqual({
      amount: 100,
      from: { type: 'fiat', code: 'THB' },
      to: { type: 'crypto', code: 'BTC' },
    });
  });
});

describe('extractMoneyRequest - safe null cases', () => {
  it('returns null for a normal unit conversion (money must not steal units)', () => {
    expect(extractMoneyRequest('10 km to miles')).toBeNull();
    expect(extractMoneyRequest('100 kg = USD')).toBeNull();
  });

  it('returns null for an unrecognized asset on either side', () => {
    expect(extractMoneyRequest('1 abc = thb')).toBeNull();
    expect(extractMoneyRequest('1 dollar = xyz')).toBeNull();
  });

  it('returns null for multi-item input', () => {
    expect(extractMoneyRequest('100 USD 5 EUR to THB')).toBeNull();
  });
});

describe('detectAmbiguousMoneyRequest (section 16: friendly unknown-asset error)', () => {
  it('"1 abc = thb" identifies "abc" as the unrecognized side', () => {
    expect(detectAmbiguousMoneyRequest('1 abc = thb')).toEqual({ unrecognizedToken: 'abc' });
  });

  it('"1 dollar = xyz" identifies "xyz" as the unrecognized side', () => {
    expect(detectAmbiguousMoneyRequest('1 dollar = xyz')).toEqual({ unrecognizedToken: 'xyz' });
  });

  it('does NOT fire when both sides resolve (handled by extractMoneyRequest instead)', () => {
    expect(detectAmbiguousMoneyRequest('100 THB = USD')).toBeNull();
  });

  it('does NOT fire when neither side is money-shaped at all (a normal unit conversion)', () => {
    expect(detectAmbiguousMoneyRequest('10 km to miles')).toBeNull();
  });

  it('does NOT misreport a genuine physical unit as an unknown currency: "100 kg = USD"', () => {
    // kg is a real, known physical unit - this is a dimension mismatch
    // (mass vs currency), not an unrecognized money asset.
    expect(detectAmbiguousMoneyRequest('100 kg = USD')).toBeNull();
  });

  it('does NOT misreport "100 THB = meters" either', () => {
    expect(detectAmbiguousMoneyRequest('100 THB = meters')).toBeNull();
  });
});

describe('resolveMoneyRequest - deterministic cross-rate arithmetic, never AI', () => {
  const fiatRateProvider = {
    getRate: async (from: string, to: string) => {
      if (from === 'USD' && to === 'THB') return 33;
      if (from === 'THB' && to === 'USD') return 1 / 33;
      throw new Error(`unexpected fiat pair ${from}->${to}`);
    },
  };
  const usdPrices: Record<string, number> = { BTC: 65000, ETH: 3250 };
  const cryptoPriceProvider = {
    getUsdPrice: async (symbol: string) => {
      if (usdPrices[symbol] === undefined) throw new Error(`unexpected symbol ${symbol}`);
      return { price: usdPrices[symbol], stale: false };
    },
    getUsdPrices: async (symbols: string[]) => {
      const result: Record<string, { price: number; stale: boolean }> = {};
      for (const symbol of symbols) {
        if (usdPrices[symbol] === undefined) throw new Error(`unexpected symbol ${symbol}`);
        result[symbol] = { price: usdPrices[symbol], stale: false };
      }
      return result;
    },
  };
  const resolvers = { fiatRateProvider, cryptoPriceProvider };

  it('fiat -> fiat uses the fiat rate directly', async () => {
    const { result, rate } = await resolveMoneyRequest(
      { amount: 100, from: { type: 'fiat', code: 'THB' }, to: { type: 'fiat', code: 'USD' } },
      resolvers,
    );
    expect(rate).toBeCloseTo(1 / 33, 10);
    expect(result).toBeCloseTo(100 / 33, 10);
  });

  it('crypto -> fiat (USD) uses the raw USD price', async () => {
    const { result } = await resolveMoneyRequest(
      { amount: 1, from: { type: 'crypto', code: 'BTC' }, to: { type: 'fiat', code: 'USD' } },
      resolvers,
    );
    expect(result).toBe(65000);
  });

  it('crypto -> fiat (non-USD) cross-rates through USD', async () => {
    const { result } = await resolveMoneyRequest(
      { amount: 1, from: { type: 'crypto', code: 'BTC' }, to: { type: 'fiat', code: 'THB' } },
      resolvers,
    );
    expect(result).toBeCloseTo(65000 * 33, 6);
  });

  it('fiat -> crypto cross-rates through USD', async () => {
    const { result } = await resolveMoneyRequest(
      { amount: 1000, from: { type: 'fiat', code: 'THB' }, to: { type: 'crypto', code: 'BTC' } },
      resolvers,
    );
    // 1000 THB -> USD -> / BTC price
    const expectedUsd = 1000 / 33;
    expect(result).toBeCloseTo(expectedUsd / 65000, 12);
  });

  it('fiat(USD) -> crypto skips the FX call entirely', async () => {
    const { result } = await resolveMoneyRequest(
      { amount: 100, from: { type: 'fiat', code: 'USD' }, to: { type: 'crypto', code: 'BTC' } },
      resolvers,
    );
    expect(result).toBeCloseTo(100 / 65000, 12);
  });

  it('crypto -> crypto cross-rates through USD, never a hardcoded ratio', async () => {
    const { result, rate } = await resolveMoneyRequest(
      { amount: 1, from: { type: 'crypto', code: 'ETH' }, to: { type: 'crypto', code: 'BTC' } },
      resolvers,
    );
    expect(rate).toBeCloseTo(3250 / 65000, 12);
    expect(result).toBeCloseTo(3250 / 65000, 12);
  });

  it('a provider failure throws MoneyRateUnavailableError, never a fabricated result', async () => {
    const failingResolvers = {
      fiatRateProvider: {
        getRate: async () => {
          throw new Error('fx down');
        },
      },
      cryptoPriceProvider,
    };
    await expect(
      resolveMoneyRequest(
        { amount: 1, from: { type: 'fiat', code: 'THB' }, to: { type: 'fiat', code: 'USD' } },
        failingResolvers,
      ),
    ).rejects.toBeInstanceOf(MoneyRateUnavailableError);
  });
});
