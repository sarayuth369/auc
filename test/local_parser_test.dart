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
    expect(() => parser.parse('10 km miles'), throwsA(isA<ConversionException>()));
  });

  test('throws when no quantity is present', () {
    expect(() => parser.parse('km to miles'), throwsA(isA<ConversionException>()));
  });
}
