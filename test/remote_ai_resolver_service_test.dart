import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:auc/domain/conversion_exception.dart';
import 'package:auc/services/remote_ai_resolver_service.dart';

void main() {
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

    final service = RemoteAiResolverService(baseUrl: 'https://example.test', client: client);
    final intent = await service.resolveIntent('10 km to miles');

    expect(intent.items, hasLength(1));
    expect(intent.items.first.value, 10);
    expect(intent.items.first.unit, 'kilometer');
    expect(intent.targetUnit, 'mile');
  });

  test('throws ClarificationException for a needs_clarification response', () async {
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

    final service = RemoteAiResolverService(baseUrl: 'https://example.test', client: client);

    await expectLater(
      () => service.resolveIntent('1 bigha to square meters'),
      throwsA(isA<ClarificationException>()),
    );
  });

  test('throws ConversionException for a generic backend error response', () async {
    final client = MockClient((request) async {
      return http.Response(
        jsonEncode({
          'success': false,
          'error': {'code': 'UNSUPPORTED_CONVERSION', 'message': 'Cannot convert energy to power.'},
        }),
        422,
      );
    });

    final service = RemoteAiResolverService(baseUrl: 'https://example.test', client: client);

    await expectLater(
      () => service.resolveIntent('1 BTU to W'),
      throwsA(isA<ConversionException>()),
    );
  });

  test('throws ConversionException for malformed JSON', () async {
    final client = MockClient((request) async => http.Response('not json {', 200));

    final service = RemoteAiResolverService(baseUrl: 'https://example.test', client: client);

    await expectLater(
      () => service.resolveIntent('anything'),
      throwsA(isA<ConversionException>()),
    );
  });

  test('throws ConversionException on a non-JSON error status', () async {
    final client = MockClient((request) async => http.Response('Internal Server Error', 500));

    final service = RemoteAiResolverService(baseUrl: 'https://example.test', client: client);

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

  test('throws ConversionException with no message field falls back to a generic one', () async {
    final client = MockClient((request) async => http.Response(jsonEncode({'weird': true}), 200));

    final service = RemoteAiResolverService(baseUrl: 'https://example.test', client: client);

    await expectLater(
      () => service.resolveIntent('anything'),
      throwsA(isA<ConversionException>()),
    );
  });
}
