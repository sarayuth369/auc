import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:auc/services/settings_service.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('defaults when nothing is persisted yet', () {
    test('theme mode defaults to system', () async {
      expect(await SettingsService().getThemeMode(), ThemeMode.system);
    });

    test('decimal places defaults to auto', () async {
      expect(await SettingsService().getDecimalPlaces(), DecimalPlaces.auto);
    });

    test('haptic feedback defaults to on', () async {
      expect(await SettingsService().getHapticFeedback(), true);
    });

    test('save history defaults to on', () async {
      expect(await SettingsService().getSaveHistory(), true);
    });
  });

  group('persistence round-trip', () {
    test('theme mode', () async {
      final service = SettingsService();
      await service.setThemeMode(ThemeMode.dark);
      expect(await service.getThemeMode(), ThemeMode.dark);

      await service.setThemeMode(ThemeMode.light);
      expect(await service.getThemeMode(), ThemeMode.light);

      await service.setThemeMode(ThemeMode.system);
      expect(await service.getThemeMode(), ThemeMode.system);
    });

    test('decimal places', () async {
      final service = SettingsService();
      await service.setDecimalPlaces(DecimalPlaces.six);
      expect(await service.getDecimalPlaces(), DecimalPlaces.six);
    });

    test('haptic feedback', () async {
      final service = SettingsService();
      await service.setHapticFeedback(false);
      expect(await service.getHapticFeedback(), false);
    });

    test('save history', () async {
      final service = SettingsService();
      await service.setSaveHistory(false);
      expect(await service.getSaveHistory(), false);
    });

    test(
      'a second SettingsService instance sees the same persisted values',
      () async {
        await SettingsService().setDecimalPlaces(DecimalPlaces.four);
        expect(await SettingsService().getDecimalPlaces(), DecimalPlaces.four);
      },
    );
  });

  group('DecimalPlaces labels and digits', () {
    test('auto has no fixed digit count', () {
      expect(DecimalPlaces.auto.fixedDigits, isNull);
    });

    test('fixed options expose the right digit count and label', () {
      expect(DecimalPlaces.two.fixedDigits, 2);
      expect(DecimalPlaces.two.label, '2');
      expect(DecimalPlaces.four.fixedDigits, 4);
      expect(DecimalPlaces.six.fixedDigits, 6);
      expect(DecimalPlaces.eight.fixedDigits, 8);
    });

    test('unknown persisted value falls back to auto', () {
      expect(DecimalPlacesX.fromPrefsValue('garbage'), DecimalPlaces.auto);
      expect(DecimalPlacesX.fromPrefsValue(null), DecimalPlaces.auto);
    });
  });
}
