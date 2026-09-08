import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';

import 'package:auc/l10n/home_placeholder.dart';

void main() {
  group('curatedHomePlaceholderFor', () {
    const cases = <String, String>{
      'th': 'คุณต้องการแปลงอะไร?',
      'en': 'What do you want to convert?',
      'ja': '何を変換しますか？',
      'ko': '무엇을 변환하시겠습니까?',
      'zh': '您想转换什么？',
      'de': 'Was möchten Sie umrechnen?',
      'es': '¿Qué quieres convertir?',
      'fr': 'Que voulez-vous convertir ?',
      'ru': 'Что вы хотите преобразовать?',
      'id': 'Apa yang ingin Anda konversi?',
      'vi': 'Bạn muốn chuyển đổi gì?',
      'hi': 'आप क्या बदलना चाहते हैं?',
    };

    // th-TH, en-US, ja-JP, ko-KR, zh-CN, de-DE, es-ES, fr-FR, ru-RU, id-ID,
    // vi-VN, hi-IN - full locale tags, only the language subtag matters.
    const countryByLanguage = <String, String>{
      'th': 'TH', 'en': 'US', 'ja': 'JP', 'ko': 'KR', 'zh': 'CN', 'de': 'DE',
      'es': 'ES', 'fr': 'FR', 'ru': 'RU', 'id': 'ID', 'vi': 'VN', 'hi': 'IN',
    };

    for (final entry in cases.entries) {
      test('${entry.key}-${countryByLanguage[entry.key]} -> curated ${entry.key} placeholder', () {
        final locale = Locale(entry.key, countryByLanguage[entry.key]);
        expect(curatedHomePlaceholderFor(locale), entry.value);
      });
    }

    test('an unsupported language falls back to English', () {
      expect(curatedHomePlaceholderFor(const Locale('tlh')), kCuratedHomePlaceholders['en']);
    });
  });
}
