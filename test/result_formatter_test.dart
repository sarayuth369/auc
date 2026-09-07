import 'package:flutter_test/flutter_test.dart';

import 'package:auc/models/conversion_result.dart';
import 'package:auc/services/result_formatter.dart';
import 'package:auc/services/settings_service.dart';

ConversionResult _result({
  required double value,
  required String unit,
  String formattedValue = '',
  String categoryId = 'length',
}) {
  return ConversionResult(
    inputText: 'test input',
    value: value,
    unit: unit,
    formattedValue: formattedValue.isEmpty ? value.toString() : formattedValue,
    categoryId: categoryId,
  );
}

void main() {
  test('auto keeps the engine\'s own formatted display text unchanged', () {
    final result = _result(
      value: 6.21371,
      unit: 'mi',
      formattedValue: '6.21371',
    );
    expect(formatResultDisplay(result, DecimalPlaces.auto), '6.21371 mi');
  });

  test(
    'fixed decimal places format to exactly that many digits, per the examples',
    () {
      final result = _result(value: 6.21371, unit: 'mi');
      expect(formatResultDisplay(result, DecimalPlaces.two), '6.21 mi');
      expect(formatResultDisplay(result, DecimalPlaces.four), '6.2137 mi');
      expect(formatResultDisplay(result, DecimalPlaces.six), '6.213710 mi');
      expect(formatResultDisplay(result, DecimalPlaces.eight), '6.21371000 mi');
    },
  );

  test('fixed decimal places keep trailing zeros (unlike auto)', () {
    final result = _result(value: 10, unit: 'm');
    expect(formatResultDisplay(result, DecimalPlaces.two), '10.00 m');
  });

  test('negative values are formatted correctly', () {
    final result = _result(value: -40, unit: '°C', categoryId: 'temperature');
    expect(formatResultDisplay(result, DecimalPlaces.two), '-40.00 °C');
  });

  test('temperature category is formatted the same as any other category', () {
    final result = _result(
      value: 22.222222,
      unit: '°C',
      categoryId: 'temperature',
    );
    expect(formatResultDisplay(result, DecimalPlaces.two), '22.22 °C');
  });

  test('very small values never fall back to scientific notation', () {
    final result = _result(value: 0.0000001234, unit: 'km');
    expect(formatResultDisplay(result, DecimalPlaces.four), '0.0000 km');
    expect(formatResultDisplay(result, DecimalPlaces.eight), '0.00000012 km');
  });

  test('NaN/Infinity are never passed to toStringAsFixed', () {
    final nanResult = _result(value: double.nan, unit: 'x');
    final infResult = _result(value: double.infinity, unit: 'x');
    expect(formatResultDisplay(nanResult, DecimalPlaces.two), 'NaN x');
    expect(formatResultDisplay(infResult, DecimalPlaces.two), 'Infinity x');
  });
}
