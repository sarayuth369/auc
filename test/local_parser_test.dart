import 'package:flutter_test/flutter_test.dart';

import 'package:auc/domain/conversion_exception.dart';
import 'package:auc/services/local_parser.dart';

void main() {
  final parser = LocalParser();

  test('parses a simple single-unit request', () {
    final intent = parser.parse('10 km to miles');
    expect(intent.intent, 'convert');
    expect(intent.items, hasLength(1));
    expect(intent.items.first.value, 10);
    expect(intent.items.first.unit, 'km');
    expect(intent.targetUnit, 'miles');
  });

  test('parses a multi-item request', () {
    final intent = parser.parse('3 rai 2 ngan to square meters');
    expect(intent.items, hasLength(2));
    expect(intent.items[0].value, 3);
    expect(intent.items[0].unit, 'rai');
    expect(intent.items[1].value, 2);
    expect(intent.items[1].unit, 'ngan');
    expect(intent.targetUnit, 'square meters');
  });

  test('throws on empty input', () {
    expect(() => parser.parse(''), throwsA(isA<ConversionException>()));
  });

  test('throws when "to" is missing', () {
    expect(
      () => parser.parse('10 km miles'),
      throwsA(isA<ConversionException>()),
    );
  });

  test('throws when no quantity is present', () {
    expect(
      () => parser.parse('km to miles'),
      throwsA(isA<ConversionException>()),
    );
  });

  test('parses Thai script units with "to"', () {
    final intent = parser.parse('1 ไร่ to square meters');
    expect(intent.items, hasLength(1));
    expect(intent.items.first.value, 1);
    expect(intent.items.first.unit, 'ไร่');
    expect(intent.targetUnit, 'square meters');
  });

  test('parses the Thai connector phrase "เป็นกี่" in place of "to"', () {
    final intent = parser.parse('10 วา เป็นกี่เมตร');
    expect(intent.items, hasLength(1));
    expect(intent.items.first.value, 10);
    expect(intent.items.first.unit, 'วา');
    expect(intent.targetUnit, 'เมตร');
  });

  test('parses a multi-item Thai request with the connector phrase', () {
    final intent = parser.parse('3 ไร่ 2 งาน เป็นกี่ตารางเมตร');
    expect(intent.items, hasLength(2));
    expect(intent.items[0].unit, 'ไร่');
    expect(intent.items[1].unit, 'งาน');
    expect(intent.targetUnit, 'ตารางเมตร');
  });

  test('parses mixed Thai/English unit input', () {
    final intent = parser.parse('3 ไร่ 2 ngan to square meters');
    expect(intent.items, hasLength(2));
    expect(intent.items[0].unit, 'ไร่');
    expect(intent.items[1].unit, 'ngan');
    expect(intent.targetUnit, 'square meters');
  });

  test('parses a compound slash unit like "BTU/h"', () {
    final intent = parser.parse('12000 BTU/h to kW');
    expect(intent.items, hasLength(1));
    expect(intent.items.first.value, 12000);
    expect(intent.items.first.unit, 'BTU/h');
    expect(intent.targetUnit, 'kW');
  });

  test('parses the Thai connector phrase "เท่ากับกี่" ("equals how many")', () {
    final intent = parser.parse('1 กิโลกรัม เท่ากับกี่ออนซ์');
    expect(intent.items, hasLength(1));
    expect(intent.items.first.value, 1);
    expect(intent.items.first.unit, 'กิโลกรัม');
    expect(intent.targetUnit, 'ออนซ์');
  });

  test('parses the Thai connector phrase "แปลงเป็น" ("convert to")', () {
    final intent = parser.parse('1 กิโลกรัม แปลงเป็นออนซ์');
    expect(intent.items, hasLength(1));
    expect(intent.items.first.value, 1);
    expect(intent.items.first.unit, 'กิโลกรัม');
    expect(intent.targetUnit, 'ออนซ์');
  });

  test('parses the bare Thai connector "กี่" ("how many")', () {
    final intent = parser.parse('1 กิโลกรัม กี่ออนซ์');
    expect(intent.items, hasLength(1));
    expect(intent.items.first.value, 1);
    expect(intent.items.first.unit, 'กิโลกรัม');
    expect(intent.targetUnit, 'ออนซ์');
  });

  group('short "=" syntax', () {
    test('"10 km = m" is recognized (bare "=" as a connector)', () {
      final intent = parser.parse('10 km = m');
      expect(intent.items.single.value, 10);
      expect(intent.items.single.unit, 'km');
      expect(intent.targetUnit, 'm');
    });

    test('"10 km = m ?" strips the trailing question mark from the target', () {
      final intent = parser.parse('10 km = m ?');
      expect(intent.targetUnit, 'm');
    });

    test('a full-width "？" is stripped the same as an ASCII "?"', () {
      final intent = parser.parse('10 km = m？');
      expect(intent.targetUnit, 'm');
    });

    test('the "→" arrow is recognized as a connector', () {
      final intent = parser.parse('10 km → m');
      expect(intent.items.single.unit, 'km');
      expect(intent.targetUnit, 'm');
    });
  });

  group('arithmetic expressions before the unit', () {
    test('"10/2 km = m" resolves the division before unit lookup', () {
      final intent = parser.parse('10/2 km = m');
      expect(intent.items.single.value, 5);
      expect(intent.items.single.unit, 'km');
    });

    test('"10 / 2 km = m" (spaced slash) is also arithmetic', () {
      final intent = parser.parse('10 / 2 km = m');
      expect(intent.items.single.value, 5);
      expect(intent.items.single.unit, 'km');
    });

    test('"10*2 km = m" resolves multiplication', () {
      final intent = parser.parse('10*2 km = m');
      expect(intent.items.single.value, 20);
      expect(intent.items.single.unit, 'km');
    });

    test('"10 + 2 km = m" resolves addition', () {
      final intent = parser.parse('10 + 2 km = m');
      expect(intent.items.single.value, 12);
      expect(intent.items.single.unit, 'km');
    });

    test('"10 - 2 km = m" (spaced minus) resolves subtraction', () {
      final intent = parser.parse('10 - 2 km = m');
      expect(intent.items.single.value, 8);
      expect(intent.items.single.unit, 'km');
    });

    test('a tight "10-2" (no spaces) is NOT treated as subtraction - ambiguous with a negative number', () {
      // Deliberately falls through to the normal pair extraction, which
      // reads it as the value -2 (the leading "10" has no unit attached and
      // is dropped by the pair regex, same as before this change).
      final intent = parser.parse('10-2 km = m');
      expect(intent.items.single.value, -2);
      expect(intent.items.single.unit, 'km');
    });

    test('division by zero is not silently converted to Infinity/NaN', () {
      expect(() => parser.parse('10/0 km = m'), throwsA(isA<ConversionException>()));
    });
  });

  group('compound units', () {
    test('a 3-word compound alias "kilometer per hour" is captured whole, not truncated', () {
      final intent = parser.parse('10 kilometer per hour to m/s');
      expect(intent.items.single.value, 10);
      expect(intent.items.single.unit, 'kilometer per hour');
      expect(intent.targetUnit, 'm/s');
    });

    test('"10 km/h = m/s" (no-space compound alias on both sides)', () {
      final intent = parser.parse('10 km/h = m/s');
      expect(intent.items.single.unit, 'km/h');
      expect(intent.targetUnit, 'm/s');
    });
  });
}
