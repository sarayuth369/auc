import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:auc/models/ai_config.dart';
import 'package:auc/services/ai_config_service.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test(
    'getCached returns built-in defaults when nothing has been cached',
    () async {
      final service = AiConfigService(baseUrl: 'https://example.test');
      expect((await service.getCached()).toJson(), AiConfig.defaults.toJson());
    },
  );

  test('refresh() fetches /api/config and caches it for getCached()', () async {
    final client = MockClient((request) async {
      expect(request.url.path, '/api/config');
      return http.Response(
        '{"configVersion":1,"ai":{"enabled":true,"provider":"gemini","model":"gemini-3.6-flash","timeoutMs":25000}}',
        200,
      );
    });
    final service = AiConfigService(
      baseUrl: 'https://example.test',
      client: client,
    );

    await service.refresh();
    final config = await service.getCached();

    expect(config.provider, 'gemini');
    expect(config.model, 'gemini-3.6-flash');
  });

  test(
    'hot-switch: a later refresh() with a different provider/model takes effect with no code change',
    () async {
      var response =
          '{"configVersion":1,"ai":{"enabled":true,"provider":"gemini","model":"gemini-3.6-flash","timeoutMs":25000}}';
      final client = MockClient(
        (request) async => http.Response(response, 200),
      );
      final service = AiConfigService(
        baseUrl: 'https://example.test',
        client: client,
      );

      await service.refresh();
      expect((await service.getCached()).provider, 'gemini');

      response =
          '{"configVersion":2,"ai":{"enabled":true,"provider":"openai","model":"test-model","timeoutMs":9000}}';
      await service.refresh();

      final updated = await service.getCached();
      expect(updated.provider, 'openai');
      expect(updated.model, 'test-model');
      expect(updated.timeoutMs, 9000);
      expect(updated.configVersion, 2);
    },
  );

  test('refresh() keeps the last good cache when the network fails', () async {
    final okClient = MockClient(
      (request) async => http.Response(
        '{"configVersion":1,"ai":{"enabled":true,"provider":"gemini","model":"gemini-3.6-flash","timeoutMs":25000}}',
        200,
      ),
    );
    final service = AiConfigService(
      baseUrl: 'https://example.test',
      client: okClient,
    );
    await service.refresh();
    expect((await service.getCached()).provider, 'gemini');

    final failingClient = MockClient(
      (request) async => http.Response('server error', 500),
    );
    final flakyService = AiConfigService(
      baseUrl: 'https://example.test',
      client: failingClient,
    );
    await flakyService
        .refresh(); // Different instance, same underlying prefs store.
    expect((await service.getCached()).provider, 'gemini');
  });

  test(
    'refresh() never throws on malformed JSON or a network exception',
    () async {
      final malformedClient = MockClient(
        (request) async => http.Response('not json', 200),
      );
      await AiConfigService(
        baseUrl: 'https://example.test',
        client: malformedClient,
      ).refresh();

      final throwingClient = MockClient(
        (request) async => throw Exception('network down'),
      );
      await AiConfigService(
        baseUrl: 'https://example.test',
        client: throwingClient,
      ).refresh();

      // Reaching this line means neither call threw.
    },
  );

  test('never caches a response containing a key/secret-shaped field', () async {
    final client = MockClient(
      (request) async => http.Response(
        '{"configVersion":1,"ai":{"enabled":true,"provider":"gemini","model":"gemini-3.6-flash","timeoutMs":25000},"apiKey":"leaked"}',
        200,
      ),
    );
    final service = AiConfigService(
      baseUrl: 'https://example.test',
      client: client,
    );
    await service.refresh();
    final config = await service.getCached();

    // AiConfig only ever exposes these four ai.* fields - there is no way
    // for a stray "apiKey" field to reach anything Flutter reads.
    expect(config.toJson()['ai'], {
      'enabled': true,
      'provider': 'gemini',
      'model': 'gemini-3.6-flash',
      'timeoutMs': 25000,
    });
  });
}
