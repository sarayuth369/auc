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
      throw ConversionException('Unknown unit: "${intent.targetUnit}".');
    }

    final resolvedItems = <UnitDefinition>[];
    for (final item in intent.items) {
      final unit = repository.resolve(item.unit);
      if (unit == null) {
        throw ConversionException('Unknown unit: "${item.unit}".');
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
        throw ConversionException('Unsupported temperature unit: ${from.canonical}');
    }

    switch (to.canonical) {
      case 'celsius':
        return celsius;
      case 'fahrenheit':
        return celsius * 9 / 5 + 32;
      case 'kelvin':
        return celsius + 273.15;
      default:
        throw ConversionException('Unsupported temperature unit: ${to.canonical}');
    }
  }

  /// Rounds to [maxDecimals] and trims trailing zeros for a clean display,
  /// e.g. 6.211371192 -> "6.21371", 5600.0 -> "5600".
  static String formatNumber(double value, {int maxDecimals = 5}) {
    if (value.isNaN || value.isInfinite) return value.toString();
    final factor = math.pow(10, maxDecimals).toDouble();
    final rounded = (value * factor).round() / factor;
    if (rounded == rounded.roundToDouble()) {
      return rounded.toStringAsFixed(0);
    }
    var s = rounded.toStringAsFixed(maxDecimals);
    s = s.replaceAll(RegExp(r'0+$'), '');
    s = s.replaceAll(RegExp(r'\.$'), '');
    return s;
  }
}
