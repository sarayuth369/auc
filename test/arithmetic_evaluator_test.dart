import 'package:flutter_test/flutter_test.dart';

import 'package:auc/domain/conversion_exception.dart';
import 'package:auc/services/arithmetic_evaluator.dart';

void main() {
  group('ArithmeticEvaluator.tryWhole (pure calculator mode)', () {
    test('addition, with and without spaces', () {
      expect(ArithmeticEvaluator.tryWhole('10+2'), 12);
      expect(ArithmeticEvaluator.tryWhole('10 + 2'), 12);
    });

    test('subtraction, with and without spaces (no unit -> unambiguous)', () {
      expect(ArithmeticEvaluator.tryWhole('10-2'), 8);
      expect(ArithmeticEvaluator.tryWhole('10 - 2'), 8);
    });

    test('multiplication', () {
      expect(ArithmeticEvaluator.tryWhole('10*2'), 20);
      expect(ArithmeticEvaluator.tryWhole('10 * 2'), 20);
      expect(ArithmeticEvaluator.tryWhole('5.5*2'), 11);
    });

    test('division', () {
      expect(ArithmeticEvaluator.tryWhole('10/2'), 5);
      expect(ArithmeticEvaluator.tryWhole('10 / 2'), 5);
      expect(ArithmeticEvaluator.tryWhole('100/8'), 12.5);
    });

    test('10/3 keeps full precision - rounding to 5 decimals is the formatter\'s job, not the evaluator\'s', () {
      expect(ArithmeticEvaluator.tryWhole('10/3'), closeTo(3.33333333, 1e-6));
    });

    test('division by zero throws instead of producing Infinity/NaN', () {
      expect(() => ArithmeticEvaluator.tryWhole('10/0'), throwsA(isA<ConversionException>()));
    });

    test('a unit attached after the expression is NOT pure arithmetic', () {
      expect(ArithmeticEvaluator.tryWhole('10/2 km'), isNull);
      expect(ArithmeticEvaluator.tryWhole('10 km/h'), isNull);
    });

    test('non-arithmetic input returns null', () {
      expect(ArithmeticEvaluator.tryWhole('10 km to miles'), isNull);
      expect(ArithmeticEvaluator.tryWhole('hello'), isNull);
      expect(ArithmeticEvaluator.tryWhole(''), isNull);
    });

    test('double-minus is handled correctly: 10--2 = 12', () {
      expect(ArithmeticEvaluator.tryWhole('10--2'), 12);
    });
  });

  group('ArithmeticEvaluator.tryLeading (unit-context prefix)', () {
    test('matches a leading expression, leaving the remainder untouched', () {
      final match = ArithmeticEvaluator.tryLeading('10/2 km');
      expect(match, isNotNull);
      expect(match!.value, 5);
      expect('10/2 km'.substring(match.consumedLength), ' km');
    });

    test('a tight "-" is NOT matched here (ambiguous with a negative-value item)', () {
      expect(ArithmeticEvaluator.tryLeading('10-2 km'), isNull);
    });

    test('a spaced "-" IS matched here', () {
      final match = ArithmeticEvaluator.tryLeading('10 - 2 km');
      expect(match!.value, 8);
    });

    test('no match for a compound-unit slash', () {
      expect(ArithmeticEvaluator.tryLeading('km/h'), isNull);
    });
  });
}
