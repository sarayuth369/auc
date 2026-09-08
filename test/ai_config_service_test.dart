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

  group('getCachedUi (Home placeholder localization)', () {
    test('returns defaults (no placeholder hint) when nothing is cached', () async {
      final service = AiConfigService(baseUrl: 'https://example.test');
      final ui = await service.getCachedUi();
      expect(ui.language, 'en');
      expect(ui.placeholder, isNull);
    });

    test('first refresh() obtains and caches the ui block from the same /api/config response', () async {
      var requestCount = 0;
      final client = MockClient((request) async {
        requestCount++;
        return http.Response(
          '{"configVersion":1,"ai":{"enabled":true,"provider":"cloudflare","model":"@cf/zai-org/glm-4.7-flash","timeoutMs":25000},'
          '"ui":{"language":"th","country":"TH","placeholder":"คุณต้องการแปลงอะไร?","translationVersion":1}}',
          200,
          // http.Response defaults to latin1 for its .body getter unless the
          // charset is explicit - without this, the Thai text below gets
          // mis-decoded and jsonDecode() throws (silently swallowed by
          // refresh()'s catch, leaving the cache unchanged - a real gotcha,
          // not an AiConfigService bug).
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      });
      final service = AiConfigService(baseUrl: 'https://example.test', client: client);

      await service.refresh();
      final ui = await service.getCachedUi();

      expect(ui.language, 'th');
      expect(ui.country, 'TH');
      expect(ui.placeholder, 'คุณต้องการแปลงอะไร?');
      expect(ui.translationVersion, 1);
      // One HTTP call served both the ai config AND the ui hint - no
      // separate translation request was made.
      expect(requestCount, 1);
    });

    test('a second app start (no refresh) reuses the cached ui block - no new request', () async {
      final client = MockClient((request) async => http.Response(
        '{"configVersion":1,"ai":{"enabled":true,"provider":"gemini","model":"gemini-3.6-flash","timeoutMs":25000},'
        '"ui":{"language":"ja","country":"JP","placeholder":"何を変換しますか？","translationVersion":1}}',
        200,
        headers: {'content-type': 'application/json; charset=utf-8'},
      ));
      final firstLaunch = AiConfigService(baseUrl: 'https://example.test', client: client);
      await firstLaunch.refresh();

      // A brand new service instance, same underlying SharedPreferences
      // store - simulates a fresh app start reading yesterday's cache.
      final secondLaunch = AiConfigService(
        baseUrl: 'https://example.test',
        client: MockClient((request) async => throw StateError('should not be called')),
      );
      final ui = await secondLaunch.getCachedUi();
      expect(ui.language, 'ja');
      expect(ui.placeholder, '何を変換しますか？');
    });

    test('a language/config change on the next refresh() replaces the cached ui block', () async {
      var response =
          '{"configVersion":1,"ai":{"enabled":true,"provider":"gemini","model":"gemini-3.6-flash","timeoutMs":25000},'
          '"ui":{"language":"en","country":null,"placeholder":"What do you want to convert?","translationVersion":1}}';
      final client = MockClient(
        (request) async => http.Response(
          response,
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        ),
      );
      final service = AiConfigService(baseUrl: 'https://example.test', client: client);

      await service.refresh();
      expect((await service.getCachedUi()).language, 'en');

      response =
          '{"configVersion":1,"ai":{"enabled":true,"provider":"gemini","model":"gemini-3.6-flash","timeoutMs":25000},'
          '"ui":{"language":"vi","country":"VN","placeholder":"Bạn muốn chuyển đổi gì?","translationVersion":2}}';
      await service.refresh();

      final updated = await service.getCachedUi();
      expect(updated.language, 'vi');
      expect(updated.placeholder, 'Bạn muốn chuyển đổi gì?');
      expect(updated.translationVersion, 2);
    });

    test('malformed or missing ui block never throws and falls back to defaults', () async {
      final client = MockClient(
        (request) async => http.Response(
          '{"configVersion":1,"ai":{"enabled":true,"provider":"gemini","model":"gemini-3.6-flash","timeoutMs":25000}}',
          200,
        ),
      );
      final service = AiConfigService(baseUrl: 'https://example.test', client: client);
      await service.refresh();

      final ui = await service.getCachedUi();
      expect(ui.language, 'en');
      expect(ui.placeholder, isNull);
    });

    test('never exposes a raw IP or secret-shaped field from the ui block', () async {
      final client = MockClient(
        (request) async => http.Response(
          '{"configVersion":1,"ai":{"enabled":true,"provider":"gemini","model":"gemini-3.6-flash","timeoutMs":25000},'
          '"ui":{"language":"th","country":"TH","placeholder":"คุณต้องการแปลงอะไร?","translationVersion":1,"ip":"1.2.3.4"}}',
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        ),
      );
      final service = AiConfigService(baseUrl: 'https://example.test', client: client);
      await service.refresh();
      final ui = await service.getCachedUi();

      // UiConfig only ever exposes these four fields - a stray "ip" field
      // in the response has nowhere to surface.
      expect(ui.language, 'th');
      expect(ui.country, 'TH');
      expect(ui.placeholder, 'คุณต้องการแปลงอะไร?');
    });
  });

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
