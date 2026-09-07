import 'package:flutter_test/flutter_test.dart';

import 'package:auc/models/ai_config.dart';

void main() {
  test('defaults are safe and match the backend defaults', () {
    expect(AiConfig.defaults.enabled, true);
    expect(AiConfig.defaults.provider, 'gemini');
    expect(AiConfig.defaults.model, 'gemini-3.6-flash');
    expect(AiConfig.defaults.timeoutMs, 25000);
  });

  test('fromJson parses a well-formed /api/config response', () {
    final config = AiConfig.fromJson({
      'configVersion': 3,
      'ai': {
        'enabled': true,
        'provider': 'openai',
        'model': 'test-model',
        'timeoutMs': 9000,
      },
    });
    expect(config.configVersion, 3);
    expect(config.enabled, true);
    expect(config.provider, 'openai');
    expect(config.model, 'test-model');
    expect(config.timeoutMs, 9000);
    expect(config.timeout, const Duration(milliseconds: 9000));
  });

  test('fromJson falls back to defaults when "ai" is missing or malformed', () {
    expect(AiConfig.fromJson({}).provider, AiConfig.defaults.provider);
    expect(
      AiConfig.fromJson({'ai': 'not a map'}).provider,
      AiConfig.defaults.provider,
    );
  });

  test(
    'fromJson falls back per-field when individual fields are the wrong type',
    () {
      final config = AiConfig.fromJson({
        'ai': {
          'enabled': 'yes',
          'provider': 123,
          'model': null,
          'timeoutMs': 'soon',
        },
      });
      expect(config.enabled, AiConfig.defaults.enabled);
      expect(config.provider, AiConfig.defaults.provider);
      expect(config.model, AiConfig.defaults.model);
      expect(config.timeoutMs, AiConfig.defaults.timeoutMs);
    },
  );

  test('toJson/fromJson round-trips', () {
    const config = AiConfig(
      enabled: false,
      provider: 'anthropic',
      model: 'claude-test',
      timeoutMs: 15000,
      configVersion: 2,
    );
    expect(AiConfig.fromJson(config.toJson()).toJson(), config.toJson());
  });
}
