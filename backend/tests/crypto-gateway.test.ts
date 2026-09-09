import { describe, expect, it, vi } from 'vitest';
import { CryptoPriceGateway } from '../src/crypto-gateway';
import { CryptoPriceUnavailableError } from '../src/crypto';
import {
  ProviderRateLimitedError,
  ProviderServerError,
  ProviderTimeoutError,
  ProviderUnsupportedPairError,
  type CryptoMarketProvider,
} from '../src/crypto-providers/types';

/** A fake provider whose behavior is driven by a queue of results/errors -
 *  lets tests script exactly what "primary fails, secondary succeeds" etc.
 *  looks like without any real network access. */
function fakeProvider(name: string, script: Array<{ price: number } | Error>): CryptoMarketProvider {
  let calls = 0;
  const getPrice = vi.fn(async () => {
    const step = script[Math.min(calls, script.length - 1)];
    calls++;
    if (step instanceof Error) throw step;
    return step;
  });
  return {
    name,
    supportsPair: () => true,
    getPrice,
  } as CryptoMarketProvider & { getPrice: typeof getPrice };
}

describe('CryptoPriceGateway', () => {
  it('base === quote short-circuits to rate 1 without calling any provider', async () => {
    const primary = fakeProvider('primary', [{ price: 999 }]);
    const gateway = new CryptoPriceGateway([primary]);
    expect(await gateway.getRate('BTC', 'BTC')).toEqual({ rate: 1, stale: false, provider: 'identity' });
    expect((primary as any).getPrice).not.toHaveBeenCalled();
  });

  it('fresh cache is served without calling the provider again', async () => {
    const primary = fakeProvider('primary', [{ price: 65000 }]);
    let now = 1_000_000;
    const gateway = new CryptoPriceGateway([primary], undefined, () => now);

    expect(await gateway.getRate('BTC', 'USD')).toEqual({ rate: 65000, stale: false, provider: 'primary' });
    expect(await gateway.getRate('BTC', 'USD')).toEqual({ rate: 65000, stale: false, provider: 'primary' });
    expect((primary as any).getPrice).toHaveBeenCalledTimes(1);

    now += 61_000; // past the 60s fresh TTL
    expect(await gateway.getRate('BTC', 'USD')).toEqual({ rate: 65000, stale: false, provider: 'primary' });
    expect((primary as any).getPrice).toHaveBeenCalledTimes(2);
  });

  it('primary fails -> secondary succeeds (failover, not an error)', async () => {
    const primary = fakeProvider('primary', [new ProviderTimeoutError('timed out')]);
    const secondary = fakeProvider('secondary', [{ price: 65000 }]);
    const gateway = new CryptoPriceGateway([primary, secondary]);
    expect(await gateway.getRate('BTC', 'USD')).toEqual({ rate: 65000, stale: false, provider: 'secondary' });
  });

  it('primary and secondary fail -> tertiary succeeds', async () => {
    const primary = fakeProvider('primary', [new ProviderServerError(500)]);
    const secondary = fakeProvider('secondary', [new ProviderRateLimitedError(0)]);
    const tertiary = fakeProvider('tertiary', [{ price: 65000 }]);
    const gateway = new CryptoPriceGateway([primary, secondary, tertiary]);
    expect(await gateway.getRate('BTC', 'USD')).toEqual({ rate: 65000, stale: false, provider: 'tertiary' });
  });

  it('all providers fail and there is no cache -> a clean CryptoPriceUnavailableError, never a fabricated price', async () => {
    const primary = fakeProvider('primary', [new ProviderTimeoutError('down')]);
    const secondary = fakeProvider('secondary', [new ProviderServerError(500)]);
    const gateway = new CryptoPriceGateway([primary, secondary]);
    await expect(gateway.getRate('BTC', 'USD')).rejects.toBeInstanceOf(CryptoPriceUnavailableError);
  });

  it('an unsupported pair (declared via supportsPair) is skipped without a network call', async () => {
    const primary: CryptoMarketProvider = {
      name: 'primary',
      supportsPair: () => false,
      getPrice: vi.fn(),
    };
    const secondary = fakeProvider('secondary', [{ price: 65000 }]);
    const gateway = new CryptoPriceGateway([primary, secondary]);
    expect(await gateway.getRate('BNB', 'USD')).toEqual({ rate: 65000, stale: false, provider: 'secondary' });
    expect(primary.getPrice).not.toHaveBeenCalled();
  });

  it('provider cooldown: a failed provider is skipped on the next call within its cooldown window, then retried after', async () => {
    let now = 1_000_000;
    const primaryScript = [new ProviderRateLimitedError(0), { price: 65000 }];
    const primary = fakeProvider('primary', primaryScript);
    const secondary = fakeProvider('secondary', [{ price: 64900 }, { price: 64900 }]);
    const gateway = new CryptoPriceGateway([primary, secondary], undefined, () => now);

    // First call: primary 429s, secondary serves it, primary goes into cooldown.
    expect(await gateway.getRate('BTC', 'USD')).toEqual({ rate: 64900, stale: false, provider: 'secondary' });
    expect((primary as any).getPrice).toHaveBeenCalledTimes(1);

    // Still within cooldown - primary must be skipped entirely.
    now += 1_000;
    expect(await gateway.getRate('ETH', 'USD')).toEqual({ rate: 64900, stale: false, provider: 'secondary' });
    expect((primary as any).getPrice).toHaveBeenCalledTimes(1); // not called again

    // Past the 60s rate-limit cooldown - primary is eligible again.
    now += 61_000;
    expect(await gateway.getRate('XRP', 'USD')).toEqual({ rate: 65000, stale: false, provider: 'primary' });
  });

  it('request coalescing: concurrent requests for the same pair share one provider call', async () => {
    let resolveInner!: (v: { price: number }) => void;
    const getPrice = vi.fn(() => new Promise<{ price: number }>((resolve) => (resolveInner = resolve)));
    const provider: CryptoMarketProvider = { name: 'primary', supportsPair: () => true, getPrice };
    const gateway = new CryptoPriceGateway([provider]);

    const requests = Array.from({ length: 10 }, () => gateway.getRate('XRP', 'USD'));
    expect(getPrice).toHaveBeenCalledTimes(1);

    resolveInner({ price: 0.5 });
    const results = await Promise.all(requests);
    expect(results.every((r) => r.rate === 0.5)).toBe(true);
    expect(getPrice).toHaveBeenCalledTimes(1);
  });

  it('stale cache fallback: an expired cached rate is served (flagged stale) when every provider fails', async () => {
    let now = 1_000_000;
    let providerUp = true;
    const getPrice = vi.fn(async () => {
      if (!providerUp) throw new ProviderTimeoutError('down');
      return { price: 65000 };
    });
    const provider: CryptoMarketProvider = { name: 'primary', supportsPair: () => true, getPrice };
    const gateway = new CryptoPriceGateway([provider], undefined, () => now);

    expect(await gateway.getRate('BTC', 'USD')).toEqual({ rate: 65000, stale: false, provider: 'primary' });

    now += 90_000; // past fresh TTL, within the 5-minute stale window
    providerUp = false;
    expect(await gateway.getRate('BTC', 'USD')).toEqual({ rate: 65000, stale: true, provider: 'primary' });
  });

  it('never serves a rate older than the stale window - clean failure instead of ancient data', async () => {
    let now = 1_000_000;
    let providerUp = true;
    const getPrice = vi.fn(async () => {
      if (!providerUp) throw new ProviderTimeoutError('down');
      return { price: 65000 };
    });
    const provider: CryptoMarketProvider = { name: 'primary', supportsPair: () => true, getPrice };
    const gateway = new CryptoPriceGateway([provider], undefined, () => now);

    await gateway.getRate('BTC', 'USD');
    now += 6 * 60_000; // past the 5-minute stale window entirely
    providerUp = false;
    await expect(gateway.getRate('BTC', 'USD')).rejects.toBeInstanceOf(CryptoPriceUnavailableError);
  });

  it('cross-rate via USD: no provider has a direct ETH/BTC market, so it computes ETH_USD / BTC_USD', async () => {
    const getPrice = vi.fn(async (base: string, quote: string) => {
      if (quote !== 'USD') throw new ProviderUnsupportedPairError('no direct pair');
      if (base === 'ETH') return { price: 3250 };
      if (base === 'BTC') return { price: 65000 };
      throw new ProviderUnsupportedPairError('unexpected');
    });
    const provider: CryptoMarketProvider = { name: 'primary', supportsPair: () => true, getPrice };
    const gateway = new CryptoPriceGateway([provider]);

    const { rate, provider: source } = await gateway.getRate('ETH', 'BTC');
    expect(rate).toBeCloseTo(3250 / 65000, 12);
    expect(source).toBe('cross-rate-usd');
  });

  it('direct pair is used when a provider actually supports it (no cross-rate needed)', async () => {
    const getPrice = vi.fn(async (base: string, quote: string) => {
      if (base === 'ETH' && quote === 'BTC') return { price: 0.05 };
      throw new ProviderUnsupportedPairError('should not be asked for anything else');
    });
    const provider: CryptoMarketProvider = { name: 'primary', supportsPair: () => true, getPrice };
    const gateway = new CryptoPriceGateway([provider]);
    expect(await gateway.getRate('ETH', 'BTC')).toEqual({ rate: 0.05, stale: false, provider: 'primary' });
  });

  it('repeated identical conversions never cause a provider storm', async () => {
    const primary = fakeProvider('primary', [{ price: 0.5 }]);
    const gateway = new CryptoPriceGateway([primary]);
    for (let i = 0; i < 5; i++) {
      expect(await gateway.getRate('XRP', 'USD')).toEqual({ rate: 0.5, stale: false, provider: 'primary' });
    }
    expect((primary as any).getPrice).toHaveBeenCalledTimes(1);
  });

  it('getProviderStats reports success/failure counts and cooldown state without secrets', async () => {
    const primary = fakeProvider('primary', [new ProviderRateLimitedError(0)]);
    const secondary = fakeProvider('secondary', [{ price: 65000 }]);
    const gateway = new CryptoPriceGateway([primary, secondary]);
    await gateway.getRate('BTC', 'USD');

    const stats = gateway.getProviderStats();
    expect(stats.primary.failure).toBe(1);
    expect(stats.primary.cooldownRemainingMs).toBeGreaterThan(0);
    expect(stats.secondary.success).toBe(1);
  });
});
