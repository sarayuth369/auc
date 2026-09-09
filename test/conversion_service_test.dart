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

    test('kg -> oz', () async {
      expect(await convertText('1 kg to oz'), '35.27396 oz');
    });

    test('Thai: กิโลกรัม เท่ากับกี่ออนซ์ (equals how many)', () async {
      expect(await convertText('1 กิโลกรัม เท่ากับกี่ออนซ์'), '35.27396 oz');
    });

    test('Thai: กิโลกรัม เป็นกี่ออนซ์ (is how many)', () async {
      expect(await convertText('1 กิโลกรัม เป็นกี่ออนซ์'), '35.27396 oz');
    });

    test('Thai: กิโลกรัม แปลงเป็นออนซ์ (convert to)', () async {
      expect(await convertText('1 กิโลกรัม แปลงเป็นออนซ์'), '35.27396 oz');
    });

    test('Thai aliases: กิโล, กก, กรัม, มิลลิกรัม, ปอนด์', () async {
      expect(await convertText('1 กิโล to kg'), '1 kg');
      expect(await convertText('1 กก to kg'), '1 kg');
      expect(await convertText('1000 กรัม to kg'), '1 kg');
      expect(await convertText('1000 มิลลิกรัม to grams'), '1 g');
      expect(await convertText('1 ปอนด์ to kg'), '0.45359 kg');
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

    test('3 ไร่ 4 งาน เป็นกี่ตารางเมตร -> square meters', () async {
      expect(await convertText('3 ไร่ 4 งาน เป็นกี่ตารางเมตร'), '6400 m²');
    });

    test(
      'Thai length aliases: กิโลเมตร, เซนติเมตร, มิลลิเมตร, นิ้ว, ฟุต, หลา, ไมล์',
      () async {
        expect(await convertText('1 กิโลเมตร to meters'), '1000 m');
        expect(await convertText('100 เซนติเมตร to meters'), '1 m');
        expect(await convertText('1000 มิลลิเมตร to meters'), '1 m');
        expect(await convertText('1 ฟุต to inches'), '12 in');
        expect(await convertText('1 นิ้ว to cm'), '2.54 cm');
        expect(await convertText('1 หลา to feet'), '3 ft');
        expect(await convertText('1 ไมล์ to km'), '1.60934 km');
      },
    );

    test('Thai volume aliases: ลิตร, มิลลิลิตร, แกลลอน', () async {
      expect(await convertText('1 ลิตร to milliliters'), '1000 mL');
      expect(await convertText('1000 มิลลิลิตร to liters'), '1 L');
      expect(await convertText('1 แกลลอน to liters'), '3.78541 L');
    });

    test(
      'Thai temperature aliases: เซลเซียส, องศาเซลเซียส, ฟาเรนไฮต์',
      () async {
        expect(await convertText('0 เซลเซียส to F'), '32 °F');
        expect(await convertText('0 องศาเซลเซียส to fahrenheit'), '32 °F');
        expect(await convertText('32 ฟาเรนไฮต์ to celsius'), '0 °C');
      },
    );
  });

  group('scientific and engineering units', () {
    test('psi -> kPa', () async {
      expect(await convertText('100 psi to kPa'), '689.47573 kPa');
    });

    test('MPa -> bar', () async {
      expect(await convertText('1 MPa to bar'), '10 bar');
    });

    test('N -> kN', () async {
      expect(await convertText('1000 N to kN'), '1 kN');
    });

    test('kWh -> MJ', () async {
      expect(await convertText('1 kWh to MJ'), '3.6 MJ');
    });

    test('BTU/h -> kW', () async {
      expect(await convertText('12000 BTU/h to kW'), '3.51685 kW');
    });

    test('nm -> micrometers', () async {
      expect(await convertText('500 nm to micrometers'), '0.5 μm');
    });

    test('MHz -> Hz', () async {
      expect(await convertText('10 MHz to Hz'), '10000000 Hz');
    });

    test('kHz -> MHz', () async {
      expect(await convertText('5000 kHz to MHz'), '5 MHz');
    });
  });

  group('short "=" command syntax (stability hardening)', () {
    test('"10 km = m"', () async {
      expect(await convertText('10 km = m'), '10000 m');
    });

    test('"10 km = m ?" (trailing question mark)', () async {
      expect(await convertText('10 km = m ?'), '10000 m');
    });

    test('"10 nm = m" (short syntax + SI prefix, rounds to 5 decimals like any other unit)', () async {
      expect(await convertText('10 nm = m'), '0 m');
    });

    test('Thai abbreviation "กม" for kilometer', () async {
      expect(await convertText('10 กม = เมตร'), '10000 m');
    });
  });

  group('arithmetic expressions (stability hardening)', () {
    test('"10/2 km = m" resolves the division, not a compound unit', () async {
      expect(await convertText('10/2 km = m'), '5000 m');
    });

    test('"10 / 2 km = m" (spaced)', () async {
      expect(await convertText('10 / 2 km = m'), '5000 m');
    });

    test('"10*2 km = m"', () async {
      expect(await convertText('10*2 km = m'), '20000 m');
    });

    test('"10 + 2 km = m"', () async {
      expect(await convertText('10 + 2 km = m'), '12000 m');
    });
  });

  group('compound units (stability hardening)', () {
    test('km/h -> m/s', () async {
      expect(await convertText('10 km/h to m/s'), '2.77778 m/s');
    });

    test('m/s -> km/h', () async {
      expect(await convertText('10 m/s to km/h'), '36 km/h');
    });

    test('"kilometer per hour" (3-word alias) -> m/s', () async {
      expect(await convertText('10 kilometer per hour to m/s'), '2.77778 m/s');
    });

    test('short syntax + compound unit: "10 km/h = m/s"', () async {
      expect(await convertText('10 km/h = m/s'), '2.77778 m/s');
    });
  });

  group('dimension safety', () {
    test(
      'BTU -> W is rejected locally as a category mismatch (no network needed)',
      () async {
        expect(
          () => service.convert('1 BTU to W'),
          throwsA(isA<ConversionException>()),
        );
      },
    );

    test(
      'J -> W is rejected locally as a category mismatch (no network needed)',
      () async {
        expect(
          () => service.convert('1 J to W'),
          throwsA(isA<ConversionException>()),
        );
      },
    );

    test('1 kg to meter must not produce a numeric conversion', () async {
      expect(
        () => service.convert('1 kg to meter'),
        throwsA(isA<ConversionException>()),
      );
    });
  });

  group('invalid input', () {
    test('empty string throws', () async {
      expect(() => service.convert(''), throwsA(isA<ConversionException>()));
    });

    test('missing "to" throws', () async {
      expect(
        () => service.convert('10 km miles'),
        throwsA(isA<ConversionException>()),
      );
    });

    test('no quantity throws', () async {
      expect(
        () => service.convert('km to miles'),
        throwsA(isA<ConversionException>()),
      );
    });
  });

  group('unknown unit', () {
    test('unknown target unit throws', () async {
      expect(
        () => service.convert('10 km to zzz'),
        throwsA(isA<ConversionException>()),
      );
    });

    test('unknown source unit throws', () async {
      expect(
        () => service.convert('10 zzz to km'),
        throwsA(isA<ConversionException>()),
      );
    });

    test('category mismatch throws', () async {
      expect(
        () => service.convert('10 kg to km'),
        throwsA(isA<ConversionException>()),
      );
    });
  });
}
