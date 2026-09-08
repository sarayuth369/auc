/// Public, non-secret UI localization hints served alongside `GET
/// /api/config`'s `ui` block. This is a *secondary* signal only - Flutter's
/// own device locale (see home_placeholder.dart) is always checked first
/// and covers the same baseline languages independent of network/country;
/// this exists for the few cases where the device locale isn't in the
/// curated set but the request's country still implies a supported one.
class UiConfig {
  final String language;
  final String? country;
  final String? placeholder;
  final int translationVersion;

  const UiConfig({
    required this.language,
    required this.country,
    required this.placeholder,
    required this.translationVersion,
  });

  /// Used before the first successful fetch, or if nothing is cached yet -
  /// `placeholder: null` means "no server hint available", so callers fall
  /// back to the device-locale curated table.
  static const UiConfig defaults = UiConfig(
    language: 'en',
    country: null,
    placeholder: null,
    translationVersion: 0,
  );

  factory UiConfig.fromJson(Map<String, dynamic> json) {
    final ui = json['ui'];
    if (ui is! Map<String, dynamic>) return defaults;
    return UiConfig(
      language: ui['language'] is String ? ui['language'] as String : defaults.language,
      country: ui['country'] is String ? ui['country'] as String : null,
      placeholder: ui['placeholder'] is String ? ui['placeholder'] as String : null,
      translationVersion: ui['translationVersion'] is num
          ? (ui['translationVersion'] as num).toInt()
          : defaults.translationVersion,
    );
  }
}
