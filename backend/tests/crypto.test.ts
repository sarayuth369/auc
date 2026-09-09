import { describe, expect, it } from 'vitest';
import { KNOWN_CRYPTO_SYMBOLS, resolveCryptoSymbol } from '../src/crypto';

describe('resolveCryptoSymbol', () => {
  it('recognizes symbols case-insensitively', () => {
    expect(resolveCryptoSymbol('BTC')).toBe('BTC');
    expect(resolveCryptoSymbol('btc')).toBe('BTC');
    expect(resolveCryptoSymbol('Eth')).toBe('ETH');
  });

  it('recognizes all registered symbols', () => {
    for (const symbol of KNOWN_CRYPTO_SYMBOLS) {
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
    expect(resolveCryptoSymbol('bnb')).toBe('BNB');
    expect(resolveCryptoSymbol('binance coin')).toBe('BNB');
    expect(resolveCryptoSymbol('sol')).toBe('SOL');
    expect(resolveCryptoSymbol('xrp')).toBe('XRP');
    expect(resolveCryptoSymbol('ripple')).toBe('XRP');
  });

  it('returns null for a fiat code or unrelated token', () => {
    expect(resolveCryptoSymbol('THB')).toBeNull();
    expect(resolveCryptoSymbol('kilometer')).toBeNull();
    expect(resolveCryptoSymbol('')).toBeNull();
  });
});
