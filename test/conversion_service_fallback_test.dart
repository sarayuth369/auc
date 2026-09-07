import 'package:flutter_test/flutter_test.dart';

import 'package:auc/data/unit_repository.dart';
import 'package:auc/domain/conversion_engine.dart';
import 'package:auc/domain/conversion_exception.dart';
import 'package:auc/models/ai_intent.dart';
import 'package:auc/services/ai_resolver_service.dart';
import 'package:auc/services/conversion_service.dart';

/// A resolver double for exercising [ConversionService]'s fallback logic
/// without any real network/HTTP involved.
class _FakeAiResolver implements AiResolverService {
  _FakeAiResolver(this._handler);
  final Future<AiIntent> Function(String input) _handler;
  int callCount = 0;

  @override
  Future<AiIntent> resolveIntent(String input) {
    callCount++;
    return _handler(input);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late UnitRepository repository;

  setUpAll(() async {
    repository = await UnitRepository.loadFromAssets();
  });

  test('local-first: a known input never calls the remote resolver', () async {
    final remote = _FakeAiResolver(
      (_) async => throw StateError('should not be called'),
    );
    final service = ConversionService(
      aiResolverService: MockAiResolverService(),
      conversionEngine: ConversionEngine(repository),
      remoteAiResolverService: remote,
    );

    final result = await service.convert('10 km to miles');
    expect(result.displayText, '6.21371 mi');
    expect(remote.callCount, 0);
  });

  test(
    'falls back to remote when the local parser cannot understand the input',
    () async {
      final remote = _FakeAiResolver(
        (_) async => const AiIntent(
          intent: 'convert',
          items: [ConversionItem(value: 5, unit: 'kilometer')],
          targetUnit: 'mile',
        ),
      );
      final service = ConversionService(
        aiResolverService: MockAiResolverService(),
        conversionEngine: ConversionEngine(repository),
        remoteAiResolverService: remote,
      );

      // Spanish: LocalParser recognizes neither "a" nor any connector here.
      final result = await service.convert('5 kilómetros a millas');
      expect(result.unit, 'mi');
      expect(remote.callCount, 1);
    },
  );

  test(
    'falls back to remote when the extracted unit is unknown locally',
    () async {
      final remote = _FakeAiResolver(
        (_) async => const AiIntent(
          intent: 'convert',
          items: [ConversionItem(value: 1, unit: 'bigha_bihar')],
          targetUnit: 'square_meter',
        ),
      );
      final service = ConversionService(
        aiResolverService: MockAiResolverService(),
        conversionEngine: ConversionEngine(repository),
        remoteAiResolverService: remote,
      );

      // "bigha_bihar" still isn't in the local DB, so this still fails - the
      // point is proving the remote WAS consulted for an unknown unit.
      await expectLater(
        () => service.convert('1 bigha in Bihar to square meters'),
        throwsA(isA<UnknownUnitException>()),
      );
      expect(remote.callCount, 1);
    },
  );

  test(
    'does not fall back for a dimension mismatch (already certain locally)',
    () async {
      final remote = _FakeAiResolver(
        (_) async => throw StateError('should not be called'),
      );
      final service = ConversionService(
        aiResolverService: MockAiResolverService(),
        conversionEngine: ConversionEngine(repository),
        remoteAiResolverService: remote,
      );

      await expectLater(
        () => service.convert('1 BTU to W'),
        throwsA(isA<ConversionException>()),
      );
      expect(remote.callCount, 0);
    },
  );

  test(
    'surfaces a clarification from the remote resolver as ClarificationException',
    () async {
      final remote = _FakeAiResolver(
        (_) async => throw const ClarificationException(
          'Which region or state does "bigha" refer to?',
        ),
      );
      final service = ConversionService(
        aiResolverService: MockAiResolverService(),
        conversionEngine: ConversionEngine(repository),
        remoteAiResolverService: remote,
      );

      await expectLater(
        () => service.convert('1 bigha to square meters'),
        throwsA(isA<ClarificationException>()),
      );
    },
  );

  test(
    'without a remote resolver configured, local failures propagate unchanged',
    () async {
      final service = ConversionService(
        aiResolverService: MockAiResolverService(),
        conversionEngine: ConversionEngine(repository),
      );

      await expectLater(
        () => service.convert('5 kilómetros a millas'),
        throwsA(isA<ConversionException>()),
      );
    },
  );
}
