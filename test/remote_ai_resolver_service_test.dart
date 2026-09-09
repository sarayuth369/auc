import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:auc/domain/conversion_exception.dart';
import 'package:auc/services/ai_config_service.dart';
import 'package:auc/services/remote_ai_resolver_service.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('parses a successful resolve response into an AiIntent', () async {
    final client = MockClient((request) async {
      expect(request.url.path, '/api/resolve');
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      expect(body['text'], '10 km to miles');
      return http.Response(
        jsonEncode({
          'success': true,
          'intent': 'convert',
          'language': 'en',
          'items': [
            {'value': 10, 'unit': 'kilometer'},
          ],
          'target_unit': 'mile',
        }),
        200,
      );
    });

    final service = RemoteAiResolverService(
      baseUrl: 'https://example.test',
      client: client,
    );
    final intent = await service.resolveIntent('10 km to miles');

    expect(intent.items, hasLength(1));
    expect(intent.items.first.value, 10);
    expect(intent.items.first.unit, 'kilometer');
    expect(intent.targetUnit, 'mile');
  });

  test(
    'throws ClarificationException for a needs_clarification response',
    () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': false,
            'needs_clarification': true,
            'question': 'Which region or state does "bigha" refer to?',
            'unit': 'bigha',
          }),
          200,
        );
      });

      final service = RemoteAiResolverService(
        baseUrl: 'https://example.test',
        client: client,
      );

      await expectLater(
        () => service.resolveIntent('1 bigha to square meters'),
        throwsA(isA<ClarificationException>()),
      );
    },
  );

  test(
    'throws ConversionException for a generic backend error response',
    () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {
              'code': 'UNSUPPORTED_CONVERSION',
              'message': 'Cannot convert energy to power.',
            },
          }),
          422,
        );
      });

      final service = RemoteAiResolverService(
        baseUrl: 'https://example.test',
        client: client,
      );

      await expectLater(
        () => service.resolveIntent('1 BTU to W'),
        throwsA(isA<ConversionException>()),
      );
    },
  );

  test('throws ConversionException for malformed JSON', () async {
    final client = MockClient(
      (request) async => http.Response('not json {', 200),
    );

    final service = RemoteAiResolverService(
      baseUrl: 'https://example.test',
      client: client,
    );

    await expectLater(
      () => service.resolveIntent('anything'),
      throwsA(isA<ConversionException>()),
    );
  });

  test('throws ConversionException on a non-JSON error status', () async {
    final client = MockClient(
      (request) async => http.Response('Internal Server Error', 500),
    );

    final service = RemoteAiResolverService(
      baseUrl: 'https://example.test',
      client: client,
    );

    await expectLater(
      () => service.resolveIntent('anything'),
      throwsA(isA<ConversionException>()),
    );
  });

  test('throws ConversionException on timeout', () async {
    final client = MockClient((request) async {
      await Future<void>.delayed(const Duration(milliseconds: 100));
      return http.Response(jsonEncode({'success': true}), 200);
    });

    final service = RemoteAiResolverService(
      baseUrl: 'https://example.test',
      client: client,
      timeout: const Duration(milliseconds: 10),
    );

    await expectLater(
      () => service.resolveIntent('anything'),
      throwsA(isA<ConversionException>()),
    );
  });

  test(
    'throws ConversionException with no message field falls back to a generic one',
    () async {
      final client = MockClient(
        (request) async => http.Response(jsonEncode({'weird': true}), 200),
      );

      final service = RemoteAiResolverService(
        baseUrl: 'https://example.test',
        client: client,
      );

      await expectLater(
        () => service.resolveIntent('anything'),
        throwsA(isA<ConversionException>()),
      );
    },
  );

  group('with a dynamic AiConfigService', () {
    test(
      'never calls the network when the cached config has AI disabled',
      () async {
        var called = false;
        final client = MockClient((request) async {
          called = true;
          return http.Response('{}', 200);
        });
        final configService = AiConfigService(baseUrl: 'https://example.test');
        await SharedPreferences.getInstance().then(
          (prefs) => prefs.setString(
            'auc_ai_config_v1',
            '{"configVersion":1,"ai":{"enabled":false,"provider":"gemini","model":"gemini-3.6-flash","timeoutMs":25000}}',
          ),
        );

        final service = RemoteAiResolverService(
          baseUrl: 'https://example.test',
          client: client,
          configService: configService,
        );

        await expectLater(
          () => service.resolveIntent('10 km to miles'),
          throwsA(isA<ConversionException>()),
        );
        expect(called, false);
      },
    );

    test(
      'uses the cached timeoutMs instead of the constructor default',
      () async {
        final client = MockClient((request) async {
          await Future<void>.delayed(const Duration(milliseconds: 50));
          return http.Response(
            jsonEncode({
              'success': true,
              'intent': 'convert',
              'language': 'en',
              'items': [
                {'value': 10, 'unit': 'kilometer'},
              ],
              'target_unit': 'mile',
            }),
            200,
          );
        });
        final configService = AiConfigService(baseUrl: 'https://example.test');
        await SharedPreferences.getInstance().then(
          (prefs) => prefs.setString(
            'auc_ai_config_v1',
            '{"configVersion":1,"ai":{"enabled":true,"provider":"gemini","model":"gemini-3.6-flash","timeoutMs":5}}',
          ),
        );

        final service = RemoteAiResolverService(
          baseUrl: 'https://example.test',
          timeout: const Duration(seconds: 25), // Would NOT time out at 25s.
          client: client,
          configService: configService,
        );

        // The 5ms cached timeout - not the 25s constructor default - governs.
        await expectLater(
          () => service.resolveIntent('10 km to miles'),
          throwsA(isA<ConversionException>()),
        );
      },
    );

    test(
      'hot-switch: provider/model changing in the cached config requires no Flutter code change',
      () async {
        final client = MockClient(
          (request) async => http.Response(
            jsonEncode({
              'success': true,
              'intent': 'convert',
              'language': 'en',
              'items': [
                {'value': 10, 'unit': 'kilometer'},
              ],
              'target_unit': 'mile',
            }),
            200,
          ),
        );
        final configService = AiConfigService(baseUrl: 'https://example.test');
        final service = RemoteAiResolverService(
          baseUrl: 'https://example.test',
          client: client,
          configService: configService,
        );

        for (final provider in ['gemini', 'openai']) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(
            'auc_ai_config_v1',
            '{"configVersion":1,"ai":{"enabled":true,"provider":"$provider","model":"test-model","timeoutMs":25000}}',
          );
          final intent = await service.resolveIntent('10 km to miles');
          expect(intent.targetUnit, 'mile');
        }
      },
    );

    test(
      'falls back to safe built-in defaults (and still works) when nothing is cached',
      () async {
        final client = MockClient(
          (request) async => http.Response(
            jsonEncode({
              'success': true,
              'intent': 'convert',
              'language': 'en',
              'items': [
                {'value': 10, 'unit': 'kilometer'},
              ],
              'target_unit': 'mile',
            }),
            200,
          ),
        );
        final service = RemoteAiResolverService(
          baseUrl: 'https://example.test',
          client: client,
          configService: AiConfigService(baseUrl: 'https://example.test'),
        );

        final intent = await service.resolveIntent('10 km to miles');
        expect(intent.targetUnit, 'mile');
      },
    );
  });

  group('currency responses (stability hardening)', () {
    test('a "currency_convert" response throws CurrencyResolvedException, not a normal AiIntent', () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'intent': 'currency_convert',
            'from': 'THB',
            'to': 'USD',
            'amount': 100,
            'rate': 0.0287,
            'result': 2.87,
            'asOf': '2026-09-09T00:00:00.000Z',
          }),
          200,
        );
      });
      final service = RemoteAiResolverService(baseUrl: 'https://example.test', client: client);

      await expectLater(
        service.resolveIntent('100 THB = USD'),
        throwsA(isA<CurrencyResolvedException>()),
      );
    });

    test('the carried ConversionResult reflects exactly the backend-computed value', () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'intent': 'currency_convert',
            'from': 'THB',
            'to': 'USD',
            'amount': 100,
            'rate': 0.0287,
            'result': 2.87,
            'asOf': '2026-09-09T00:00:00.000Z',
          }),
          200,
        );
      });
      final service = RemoteAiResolverService(baseUrl: 'https://example.test', client: client);

      try {
        await service.resolveIntent('100 THB = USD');
        fail('expected CurrencyResolvedException');
      } on CurrencyResolvedException catch (e) {
        expect(e.result.value, 2.87);
        expect(e.result.unit, 'USD');
        expect(e.result.categoryId, 'currency');
        expect(e.result.displayText, '2.87 USD');
      }
    });

    test('currency precision: shows 4 meaningful decimals instead of rounding to 2 (stability hardening)', () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'intent': 'currency_convert',
            'from': 'THB',
            'to': 'USD',
            'amount': 10,
            'rate': 0.03214,
            'result': 0.3214,
            'asOf': '2026-09-09T00:00:00.000Z',
          }),
          200,
        );
      });
      final service = RemoteAiResolverService(baseUrl: 'https://example.test', client: client);

      try {
        await service.resolveIntent('10 THB = USD');
        fail('expected CurrencyResolvedException');
      } on CurrencyResolvedException catch (e) {
        // At the old 2-decimal precision this would have rounded to "0.32",
        // losing meaningful precision for a small currency amount.
        expect(e.result.displayText, '0.3214 USD');
      }
    });

    test('a malformed currency_convert response throws a plain ConversionException', () async {
      final client = MockClient((request) async {
        return http.Response(jsonEncode({'success': true, 'intent': 'currency_convert'}), 200);
      });
      final service = RemoteAiResolverService(baseUrl: 'https://example.test', client: client);

      await expectLater(service.resolveIntent('100 THB = USD'), throwsA(isA<ConversionException>()));
    });
  });
}
