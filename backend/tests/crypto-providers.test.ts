import { describe, expect, it } from 'vitest';
import { BinanceProvider } from '../src/crypto-providers/binance-provider';
import { CoinbaseProvider } from '../src/crypto-providers/coinbase-provider';
import { CoinGeckoProvider } from '../src/crypto-providers/coingecko-provider';
import { KrakenProvider } from '../src/crypto-providers/kraken-provider';
import {
  ProviderInvalidResponseError,
  ProviderRateLimitedError,
  ProviderServerError,
  ProviderTimeoutError,
  ProviderUnsupportedPairError,
} from '../src/crypto-providers/types';

function abortingFetch(): typeof fetch {
  return (async (_url: string, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  }) as unknown as typeof fetch;
}

describe('CoinbaseProvider', () => {
  const provider = new CoinbaseProvider();

  it('fetches a spot price', async () => {
    const fetchImpl = (async (url: string) => {
      expect(url).toBe('https://api.coinbase.com/v2/prices/BTC-USD/spot');
      return new Response(JSON.stringify({ data: { base: 'BTC', currency: 'USD', amount: '65000.12' } }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    expect(await provider.getPrice('BTC', 'USD', 5000, fetchImpl)).toEqual({ price: 65000.12 });
  });

  it('throws ProviderUnsupportedPairError on 404 (no market for the pair)', async () => {
    const fetchImpl = (async () => new Response('not found', { status: 404 })) as unknown as typeof fetch;
    await expect(provider.getPrice('XYZ', 'USD', 5000, fetchImpl)).rejects.toBeInstanceOf(ProviderUnsupportedPairError);
  });

  it('throws ProviderRateLimitedError on 429', async () => {
    const fetchImpl = (async () => new Response('rate limited', { status: 429 })) as unknown as typeof fetch;
    await expect(provider.getPrice('BTC', 'USD', 5000, fetchImpl)).rejects.toBeInstanceOf(ProviderRateLimitedError);
  });

  it('throws ProviderServerError on 5xx', async () => {
    const fetchImpl = (async () => new Response('down', { status: 503 })) as unknown as typeof fetch;
    await expect(provider.getPrice('BTC', 'USD', 5000, fetchImpl)).rejects.toBeInstanceOf(ProviderServerError);
  });

  it('throws ProviderTimeoutError when aborted', async () => {
    await expect(provider.getPrice('BTC', 'USD', 10, abortingFetch())).rejects.toBeInstanceOf(ProviderTimeoutError);
  });

  it('throws ProviderInvalidResponseError on malformed JSON', async () => {
    const fetchImpl = (async () => new Response('not json {', { status: 200 })) as unknown as typeof fetch;
    await expect(provider.getPrice('BTC', 'USD', 5000, fetchImpl)).rejects.toBeInstanceOf(ProviderInvalidResponseError);
  });

  it('throws ProviderInvalidResponseError on a non-numeric or non-positive amount', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ data: { amount: 'not-a-number' } }), { status: 200 })) as unknown as typeof fetch;
    await expect(provider.getPrice('BTC', 'USD', 5000, fetchImpl)).rejects.toBeInstanceOf(ProviderInvalidResponseError);
  });
});

describe('KrakenProvider', () => {
  const provider = new KrakenProvider();

  it('fetches a ticker price, translating BTC -> XBT internally', async () => {
    const fetchImpl = (async (url: string) => {
      expect(url).toContain('pair=XBTUSD');
      return new Response(JSON.stringify({ error: [], result: { XXBTZUSD: { c: ['65000.5', '0.1'] } } }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    expect(await provider.getPrice('BTC', 'USD', 5000, fetchImpl)).toEqual({ price: 65000.5 });
  });

  it('declares BNB unsupported (Kraken has no BNB market)', () => {
    expect(provider.supportsPair('BNB', 'USD')).toBe(false);
    expect(provider.supportsPair('BTC', 'USD')).toBe(true);
  });

  it('throws ProviderUnsupportedPairError when Kraken reports an unknown pair (HTTP 200 + error array)', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: ['EQuery:Unknown asset pair'], result: {} }), {
        status: 200,
      })) as unknown as typeof fetch;
    await expect(provider.getPrice('ETH', 'XRP', 5000, fetchImpl)).rejects.toBeInstanceOf(ProviderUnsupportedPairError);
  });

  it('throws ProviderRateLimitedError on 429', async () => {
    const fetchImpl = (async () => new Response('rate limited', { status: 429 })) as unknown as typeof fetch;
    await expect(provider.getPrice('BTC', 'USD', 5000, fetchImpl)).rejects.toBeInstanceOf(ProviderRateLimitedError);
  });

  it('throws ProviderTimeoutError when aborted', async () => {
    await expect(provider.getPrice('BTC', 'USD', 10, abortingFetch())).rejects.toBeInstanceOf(ProviderTimeoutError);
  });

  it('throws ProviderInvalidResponseError on malformed JSON', async () => {
    const fetchImpl = (async () => new Response('not json {', { status: 200 })) as unknown as typeof fetch;
    await expect(provider.getPrice('BTC', 'USD', 5000, fetchImpl)).rejects.toBeInstanceOf(ProviderInvalidResponseError);
  });
});

describe('BinanceProvider', () => {
  const provider = new BinanceProvider();

  it('fetches a ticker price, substituting USDT for a USD quote request', async () => {
    const fetchImpl = (async (url: string) => {
      expect(url).toContain('symbol=BTCUSDT');
      return new Response(JSON.stringify({ symbol: 'BTCUSDT', price: '65000.00000000' }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await provider.getPrice('BTC', 'USD', 5000, fetchImpl)).toEqual({ price: 65000 });
  });

  it('fetches a direct crypto-crypto pair (e.g. ETHBTC)', async () => {
    const fetchImpl = (async (url: string) => {
      expect(url).toContain('symbol=ETHBTC');
      return new Response(JSON.stringify({ symbol: 'ETHBTC', price: '0.05' }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await provider.getPrice('ETH', 'BTC', 5000, fetchImpl)).toEqual({ price: 0.05 });
  });

  it('treats 418 (Binance auto-ban) the same as 429', async () => {
    const fetchImpl = (async () => new Response('banned', { status: 418 })) as unknown as typeof fetch;
    await expect(provider.getPrice('BTC', 'USD', 5000, fetchImpl)).rejects.toBeInstanceOf(ProviderRateLimitedError);
  });

  it('throws ProviderUnsupportedPairError on 400 (invalid symbol)', async () => {
    const fetchImpl = (async () => new Response('{"code":-1121,"msg":"Invalid symbol."}', { status: 400 })) as unknown as typeof fetch;
    await expect(provider.getPrice('XYZ', 'USD', 5000, fetchImpl)).rejects.toBeInstanceOf(ProviderUnsupportedPairError);
  });

  it('throws ProviderTimeoutError when aborted', async () => {
    await expect(provider.getPrice('BTC', 'USD', 10, abortingFetch())).rejects.toBeInstanceOf(ProviderTimeoutError);
  });

  it('throws ProviderInvalidResponseError on malformed JSON', async () => {
    const fetchImpl = (async () => new Response('not json {', { status: 200 })) as unknown as typeof fetch;
    await expect(provider.getPrice('BTC', 'USD', 5000, fetchImpl)).rejects.toBeInstanceOf(ProviderInvalidResponseError);
  });
});

describe('CoinGeckoProvider (fourth fallback)', () => {
  const provider = new CoinGeckoProvider();

  it('only supports USD-quoted known symbols', () => {
    expect(provider.supportsPair('BTC', 'USD')).toBe(true);
    expect(provider.supportsPair('BTC', 'EUR')).toBe(false);
    expect(provider.supportsPair('UNKNOWNCOIN', 'USD')).toBe(false);
  });

  it('fetches a USD price', async () => {
    const fetchImpl = (async (url: string) => {
      expect(url).toContain('ids=bitcoin');
      return new Response(JSON.stringify({ bitcoin: { usd: 65000.12 } }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await provider.getPrice('BTC', 'USD', 5000, fetchImpl)).toEqual({ price: 65000.12 });
  });

  it('throws ProviderRateLimitedError on 429', async () => {
    const fetchImpl = (async () => new Response('rate limited', { status: 429 })) as unknown as typeof fetch;
    await expect(provider.getPrice('BTC', 'USD', 5000, fetchImpl)).rejects.toBeInstanceOf(ProviderRateLimitedError);
  });

  it('throws ProviderInvalidResponseError when the response has no price for the asset', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    await expect(provider.getPrice('BTC', 'USD', 5000, fetchImpl)).rejects.toBeInstanceOf(ProviderInvalidResponseError);
  });
});
