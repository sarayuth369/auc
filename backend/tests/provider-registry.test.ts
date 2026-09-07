import { describe, expect, it } from 'vitest';
import { getProvider, UnsupportedProviderError } from '../src/provider-registry';

describe('getProvider', () => {
  it('returns a provider for "gemini" (case-insensitive, trimmed)', () => {
    expect(getProvider('gemini')).toBeDefined();
    expect(getProvider('Gemini')).toBeDefined();
    expect(getProvider(' GEMINI ')).toBeDefined();
  });

  it('throws UnsupportedProviderError for an unregistered provider', () => {
    expect(() => getProvider('openai')).toThrow(UnsupportedProviderError);
    expect(() => getProvider('anthropic')).toThrow(UnsupportedProviderError);
    expect(() => getProvider('')).toThrow(UnsupportedProviderError);
  });
});
