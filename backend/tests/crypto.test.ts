import { describe, expect, it, vi } from 'vitest';
import {
  CachingCryptoPriceProvider,
  CoinGeckoPriceProvider,
  CryptoPriceUnavailableError,
  resolveCryptoSymbol,
  type CryptoPrice,
  type CryptoPriceProvider,
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
  it('fetches a single USD price, never stale (fresh from the provider)', async () => {
    const fetchImpl = (async (url: string) => {
      expect(url).toContain('ids=bitcoin');
      expect(url).toContain('vs_currencies=usd');
      return new Response(JSON.stringify({ bitcoin: { usd: 65000.12 } }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new CoinGeckoPriceProvider(fetchImpl);
    expect(await provider.getUsdPrice('BTC')).toEqual({ price: 65000.12, stale: false });
  });

  it('fetches multiple prices in a single request (batching)', async () => {
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
    expect(prices).toEqual({ BTC: { price: 65000, stale: false }, ETH: { price: 3500, stale: false } });
    expect(callCount).toBe(1);
  });

  it('sends an explicit User-Agent/Accept (CoinGecko 403s a bare Workers fetch)', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers['User-Agent']).toBeTruthy();
      expect(headers['Accept']).toBe('application/json');
      return new Response(JSON.stringify({ bitcoin: { usd: 1 } }), { status: 200 });
    });
    const provider = new CoinGeckoPriceProvider(fetchImpl as unknown as typeof fetch);
    await provider.getUsdPrice('BTC');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws CryptoPriceUnavailableError on a non-200/non-429 response, never a fabricated price', async () => {
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

  it('aborts and throws CryptoPriceUnavailableError on a provider timeout, without waiting for the full request timeout budget', async () => {
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    }) as unknown as typeof fetch;
    const provider = new CoinGeckoPriceProvider(fetchImpl, 10); // 10ms timeout for a fast test
    await expect(provider.getUsdPrice('BTC')).rejects.toBeInstanceOf(CryptoPriceUnavailableError);
  });

  it('retries once on 429 with a short Retry-After, then succeeds', async () => {
    let attempt = 0;
    const fetchImpl = (async () => {
      attempt++;
      if (attempt === 1) {
        return new Response('rate limited', { status: 429, headers: { 'Retry-After': '0' } });
      }
      return new Response(JSON.stringify({ bitcoin: { usd: 65000 } }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new CoinGeckoPriceProvider(fetchImpl);
    const result = await provider.getUsdPrice('BTC');
    expect(result).toEqual({ price: 65000, stale: false });
    expect(attempt).toBe(2); // exactly one retry, not a retry storm
  });

  it('does not retry more than once on repeated 429s - fails cleanly', async () => {
    let attempt = 0;
    const fetchImpl = (async () => {
      attempt++;
      return new Response('rate limited', { status: 429 });
    }) as unknown as typeof fetch;
    const provider = new CoinGeckoPriceProvider(fetchImpl);
    await expect(provider.getUsdPrice('BTC')).rejects.toBeInstanceOf(CryptoPriceUnavailableError);
    expect(attempt).toBe(2); // initial attempt + exactly one retry, never more
  });
});

/** Builds a fake inner CryptoPriceProvider from a symbol->price map, tracking call count/args. */
function fakeInner(prices: Record<string, number>, onCall?: (symbols: string[]) => void) {
  const getUsdPrices = vi.fn(async (symbols: string[]) => {
    onCall?.(symbols);
    const result: Record<string, CryptoPrice> = {};
    for (const symbol of symbols) {
      if (prices[symbol] !== undefined) result[symbol] = { price: prices[symbol], stale: false };
    }
    return result;
  });
  const provider: CryptoPriceProvider = {
    getUsdPrices,
    getUsdPrice: async (symbol: string) => {
      const result = await getUsdPrices([symbol]);
      const price = result[symbol];
      if (!price) throw new CryptoPriceUnavailableError(`no price for ${symbol}`);
      return price;
    },
  };
  return { provider, getUsdPrices };
}

describe('CachingCryptoPriceProvider', () => {
  it('only calls the inner provider once per symbol within the fresh TTL', async () => {
    const { provider, getUsdPrices } = fakeInner({ BTC: 65000 });
    let now = 1_000_000;
    const cache = new CachingCryptoPriceProvider(provider, 60_000, 5 * 60_000, () => now);

    expect(await cache.getUsdPrice('BTC')).toEqual({ price: 65000, stale: false });
    expect(await cache.getUsdPrice('BTC')).toEqual({ price: 65000, stale: false });
    expect(getUsdPrices).toHaveBeenCalledTimes(1);

    now += 61_000; // past fresh TTL
    expect(await cache.getUsdPrice('BTC')).toEqual({ price: 65000, stale: false });
    expect(getUsdPrices).toHaveBeenCalledTimes(2);
  });

  it('caches each symbol independently', async () => {
    const { provider, getUsdPrices } = fakeInner({ BTC: 65000, ETH: 3250 });
    const cache = new CachingCryptoPriceProvider(provider);
    await cache.getUsdPrice('BTC');
    await cache.getUsdPrice('ETH');
    await cache.getUsdPrice('BTC');
    expect(getUsdPrices).toHaveBeenCalledTimes(2);
  });

  it('batches a multi-symbol request (e.g. crypto->crypto) into ONE inner call, not one per symbol', async () => {
    const calls: string[][] = [];
    const { provider } = fakeInner({ BTC: 65000, ETH: 3250 }, (symbols) => calls.push(symbols));
    const cache = new CachingCryptoPriceProvider(provider);

    const prices = await cache.getUsdPrices(['ETH', 'BTC']);
    expect(prices).toEqual({ ETH: { price: 3250, stale: false }, BTC: { price: 65000, stale: false } });
    expect(calls).toHaveLength(1);
    expect(calls[0].sort()).toEqual(['BTC', 'ETH']);
  });

  it('request coalescing: 10 simultaneous requests for the same symbol trigger exactly one inner call', async () => {
    let resolveInner!: (v: Record<string, CryptoPrice>) => void;
    const getUsdPrices = vi.fn(
      (_symbols: string[]) => new Promise<Record<string, CryptoPrice>>((resolve) => (resolveInner = resolve)),
    );
    const provider: CryptoPriceProvider = {
      getUsdPrices,
      getUsdPrice: async (symbol) => (await getUsdPrices([symbol]))[symbol]!,
    };
    const cache = new CachingCryptoPriceProvider(provider);

    const requests = Array.from({ length: 10 }, () => cache.getUsdPrice('XRP'));
    expect(getUsdPrices).toHaveBeenCalledTimes(1); // synchronously coalesced before the inner promise even resolves

    resolveInner({ XRP: { price: 0.5, stale: false } });
    const results = await Promise.all(requests);
    expect(results.every((r) => r.price === 0.5)).toBe(true);
    expect(getUsdPrices).toHaveBeenCalledTimes(1);
  });

  it('cleans up the in-flight entry even when the inner call throws, so a later request can retry', async () => {
    let shouldFail = true;
    const getUsdPrices = vi.fn(async (_symbols: string[]): Promise<Record<string, CryptoPrice>> => {
      if (shouldFail) throw new CryptoPriceUnavailableError('down');
      return { XRP: { price: 0.5, stale: false } };
    });
    const provider: CryptoPriceProvider = {
      getUsdPrices,
      getUsdPrice: async (symbol) => (await getUsdPrices([symbol]))[symbol]!,
    };
    const cache = new CachingCryptoPriceProvider(provider);

    await expect(cache.getUsdPrice('XRP')).rejects.toBeInstanceOf(CryptoPriceUnavailableError);
    shouldFail = false;
    expect(await cache.getUsdPrice('XRP')).toEqual({ price: 0.5, stale: false });
    expect(getUsdPrices).toHaveBeenCalledTimes(2);
  });

  it('stale fallback: an expired-but-recent cached price is served (flagged stale) when the provider fails', async () => {
    let now = 1_000_000;
    let providerUp = true;
    const getUsdPrices = vi.fn(async (_symbols: string[]): Promise<Record<string, CryptoPrice>> => {
      if (!providerUp) throw new CryptoPriceUnavailableError('rate limited');
      return { XRP: { price: 0.5, stale: false } };
    });
    const provider: CryptoPriceProvider = {
      getUsdPrices,
      getUsdPrice: async (symbol) => (await getUsdPrices([symbol]))[symbol]!,
    };
    const cache = new CachingCryptoPriceProvider(provider, 60_000, 5 * 60_000, () => now);

    expect(await cache.getUsdPrice('XRP')).toEqual({ price: 0.5, stale: false });

    now += 90_000; // past fresh TTL, within stale window
    providerUp = false;
    expect(await cache.getUsdPrice('XRP')).toEqual({ price: 0.5, stale: true });
  });

  it('never serves a price older than the stale TTL - clean failure instead of ancient data', async () => {
    let now = 1_000_000;
    let providerUp = true;
    const getUsdPrices = vi.fn(async (_symbols: string[]): Promise<Record<string, CryptoPrice>> => {
      if (!providerUp) throw new CryptoPriceUnavailableError('down');
      return { XRP: { price: 0.5, stale: false } };
    });
    const provider: CryptoPriceProvider = {
      getUsdPrices,
      getUsdPrice: async (symbol) => (await getUsdPrices([symbol]))[symbol]!,
    };
    const cache = new CachingCryptoPriceProvider(provider, 60_000, 5 * 60_000, () => now);

    await cache.getUsdPrice('XRP');
    now += 6 * 60_000; // past the stale window entirely
    providerUp = false;
    await expect(cache.getUsdPrice('XRP')).rejects.toBeInstanceOf(CryptoPriceUnavailableError);
  });

  it('with no cache at all and a failing provider, fails cleanly - never a fabricated price', async () => {
    const provider: CryptoPriceProvider = {
      getUsdPrices: async () => {
        throw new CryptoPriceUnavailableError('down');
      },
      getUsdPrice: async () => {
        throw new CryptoPriceUnavailableError('down');
      },
    };
    const cache = new CachingCryptoPriceProvider(provider);
    await expect(cache.getUsdPrice('XRP')).rejects.toBeInstanceOf(CryptoPriceUnavailableError);
  });

  it('repeated identical conversions never cause a provider storm', async () => {
    const { provider, getUsdPrices } = fakeInner({ XRP: 0.5 });
    const cache = new CachingCryptoPriceProvider(provider);

    for (let i = 0; i < 5; i++) {
      expect(await cache.getUsdPrice('XRP')).toEqual({ price: 0.5, stale: false });
    }
    expect(getUsdPrices).toHaveBeenCalledTimes(1);
  });
});
