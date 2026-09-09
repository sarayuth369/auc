import 'dart:math' as math;

import '../data/unit_repository.dart';
import '../models/ai_intent.dart';
import '../models/conversion_result.dart';
import '../models/unit_definition.dart';
import 'conversion_exception.dart';

/// Deterministic conversion math. Never asked to "understand" text -
/// it only ever receives an already-structured [AiIntent].
class ConversionEngine {
  final UnitRepository repository;

  ConversionEngine(this.repository);

  ConversionResult compute(AiIntent intent, {required String inputText}) {
    if (intent.items.isEmpty) {
      throw const ConversionException('No quantity found in input.');
    }

    final targetUnit = repository.resolve(intent.targetUnit);
    if (targetUnit == null) {
      throw UnknownUnitException(
        'Unknown unit: "${intent.targetUnit}". '
        'Try a common name or abbreviation, e.g. "km", "kg", "m/s".',
      );
    }

    final resolvedItems = <UnitDefinition>[];
    for (final item in intent.items) {
      final unit = repository.resolve(item.unit);
      if (unit == null) {
        throw UnknownUnitException(
          'Unknown unit: "${item.unit}". '
          'Try a common name or abbreviation, e.g. "km", "kg", "m/s".',
        );
      }
      if (unit.categoryId != targetUnit.categoryId) {
        throw ConversionException(
          'Cannot convert "${unit.canonical}" to "${targetUnit.canonical}" '
          '(different categories).',
        );
      }
      resolvedItems.add(unit);
    }

    final double value;
    if (targetUnit.isSpecial) {
      if (intent.items.length != 1) {
        throw const ConversionException(
          'Temperature conversion supports a single value only.',
        );
      }
      value = _convertTemperature(
        intent.items.first.value,
        resolvedItems.first,
        targetUnit,
      );
    } else {
      var totalBase = 0.0;
      for (var i = 0; i < intent.items.length; i++) {
        totalBase += intent.items[i].value * (resolvedItems[i].factor ?? 1.0);
      }
      value = totalBase / (targetUnit.factor ?? 1.0);
    }

    final decimals = targetUnit.isSpecial ? 2 : 5;
    return ConversionResult(
      inputText: inputText,
      value: value,
      unit: targetUnit.symbol,
      formattedValue: formatNumber(value, maxDecimals: decimals),
      categoryId: targetUnit.categoryId,
    );
  }

  double _convertTemperature(
    double value,
    UnitDefinition from,
    UnitDefinition to,
  ) {
    // Normalize to Celsius first, then to the target.
    double celsius;
    switch (from.canonical) {
      case 'celsius':
        celsius = value;
        break;
      case 'fahrenheit':
        celsius = (value - 32) * 5 / 9;
        break;
      case 'kelvin':
        celsius = value - 273.15;
        break;
      default:
        throw ConversionException(
          'Unsupported temperature unit: ${from.canonical}',
        );
    }

    switch (to.canonical) {
      case 'celsius':
        return celsius;
      case 'fahrenheit':
        return celsius * 9 / 5 + 32;
      case 'kelvin':
        return celsius + 273.15;
      default:
        throw ConversionException(
          'Unsupported temperature unit: ${to.canonical}',
        );
    }
  }

  /// Rounds to [maxDecimals] and trims trailing zeros for a clean display,
  /// e.g. 6.211371192 -> "6.21371", 5600.0 -> "5600".
  ///
  /// A nonzero value that would round away to "0" at [maxDecimals] (e.g.
  /// 1e-8 at the default 5 decimals) switches to scientific notation instead
  /// - silently showing "0" for a real, nonzero result is never acceptable,
  /// regardless of which category/unit produced it. This is the single
  /// formatter every category (unit conversion, currency, calculator)
  /// shares, so the "never show 0 for a nonzero value" guarantee holds
  /// everywhere consistently, generically - not a per-unit special case.
  static String formatNumber(double value, {int maxDecimals = 5}) {
    if (value.isNaN || value.isInfinite) return value.toString();
    if (value == 0) return '0';

    final factor = math.pow(10, maxDecimals).toDouble();
    final rounded = (value * factor).round() / factor;

    if (rounded == 0) {
      return _formatScientific(value);
    }
    if (rounded == rounded.roundToDouble()) {
      return rounded.toStringAsFixed(0);
    }
    var s = rounded.toStringAsFixed(maxDecimals);
    s = s.replaceAll(RegExp(r'0+$'), '');
    s = s.replaceAll(RegExp(r'\.$'), '');
    return s;
  }

  /// Same "never show 0 for a nonzero value" guarantee as [formatNumber],
  /// but for the Settings "fixed decimal places" mode (trailing zeros kept,
  /// e.g. "0.00" instead of "0") - used by `formatResultDisplay`. A value
  /// that rounds to all-zero digits at [digits] still falls back to
  /// scientific notation rather than lying about the magnitude.
  static String formatFixed(double value, int digits) {
    if (value.isNaN || value.isInfinite) return value.toString();
    if (value == 0) return value.toStringAsFixed(digits);

    final factor = math.pow(10, digits).toDouble();
    final rounded = (value * factor).round() / factor;
    if (rounded == 0) return _formatScientific(value);
    return rounded.toStringAsFixed(digits);
  }

  /// Clean "1.23e-8" style scientific notation, using Dart's own correct
  /// double-to-exponential conversion (avoids float-precision edge cases a
  /// manual log10/exponent calculation could get wrong right at a power of
  /// ten) with trailing zeros trimmed from the mantissa.
  static String _formatScientific(double value) {
    final exponential = value.toStringAsExponential(5); // e.g. "1.00000e-8"
    final parts = exponential.split('e');
    var mantissa = parts[0];
    if (mantissa.contains('.')) {
      mantissa = mantissa.replaceAll(RegExp(r'0+$'), '').replaceAll(RegExp(r'\.$'), '');
    }
    final exponent = int.parse(parts[1]);
    return '${mantissa}e$exponent';
  }
}
