import { describe, expect, it } from 'vitest';
import {
  CachingCryptoPriceProvider,
  CoinGeckoPriceProvider,
  CryptoPriceUnavailableError,
  resolveCryptoSymbol,
} from '../src/crypto';

describe('resolveCryptoSymbol', () => {
  it('recognizes symbols case-insensitively', () => {
    expect(resolveCryptoSymbol('BTC')).toBe('BTC');
    expect(resolveCryptoSymbol('btc')).toBe('BTC');
    expect(resolveCryptoSymbol('Eth')).toBe('ETH');
  });

  it('recognizes all registered symbols', () => {
    for (const symbol of ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'TRX', 'AVAX', 'DOT', 'LINK']) {
      expect(resolveCryptoSymbol(symbol)).toBe(symbol);
    }
  });

  it('recognizes common full-name aliases (English + Thai)', () => {
    expect(resolveCryptoSymbol('bitcoin')).toBe('BTC');
    expect(resolveCryptoSymbol('Bitcoin')).toBe('BTC');
    expect(resolveCryptoSymbol('บิทคอยน์')).toBe('BTC');
    expect(resolveCryptoSymbol('บิตคอยน์')).toBe('BTC');
    expect(resolveCryptoSymbol('ethereum')).toBe('ETH');
    expect(resolveCryptoSymbol('อีเธอเรียม')).toBe('ETH');
    expect(resolveCryptoSymbol('tether')).toBe('USDT');
  });

  it('returns null for a fiat code or unrelated token', () => {
    expect(resolveCryptoSymbol('THB')).toBeNull();
    expect(resolveCryptoSymbol('kilometer')).toBeNull();
    expect(resolveCryptoSymbol('')).toBeNull();
  });
});

describe('CoinGeckoPriceProvider', () => {
  it('fetches a single USD price', async () => {
    const fetchImpl = (async (url: string) => {
      expect(url).toContain('ids=bitcoin');
      expect(url).toContain('vs_currencies=usd');
      return new Response(JSON.stringify({ bitcoin: { usd: 65000.12 } }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new CoinGeckoPriceProvider(fetchImpl);
    expect(await provider.getUsdPrice('BTC')).toBe(65000.12);
  });

  it('fetches multiple prices in a single request', async () => {
    let callCount = 0;
    const fetchImpl = (async (url: string) => {
      callCount++;
      expect(url).toContain('bitcoin');
      expect(url).toContain('ethereum');
      return new Response(
        JSON.stringify({ bitcoin: { usd: 65000 }, ethereum: { usd: 3500 } }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const provider = new CoinGeckoPriceProvider(fetchImpl);
    const prices = await provider.getUsdPrices(['BTC', 'ETH']);
    expect(prices).toEqual({ BTC: 65000, ETH: 3500 });
    expect(callCount).toBe(1);
  });

  it('throws CryptoPriceUnavailableError on a non-200 response, never a fabricated price', async () => {
    const fetchImpl = (async () => new Response('error', { status: 500 })) as unknown as typeof fetch;
    const provider = new CoinGeckoPriceProvider(fetchImpl);
    await expect(provider.getUsdPrice('BTC')).rejects.toBeInstanceOf(CryptoPriceUnavailableError);
  });

  it('throws CryptoPriceUnavailableError when the response has no price for the asset', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    const provider = new CoinGeckoPriceProvider(fetchImpl);
    await expect(provider.getUsdPrice('BTC')).rejects.toBeInstanceOf(CryptoPriceUnavailableError);
  });

  it('throws CryptoPriceUnavailableError on a network failure', async () => {
    const fetchImpl = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const provider = new CoinGeckoPriceProvider(fetchImpl);
    await expect(provider.getUsdPrice('BTC')).rejects.toBeInstanceOf(CryptoPriceUnavailableError);
  });
});

describe('CachingCryptoPriceProvider', () => {
  it('only calls the inner provider once per symbol within the TTL', async () => {
    let calls = 0;
    const inner = {
      getUsdPrice: async () => {
        calls++;
        return 65000;
      },
    };
    let now = 1_000_000;
    const provider = new CachingCryptoPriceProvider(inner, 60_000, () => now);

    expect(await provider.getUsdPrice('BTC')).toBe(65000);
    expect(await provider.getUsdPrice('BTC')).toBe(65000);
    expect(calls).toBe(1);

    now += 61_000;
    expect(await provider.getUsdPrice('BTC')).toBe(65000);
    expect(calls).toBe(2);
  });

  it('caches each symbol independently', async () => {
    const seen: string[] = [];
    const inner = {
      getUsdPrice: async (symbol: string) => {
        seen.push(symbol);
        return 1;
      },
    };
    const provider = new CachingCryptoPriceProvider(inner);
    await provider.getUsdPrice('BTC');
    await provider.getUsdPrice('ETH');
    await provider.getUsdPrice('BTC');
    expect(seen).toEqual(['BTC', 'ETH']);
  });
});
