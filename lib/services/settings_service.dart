import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Decimal-place options for how a result is *displayed*. This never
/// touches the conversion engine's own precision - it only reformats the
/// already-computed value for presentation (see `result_formatter.dart`).
enum DecimalPlaces { auto, two, four, six, eight }

extension DecimalPlacesX on DecimalPlaces {
  static const Map<DecimalPlaces, String> _prefsValues = {
    DecimalPlaces.auto: 'auto',
    DecimalPlaces.two: '2',
    DecimalPlaces.four: '4',
    DecimalPlaces.six: '6',
    DecimalPlaces.eight: '8',
  };

  String get label => switch (this) {
    DecimalPlaces.auto => 'Auto',
    DecimalPlaces.two => '2',
    DecimalPlaces.four => '4',
    DecimalPlaces.six => '6',
    DecimalPlaces.eight => '8',
  };

  /// Fixed digit count to format to, or null for [DecimalPlaces.auto]
  /// (meaning: keep the conversion engine's own default formatting).
  int? get fixedDigits => switch (this) {
    DecimalPlaces.auto => null,
    DecimalPlaces.two => 2,
    DecimalPlaces.four => 4,
    DecimalPlaces.six => 6,
    DecimalPlaces.eight => 8,
  };

  String get prefsValue => _prefsValues[this]!;

  static DecimalPlaces fromPrefsValue(String? raw) {
    for (final entry in _prefsValues.entries) {
      if (entry.value == raw) return entry.key;
    }
    return DecimalPlaces.auto;
  }
}

/// Local-only user preferences: appearance, result formatting, and data
/// behavior. Same shared_preferences store already used by history and
/// favorites - no new storage mechanism, no account, no sync.
class SettingsService {
  static const _keyThemeMode = 'auc_settings_theme_mode';
  static const _keyDecimalPlaces = 'auc_settings_decimal_places';
  static const _keyHapticFeedback = 'auc_settings_haptic_feedback';
  static const _keySaveHistory = 'auc_settings_save_history';

  Future<ThemeMode> getThemeMode() async {
    final prefs = await SharedPreferences.getInstance();
    return switch (prefs.getString(_keyThemeMode)) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyThemeMode, switch (mode) {
      ThemeMode.light => 'light',
      ThemeMode.dark => 'dark',
      ThemeMode.system => 'system',
    });
  }

  Future<DecimalPlaces> getDecimalPlaces() async {
    final prefs = await SharedPreferences.getInstance();
    return DecimalPlacesX.fromPrefsValue(prefs.getString(_keyDecimalPlaces));
  }

  Future<void> setDecimalPlaces(DecimalPlaces value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyDecimalPlaces, value.prefsValue);
  }

  /// Defaults to on, matching the product spec.
  Future<bool> getHapticFeedback() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyHapticFeedback) ?? true;
  }

  Future<void> setHapticFeedback(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyHapticFeedback, value);
  }

  /// Defaults to on, matching the product spec.
  Future<bool> getSaveHistory() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keySaveHistory) ?? true;
  }

  Future<void> setSaveHistory(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keySaveHistory, value);
  }
}
