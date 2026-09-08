import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_BY_LANGUAGE, resolveUiConfig } from '../src/ui-locale';

const REQUIRED_LANGUAGES = ['en', 'th', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'ru', 'id', 'vi', 'hi'];

describe('PLACEHOLDER_BY_LANGUAGE', () => {
  it('has a curated translation for every required baseline language', () => {
    for (const lang of REQUIRED_LANGUAGES) {
      expect(PLACEHOLDER_BY_LANGUAGE[lang]).toBeTruthy();
    }
  });
});

describe('resolveUiConfig', () => {
  it('returns English with a null country when no country is given', () => {
    expect(resolveUiConfig(undefined)).toEqual({
      language: 'en',
      country: null,
      placeholder: PLACEHOLDER_BY_LANGUAGE.en,
      translationVersion: 1,
    });
  });

  it('maps a known country to its curated language', () => {
    expect(resolveUiConfig('TH')).toMatchObject({ language: 'th', country: 'TH' });
    expect(resolveUiConfig('VN')).toMatchObject({ language: 'vi', country: 'VN' });
    expect(resolveUiConfig('IN')).toMatchObject({ language: 'hi', country: 'IN' });
    expect(resolveUiConfig('ID')).toMatchObject({ language: 'id', country: 'ID' });
  });

  it('falls back to English for an unmapped country instead of guessing', () => {
    expect(resolveUiConfig('ZZ')).toMatchObject({ language: 'en', country: 'ZZ' });
  });

  it('is case-insensitive and trims the country code', () => {
    expect(resolveUiConfig(' th ')).toMatchObject({ language: 'th', country: 'TH' });
  });

  it('the placeholder always matches the curated table for the resolved language', () => {
    for (const country of ['TH', 'JP', 'KR', 'CN', 'ES', 'DE', 'FR', 'RU', 'ID', 'VN', 'IN', 'ZZ']) {
      const result = resolveUiConfig(country);
      expect(result.placeholder).toBe(PLACEHOLDER_BY_LANGUAGE[result.language]);
    }
  });
});
