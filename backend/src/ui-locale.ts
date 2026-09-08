/**
 * Curated UI localization for the Home screen's convert-placeholder text.
 * Mirrors Flutter's own curated table (lib/l10n/home_placeholder.dart)
 * exactly, so both sides agree independent of which one actually renders
 * the text. Deliberately a small, hand-picked baseline (not a translation
 * framework, not AI-generated at request time) - see README/report for why
 * on-demand AI translation was intentionally left out of this hot,
 * frequently-polled endpoint.
 */
export const PLACEHOLDER_BY_LANGUAGE: Record<string, string> = {
  en: 'What do you want to convert?',
  th: 'คุณต้องการแปลงอะไร?',
  zh: '您想转换什么？',
  ja: '何を変換しますか？',
  ko: '무엇을 변환하시겠습니까?',
  es: '¿Qué quieres convertir?',
  de: 'Was möchten Sie umrechnen?',
  fr: 'Que voulez-vous convertir ?',
  ru: 'Что вы хотите преобразовать?',
  id: 'Apa yang ingin Anda konversi?',
  vi: 'Bạn muốn chuyển đổi gì?',
  hi: 'आप क्या बदलना चाहते हैं?',
};

// Small, curated country -> language map (not exhaustive - only the
// countries where a request is unambiguously one of the curated languages
// above). Unmapped countries fall back to English; this is a secondary
// signal only, since Flutter's own device-locale match is checked first and
// covers the same 12 languages regardless of network/country.
const LANGUAGE_BY_COUNTRY: Record<string, string> = {
  TH: 'th',
  CN: 'zh', TW: 'zh', HK: 'zh', SG: 'zh',
  JP: 'ja',
  KR: 'ko',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es',
  DE: 'de', AT: 'de', CH: 'de',
  FR: 'fr', BE: 'fr',
  RU: 'ru', BY: 'ru', KZ: 'ru',
  ID: 'id',
  VN: 'vi',
  IN: 'hi',
};

/** Bump when PLACEHOLDER_BY_LANGUAGE's text changes, so cached clients know to refresh. */
export const TRANSLATION_VERSION = 1;

export interface UiConfig {
  language: string;
  country: string | null;
  placeholder: string;
  translationVersion: number;
}

/**
 * Resolves the UI block for `/api/config`. `country` is Cloudflare's own
 * request.cf.country (a two-letter code, or undefined outside the edge
 * network e.g. local dev) - never a raw IP, never logged, never sent to AI.
 */
export function resolveUiConfig(country: string | undefined | null): UiConfig {
  const normalizedCountry = country?.trim().toUpperCase() || null;
  const language = (normalizedCountry && LANGUAGE_BY_COUNTRY[normalizedCountry]) || 'en';
  return {
    language,
    country: normalizedCountry,
    placeholder: PLACEHOLDER_BY_LANGUAGE[language] ?? PLACEHOLDER_BY_LANGUAGE.en,
    translationVersion: TRANSLATION_VERSION,
  };
}
