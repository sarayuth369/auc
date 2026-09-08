import 'dart:ui' show Locale;

/// Curated Home-screen convert-placeholder translations. Mirrors the
/// backend's own table (backend/src/ui-locale.ts) exactly, so both sides
/// agree independent of which one actually renders the text.
///
/// This is deliberately a small, hand-picked baseline - not a general
/// localization framework. Anything outside this set falls back to English;
/// the Worker's `/api/config` `ui` block may offer a better match for a few
/// more countries, cached locally (see [AiConfigService.getCachedUi]) and
/// used from the next app launch onward - never blocking this one.
/// Widget-default fallback (English) - used only when a caller (e.g. an
/// existing widget test) constructs [HomeScreen] without an explicit
/// placeholder, so behavior for anyone not opting into locale detection is
/// unchanged.
const String kDefaultConvertPlaceholder = 'What do you want to convert?';

const Map<String, String> kCuratedHomePlaceholders = {
  'en': 'What do you want to convert?',
  'th': 'คุณต้องการแปลงอะไร?',
  'zh': '您想转换什么？',
  'ja': '何を変換しますか？',
  'ko': '무엇을 변환하시겠습니까?',
  'es': '¿Qué quieres convertir?',
  'de': 'Was möchten Sie umrechnen?',
  'fr': 'Que voulez-vous convertir ?',
  'ru': 'Что вы хотите преобразовать?',
  'id': 'Apa yang ingin Anda konversi?',
  'vi': 'Bạn muốn chuyển đổi gì?',
  'hi': 'आप क्या बदलना चाहते हैं?',
};

/// Resolves the Home placeholder for [locale]'s language, falling back to
/// English. Pure/synchronous - safe to call before the first frame with no
/// network or storage access, so Home never waits on anything for this.
String curatedHomePlaceholderFor(Locale locale) {
  return kCuratedHomePlaceholders[locale.languageCode] ?? kCuratedHomePlaceholders['en']!;
}
