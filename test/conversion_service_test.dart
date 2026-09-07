import 'package:flutter_test/flutter_test.dart';

import 'package:auc/data/unit_repository.dart';
import 'package:auc/domain/conversion_engine.dart';
import 'package:auc/domain/conversion_exception.dart';
import 'package:auc/services/ai_resolver_service.dart';
import 'package:auc/services/conversion_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late ConversionService service;

  setUpAll(() async {
    final repository = await UnitRepository.loadFromAssets();
    service = ConversionService(
      aiResolverService: MockAiResolverService(),
      conversionEngine: ConversionEngine(repository),
    );
  });

  Future<String> convertText(String input) async {
    final result = await service.convert(input);
    return result.displayText;
  }

  group('length', () {
    test('km -> mile', () async {
      expect(await convertText('10 km to miles'), '6.21371 mi');
    });

    test('mile -> km', () async {
      expect(await convertText('10 miles to km'), '16.09344 km');
    });

    test('m -> ft', () async {
      expect(await convertText('1 m to ft'), '3.28084 ft');
    });

    test('ft -> m', () async {
      expect(await convertText('1 ft to m'), '0.3048 m');
    });

    test('multi-unit conversion: feet and inches -> cm', () async {
      expect(await convertText('5 feet 8 inches to cm'), '172.72 cm');
    });
  });

  group('weight', () {
    test('kg -> lb', () async {
      expect(await convertText('1 kg to lb'), '2.20462 lb');
    });

    test('lb -> kg', () async {
      expect(await convertText('1 lb to kg'), '0.45359 kg');
    });
  });

  group('temperature', () {
    test('C -> F', () async {
      expect(await convertText('0 C to F'), '32 °F');
    });

    test('F -> C', () async {
      expect(await convertText('72 F to C'), '22.22 °C');
    });
  });

  group('area', () {
    test('rai -> square meters', () async {
      expect(await convertText('1 rai to square meters'), '1600 m²');
    });

    test('ngan -> square meters', () async {
      expect(await convertText('1 ngan to square meters'), '400 m²');
    });

    test('multi-unit conversion: rai and ngan -> square meters', () async {
      expect(await convertText('3 rai 2 ngan to square meters'), '5600 m²');
    });
  });

  group('thai units', () {
    test('1 ไร่ -> square meters', () async {
      expect(await convertText('1 ไร่ to square meters'), '1600 m²');
    });

    test('1 งาน -> square meters', () async {
      expect(await convertText('1 งาน to square meters'), '400 m²');
    });

    test('10 วา -> meters', () async {
      expect(await convertText('10 วา to meters'), '20 m');
    });

    test('3 ไร่ 2 งาน -> square meters', () async {
      expect(await convertText('3 ไร่ 2 งาน to square meters'), '5600 m²');
    });

    test('Thai connector phrase "เป็นกี่" instead of "to"', () async {
      expect(await convertText('10 วา เป็นกี่เมตร'), '20 m');
    });

    test('multi-item Thai connector phrase', () async {
      expect(await convertText('3 ไร่ 2 งาน เป็นกี่ตารางเมตร'), '5600 m²');
    });

    test('Thai aliases: เส้น and ตารางวา', () async {
      expect(await convertText('1 เส้น to meters'), '40 m');
      expect(await convertText('1 ตารางวา to square meters'), '4 m²');
    });

    test('English aliases: sen and square wa', () async {
      expect(await convertText('1 sen to meters'), '40 m');
      expect(await convertText('1 square wa to square meters'), '4 m²');
    });

    test('mixed Thai/English input in one sentence', () async {
      expect(await convertText('3 ไร่ 2 ngan to square meters'), '5600 m²');
    });
  });

  group('invalid input', () {
    test('empty string throws', () async {
      expect(() => service.convert(''), throwsA(isA<ConversionException>()));
    });

    test('missing "to" throws', () async {
      expect(() => service.convert('10 km miles'), throwsA(isA<ConversionException>()));
    });

    test('no quantity throws', () async {
      expect(() => service.convert('km to miles'), throwsA(isA<ConversionException>()));
    });
  });

  group('unknown unit', () {
    test('unknown target unit throws', () async {
      expect(() => service.convert('10 km to zzz'), throwsA(isA<ConversionException>()));
    });

    test('unknown source unit throws', () async {
      expect(() => service.convert('10 zzz to km'), throwsA(isA<ConversionException>()));
    });

    test('category mismatch throws', () async {
      expect(() => service.convert('10 kg to km'), throwsA(isA<ConversionException>()));
    });
  });
}
