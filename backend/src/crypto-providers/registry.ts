import { BinanceProvider } from './binance-provider';
import { CoinbaseProvider } from './coinbase-provider';
import { CoinGeckoProvider } from './coingecko-provider';
import { KrakenProvider } from './kraken-provider';
import type { CryptoMarketProvider } from './types';

/**
 * Provider priority order (see final report for why): Coinbase first
 * (broadest pair coverage including direct crypto-crypto markets), then
 * Kraken, then Binance, then CoinGecko as a fourth fallback (the original
 * sole provider, kept rather than discarded). CryptoPriceGateway tries them
 * in this order and stops at the first success - it never calls all of
 * them on every request.
 */
export function defaultCryptoProviders(): CryptoMarketProvider[] {
  return [new CoinbaseProvider(), new KrakenProvider(), new BinanceProvider(), new CoinGeckoProvider()];
}
