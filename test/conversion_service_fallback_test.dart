import 'package:flutter_test/flutter_test.dart';

import 'package:auc/data/unit_repository.dart';
import 'package:auc/domain/conversion_engine.dart';
import 'package:auc/domain/conversion_exception.dart';
import 'package:auc/models/ai_intent.dart';
import 'package:auc/models/conversion_result.dart';
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
    'local-first: deterministic Thai and engineering inputs never call the remote resolver',
    () async {
      final remote = _FakeAiResolver(
        (_) async => throw StateError('should not be called'),
      );
      final service = ConversionService(
        aiResolverService: MockAiResolverService(),
        conversionEngine: ConversionEngine(repository),
        remoteAiResolverService: remote,
      );

      final cases = <String, String>{
        '1 กิโลกรัม เท่ากับกี่ออนซ์': '35.27396 oz',
        '1 กิโลกรัม เป็นกี่ออนซ์': '35.27396 oz',
        '1 กิโลกรัม แปลงเป็นออนซ์': '35.27396 oz',
        '10 km to miles': '6.21371 mi',
        '100 psi to kPa': '689.47573 kPa',
        '500 nm to micrometers': '0.5 μm',
        '3 ไร่ 4 งาน เป็นกี่ตารางเมตร': '6400 m²',
      };

      for (final entry in cases.entries) {
        final result = await service.convert(entry.key);
        expect(result.displayText, entry.value, reason: entry.key);
      }

      expect(remote.callCount, 0);
    },
  );

  test(
    'local-first: หุน (Thai trade unit, 1/8 inch) resolves without the remote resolver',
    () async {
      final remote = _FakeAiResolver(
        (_) async => throw StateError('should not be called'),
      );
      final service = ConversionService(
        aiResolverService: MockAiResolverService(),
        conversionEngine: ConversionEngine(repository),
        remoteAiResolverService: remote,
      );

      final cases = <String, String>{
        // Task spec A-I.
        '4 หุน เท่ากับกี่ cm': '1.27 cm',
        '4 หุน เท่ากับกี่มิล': '12.7 mm',
        '4 หุน เท่ากับกี่ mm': '12.7 mm',
        '4 หุน เท่ากับกี่นิ้ว': '0.5 in',
        '8 หุน เท่ากับกี่นิ้ว': '1 in',
        '1 นิ้ว เท่ากับกี่หุน': '8 หุน',
        '6 หุน เป็นกี่เซนติเมตร': '1.905 cm',
        '2 หุน เป็นกี่มิลลิเมตร': '6.35 mm',
        '16 หุน เป็นกี่นิ้ว': '2 in',
        // Common technician wording variants.
        '4 หุน เป็นกี่ cm': '1.27 cm',
        '4 หุน เป็นกี่เซน': '1.27 cm',
        '4 หุน เป็นกี่เซนติเมตร': '1.27 cm',
        '4 หุน เท่ากับกี่มิลลิเมตร': '12.7 mm',
        '4หุนเท่ากับกี่ cm': '1.27 cm',
        // Spacing variants (section 3).
        '4หุน เท่ากับกี่ cm': '1.27 cm',
        '4  หุน เท่ากับกี่ cm': '1.27 cm',
        // "หุนส์" alias.
        '4 หุนส์ เท่ากับกี่ cm': '1.27 cm',
      };

      for (final entry in cases.entries) {
        final result = await service.convert(entry.key);
        expect(result.displayText, entry.value, reason: entry.key);
      }

      expect(remote.callCount, 0);
    },
  );

  test(
    'local-first: global units with a single authoritative standard (pyeong/tsubo, jin) resolve without AI',
    () async {
      final remote = _FakeAiResolver(
        (_) async => throw StateError('should not be called'),
      );
      final service = ConversionService(
        aiResolverService: MockAiResolverService(),
        conversionEngine: ConversionEngine(repository),
        remoteAiResolverService: remote,
      );

      final cases = <String, String>{
        '3 pyeong to square meters': '9.91736 m²',
        '2 tsubo to square meters': '6.61157 m²',
        '10 jin to kg': '5 kg',
      };

      for (final entry in cases.entries) {
        final result = await service.convert(entry.key);
        expect(result.displayText, entry.value, reason: entry.key);
      }

      expect(remote.callCount, 0);
    },
  );

  test('alias-collision safety: new short Thai aliases resolve to the right unit, existing ones are unaffected', () async {
    final repo = repository;
    expect(repo.resolve('เซน')!.canonical, 'centimeter');
    expect(repo.resolve('มิล')!.canonical, 'millimeter');
    expect(repo.resolve('หุน')!.canonical, 'hun');
    expect(repo.resolve('หุนส์')!.canonical, 'hun');
    // Pre-existing aliases must be completely unaffected by the additions.
    expect(repo.resolve('กิโล')!.canonical, 'kilogram');
    expect(repo.resolve('ปอนด์')!.canonical, 'pound');
    expect(repo.resolve('นิ้ว')!.canonical, 'inch');
    expect(repo.resolve('ฟุต')!.canonical, 'foot');
    expect(repo.resolve('วา')!.canonical, 'wa');
    expect(repo.resolve('เส้น')!.canonical, 'sen');
    expect(repo.resolve('เซนติเมตร')!.canonical, 'centimeter');
    expect(repo.resolve('มิลลิเมตร')!.canonical, 'millimeter');
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

  group('currency (stability hardening): a separate category, never through ConversionEngine', () {
    test('a CurrencyResolvedException from the remote resolver is returned directly, not computed locally', () async {
      final remote = _FakeAiResolver((_) async {
        throw CurrencyResolvedException(
          ConversionResult(
            inputText: '100 THB = USD',
            value: 2.87,
            unit: 'USD',
            formattedValue: '2.87',
            categoryId: 'currency',
          ),
        );
      });
      final service = ConversionService(
        aiResolverService: MockAiResolverService(), // LocalParser has no currency category -> UnknownUnitException -> falls back
        conversionEngine: ConversionEngine(repository),
        remoteAiResolverService: remote,
      );

      final result = await service.convert('100 THB = USD');
      expect(result.displayText, '2.87 USD');
      expect(result.categoryId, 'currency');
      expect(remote.callCount, 1);
    });
  });
}
