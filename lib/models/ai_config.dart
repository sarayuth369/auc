/// Public, non-secret AI runtime configuration served by the backend's
/// `GET /api/config`. Flutter never chooses a provider/model itself and
/// never sees an API key - the Worker picks the provider/model server-side;
/// this is only used to size the client-side timeout and to know whether
/// AI assistance is currently enabled at all.
class AiConfig {
  final bool enabled;
  final String provider;
  final String model;
  final int timeoutMs;
  final int configVersion;

  const AiConfig({
    required this.enabled,
    required this.provider,
    required this.model,
    required this.timeoutMs,
    required this.configVersion,
  });

  Duration get timeout => Duration(milliseconds: timeoutMs);

  /// Safe built-in fallback used before the first successful fetch, or if
  /// the backend is unreachable and nothing is cached yet.
  static const AiConfig defaults = AiConfig(
    enabled: true,
    provider: 'gemini',
    model: 'gemini-3.6-flash',
    timeoutMs: 25000,
    configVersion: 0,
  );

  factory AiConfig.fromJson(Map<String, dynamic> json) {
    final ai = json['ai'];
    if (ai is! Map<String, dynamic>) return defaults;
    final timeoutMs = ai['timeoutMs'];
    return AiConfig(
      enabled: ai['enabled'] is bool ? ai['enabled'] as bool : defaults.enabled,
      provider: ai['provider'] is String
          ? ai['provider'] as String
          : defaults.provider,
      model: ai['model'] is String ? ai['model'] as String : defaults.model,
      timeoutMs: timeoutMs is num && timeoutMs > 0
          ? timeoutMs.toInt()
          : defaults.timeoutMs,
      configVersion: json['configVersion'] is num
          ? (json['configVersion'] as num).toInt()
          : defaults.configVersion,
    );
  }

  Map<String, dynamic> toJson() => {
    'configVersion': configVersion,
    'ai': {
      'enabled': enabled,
      'provider': provider,
      'model': model,
      'timeoutMs': timeoutMs,
    },
  };
}
