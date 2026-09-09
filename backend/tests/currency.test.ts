import { describe, expect, it, vi } from 'vitest';
import {
  CachingRateProvider,
  CurrencyRateUnavailableError,
  extractCurrencyRequest,
  FrankfurterRateProvider,
  resolveCurrencyCode,
} from '../src/currency';

describe('resolveCurrencyCode', () => {
  it('recognizes ISO codes case-insensitively', () => {
    expect(resolveCurrencyCode('THB')).toBe('THB');
    expect(resolveCurrencyCode('thb')).toBe('THB');
    expect(resolveCurrencyCode('Usd')).toBe('USD');
  });

  it('recognizes common full-name aliases', () => {
    expect(resolveCurrencyCode('baht')).toBe('THB');
    expect(resolveCurrencyCode('US dollars')).toBe('USD');
    expect(resolveCurrencyCode('yuan')).toBe('CNY');
  });

  it('returns null for an unrecognized token', () => {
    expect(resolveCurrencyCode('kilometer')).toBeNull();
    expect(resolveCurrencyCode('')).toBeNull();
  });

  it('recognizes full-word Thai currency names', () => {
    expect(resolveCurrencyCode('บาท')).toBe('THB');
    expect(resolveCurrencyCode('ดอลลาร์')).toBe('USD');
    expect(resolveCurrencyCode('ดอลล่าร์')).toBe('USD');
    expect(resolveCurrencyCode('ดอลลาร์สหรัฐ')).toBe('USD');
    expect(resolveCurrencyCode('ยูโร')).toBe('EUR');
    expect(resolveCurrencyCode('หยวน')).toBe('CNY');
    expect(resolveCurrencyCode('เยน')).toBe('JPY');
    expect(resolveCurrencyCode('วอน')).toBe('KRW');
    expect(resolveCurrencyCode('ปอนด์')).toBe('GBP');
  });

  it('disambiguates a clearly-specified national dollar instead of defaulting to USD', () => {
    expect(resolveCurrencyCode('Australian dollar')).toBe('AUD');
    expect(resolveCurrencyCode('Canadian dollars')).toBe('CAD');
    expect(resolveCurrencyCode('Singapore dollar')).toBe('SGD');
    expect(resolveCurrencyCode('Hong Kong dollar')).toBe('HKD');
    // A bare "dollar" with no country still defaults to the common USD reading.
    expect(resolveCurrencyCode('dollar')).toBe('USD');
  });
});

describe('extractCurrencyRequest', () => {
  it('extracts "100 THB = USD"', () => {
    expect(extractCurrencyRequest('100 THB = USD')).toEqual({ amount: 100, from: 'THB', to: 'USD' });
  });

  it('extracts "100 thb = usd ?" (lowercase, trailing question mark)', () => {
    expect(extractCurrencyRequest('100 thb = usd ?')).toEqual({ amount: 100, from: 'THB', to: 'USD' });
  });

  it('extracts "10 CNY to THB" (the "to" connector)', () => {
    expect(extractCurrencyRequest('10 CNY to THB')).toEqual({ amount: 10, from: 'CNY', to: 'THB' });
  });

  it('extracts full currency names: "100 Thai baht = US dollar"', () => {
    expect(extractCurrencyRequest('100 Thai baht = US dollar')).toEqual({
      amount: 100,
      from: 'THB',
      to: 'USD',
    });
  });

  it('returns null when either side is not a recognized currency (leaves it to the normal pipeline)', () => {
    expect(extractCurrencyRequest('10 km to miles')).toBeNull();
    expect(extractCurrencyRequest('100 kg = USD')).toBeNull();
  });

  it('returns null for multi-item input', () => {
    expect(extractCurrencyRequest('100 USD 5 EUR to THB')).toBeNull();
  });

  it('returns null when there is no connector', () => {
    expect(extractCurrencyRequest('100 USD THB')).toBeNull();
  });

  it('extracts full-word Thai currency requests: "100 บาท = ดอลลาร์"', () => {
    expect(extractCurrencyRequest('100 บาท = ดอลลาร์')).toEqual({ amount: 100, from: 'THB', to: 'USD' });
  });

  it('extracts "10 ดอลลาร์ = บาท" (reverse direction)', () => {
    expect(extractCurrencyRequest('10 ดอลลาร์ = บาท')).toEqual({ amount: 10, from: 'USD', to: 'THB' });
  });

  it('extracts with no spaces around the number/currency/connector: "100บาท=ดอลลาร์"', () => {
    expect(extractCurrencyRequest('100บาท=ดอลลาร์')).toEqual({ amount: 100, from: 'THB', to: 'USD' });
  });

  it('extracts "100 หยวน = บาท" and "100 เยน = บาท"', () => {
    expect(extractCurrencyRequest('100 หยวน = บาท')).toEqual({ amount: 100, from: 'CNY', to: 'THB' });
    expect(extractCurrencyRequest('100 เยน = บาท')).toEqual({ amount: 100, from: 'JPY', to: 'THB' });
  });

  it('extracts "10 ยูโร = ดอลลาร์"', () => {
    expect(extractCurrencyRequest('10 ยูโร = ดอลลาร์')).toEqual({ amount: 10, from: 'EUR', to: 'USD' });
  });
});

describe('FrankfurterRateProvider', () => {
  it('returns 1 for from === to without making a network call', async () => {
    const fetchImpl = vi.fn();
    const provider = new FrankfurterRateProvider(fetchImpl as unknown as typeof fetch);
    expect(await provider.getRate('THB', 'THB')).toBe(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('parses a successful Frankfurter response', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ amount: 1, base: 'THB', date: '2026-09-09', rates: { USD: 0.0287 } }), {
        status: 200,
      })) as unknown as typeof fetch;
    const provider = new FrankfurterRateProvider(fetchImpl);
    expect(await provider.getRate('THB', 'USD')).toBe(0.0287);
  });

  it('throws CurrencyRateUnavailableError on a non-200 response, never a fabricated rate', async () => {
    const fetchImpl = (async () => new Response('error', { status: 500 })) as unknown as typeof fetch;
    const provider = new FrankfurterRateProvider(fetchImpl);
    await expect(provider.getRate('THB', 'USD')).rejects.toBeInstanceOf(CurrencyRateUnavailableError);
  });

  it('throws CurrencyRateUnavailableError when the response has no rate for the target', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ rates: {} }), { status: 200 })) as unknown as typeof fetch;
    const provider = new FrankfurterRateProvider(fetchImpl);
    await expect(provider.getRate('THB', 'USD')).rejects.toBeInstanceOf(CurrencyRateUnavailableError);
  });

  it('throws CurrencyRateUnavailableError on a network failure', async () => {
    const fetchImpl = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const provider = new FrankfurterRateProvider(fetchImpl);
    await expect(provider.getRate('THB', 'USD')).rejects.toBeInstanceOf(CurrencyRateUnavailableError);
  });
});

describe('CachingRateProvider', () => {
  it('only calls the inner provider once for repeated requests within the TTL', async () => {
    let calls = 0;
    const inner = {
      getRate: async () => {
        calls += 1;
        return 0.0287;
      },
    };
    let now = 1_000_000;
    const provider = new CachingRateProvider(inner, 60_000, () => now);

    expect(await provider.getRate('THB', 'USD')).toBe(0.0287);
    expect(await provider.getRate('THB', 'USD')).toBe(0.0287);
    expect(calls).toBe(1);

    now += 61_000; // past the TTL
    expect(await provider.getRate('THB', 'USD')).toBe(0.0287);
    expect(calls).toBe(2);
  });

  it('caches each currency pair independently', async () => {
    const calls: string[] = [];
    const inner = {
      getRate: async (from: string, to: string) => {
        calls.push(`${from}_${to}`);
        return 1.23;
      },
    };
    const provider = new CachingRateProvider(inner);
    await provider.getRate('THB', 'USD');
    await provider.getRate('CNY', 'THB');
    await provider.getRate('THB', 'USD');
    expect(calls).toEqual(['THB_USD', 'CNY_THB']);
  });
});
