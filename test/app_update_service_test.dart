import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:auc/services/app_update_service.dart';

String _policyBody({
  String latest = '1.0.0',
  String minimum = '1.0.0',
  bool force = false,
  String? storeUrl,
}) {
  final store = storeUrl != null ? '"storeUrl":"$storeUrl",' : '';
  return '{"configVersion":1,"app":{"android":{"latestVersion":"$latest",'
      '"minimumSupportedVersion":"$minimum","forceUpdate":$force,$store'
      '"storeUrl":"${storeUrl ?? 'https://play.google.com/store/apps/details?id=com.sarayuth369.auc'}"}}}';
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  // getCurrentVersion() falls back to '1.0.0' outside a real platform
  // install (no method-channel mocking here) - deterministic and lets these
  // tests exercise the actual decision logic via the server's declared
  // minimum/latest instead.
  const currentVersionFallback = '1.0.0';

  test('current == minimum, forceUpdate=true -> allowed', () async {
    final client = MockClient((request) async => http.Response(_policyBody(minimum: '1.0.0', force: true), 200));
    final service = AppUpdateService(baseUrl: 'https://example.test', client: client);

    final decision = await service.getUpdateDecision();
    expect(decision.required, isFalse);
    expect(decision.currentVersion, currentVersionFallback);
  });

  test('current < minimum, forceUpdate=true -> FORCE UPDATE', () async {
    final client = MockClient((request) async => http.Response(_policyBody(minimum: '1.0.1', force: true), 200));
    final service = AppUpdateService(baseUrl: 'https://example.test', client: client);

    final decision = await service.getUpdateDecision();
    expect(decision.required, isTrue);
    expect(decision.latestVersion, '1.0.0');
  });

  test('current > minimum -> allowed regardless of forceUpdate', () async {
    final client = MockClient((request) async => http.Response(_policyBody(minimum: '0.9.0', force: true), 200));
    final service = AppUpdateService(baseUrl: 'https://example.test', client: client);

    final decision = await service.getUpdateDecision();
    expect(decision.required, isFalse);
  });

  test('current < minimum but forceUpdate=false -> master switch off, allowed', () async {
    final client = MockClient((request) async => http.Response(_policyBody(minimum: '9.9.9', force: false), 200));
    final service = AppUpdateService(baseUrl: 'https://example.test', client: client);

    final decision = await service.getUpdateDecision();
    expect(decision.required, isFalse);
  });

  test('config request times out with no cache -> allowed (fail-safe, never block on server down)', () async {
    final client = MockClient((request) async {
      await Future<void>.delayed(const Duration(seconds: 10));
      return http.Response(_policyBody(), 200);
    });
    final service = AppUpdateService(baseUrl: 'https://example.test', client: client);

    final decision = await service.getUpdateDecision(timeout: const Duration(milliseconds: 50));
    expect(decision.required, isFalse);
  });

  test('config returns HTTP 500 with no cache -> allowed', () async {
    final client = MockClient((request) async => http.Response('server error', 500));
    final service = AppUpdateService(baseUrl: 'https://example.test', client: client);

    final decision = await service.getUpdateDecision();
    expect(decision.required, isFalse);
  });

  test('invalid JSON with no cache -> allowed, never throws', () async {
    final client = MockClient((request) async => http.Response('not json {', 200));
    final service = AppUpdateService(baseUrl: 'https://example.test', client: client);

    final decision = await service.getUpdateDecision();
    expect(decision.required, isFalse);
  });

  test('missing required fields with no cache -> allowed, never throws', () async {
    final client = MockClient(
      (request) async => http.Response('{"configVersion":1,"app":{"android":{"latestVersion":"1.0.0"}}}', 200),
    );
    final service = AppUpdateService(baseUrl: 'https://example.test', client: client);

    final decision = await service.getUpdateDecision();
    expect(decision.required, isFalse);
  });

  test('a successful check caches the policy for a later network failure to fall back on', () async {
    final okClient = MockClient((request) async => http.Response(_policyBody(minimum: '1.0.1', force: true), 200));
    final firstLaunch = AppUpdateService(baseUrl: 'https://example.test', client: okClient);
    final firstDecision = await firstLaunch.getUpdateDecision();
    expect(firstDecision.required, isTrue); // establishes the cache

    // A brand new instance (simulates app restart), network now down -
    // must still enforce the previously-fetched emergency policy from cache,
    // not silently allow everyone through just because the server is
    // unreachable this time.
    final failingClient = MockClient((request) async => throw Exception('network down'));
    final secondLaunch = AppUpdateService(baseUrl: 'https://example.test', client: failingClient);
    final secondDecision = await secondLaunch.getUpdateDecision();
    expect(secondDecision.required, isTrue);
  });

  test('an expired/stale cache still reflects the last known policy when refresh fails', () async {
    final okClient = MockClient((request) async => http.Response(_policyBody(minimum: '0.9.0', force: true), 200));
    final firstLaunch = AppUpdateService(baseUrl: 'https://example.test', client: okClient);
    await firstLaunch.getUpdateDecision();

    final failingClient = MockClient((request) async => http.Response('down', 500));
    final secondLaunch = AppUpdateService(baseUrl: 'https://example.test', client: failingClient);
    final decision = await secondLaunch.getUpdateDecision();
    expect(decision.required, isFalse); // cached policy said current > minimum
  });

  test('falls back to the centralized store URL when the server omits one', () async {
    final client = MockClient(
      (request) async => http.Response(
        '{"configVersion":1,"app":{"android":{"latestVersion":"1.0.0","minimumSupportedVersion":"1.0.1","forceUpdate":true}}}',
        200,
      ),
    );
    final service = AppUpdateService(baseUrl: 'https://example.test', client: client);
    final decision = await service.getUpdateDecision();
    expect(decision.storeUrl, contains('play.google.com'));
    expect(decision.storeUrl, contains('com.sarayuth369.auc'));
  });

  test('startImmediateUpdate never throws outside Android (returns false)', () async {
    final service = AppUpdateService(baseUrl: 'https://example.test');
    final started = await service.startImmediateUpdate();
    expect(started, isFalse);
  });
}
