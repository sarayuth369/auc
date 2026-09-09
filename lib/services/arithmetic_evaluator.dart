import '../domain/conversion_exception.dart';

/// Shared, deterministic two-operand arithmetic evaluation - never AI, never
/// `eval()`. Used in two distinct contexts with deliberately different
/// rules for "-":
///
///  - [tryLeading]: a leading expression immediately before a unit (e.g.
///    "10/2 km"). Requires whitespace around "-" specifically, because a
///    tight "10-2" immediately followed by a unit is indistinguishable from
///    the number 10 followed by a separate negative-value item.
///  - [tryWhole]: the ENTIRE input is nothing but one arithmetic expression
///    (pure calculator mode, e.g. "10-2" with no unit at all). There is no
///    competing "separate item" interpretation once there's no unit in
///    sight, so a tight "10-2" is unambiguously subtraction here.
class ArithmeticEvaluator {
  static final RegExp _op = RegExp(r'^\s*(-?\d+(?:\.\d+)?)\s*([*/+])\s*(-?\d+(?:\.\d+)?)');
  static final RegExp _spacedMinus = RegExp(r'^\s*(-?\d+(?:\.\d+)?)\s+(-)\s+(-?\d+(?:\.\d+)?)');
  static final RegExp _tightMinus = RegExp(r'^\s*(-?\d+(?:\.\d+)?)(-)(-?\d+(?:\.\d+)?)');

  /// Matches at the START of [source] only; anything after the matched
  /// expression (e.g. a unit) is left untouched by the caller. Returns null
  /// when nothing matches (not an error - just "not arithmetic here").
  /// Throws [ConversionException] for division by zero.
  static ArithmeticMatch? tryLeading(String source) {
    final match = _op.firstMatch(source) ?? _spacedMinus.firstMatch(source);
    return match == null ? null : _evaluate(match);
  }

  /// True only when the ENTIRE trimmed [text] is one arithmetic expression
  /// with nothing left over (a genuine "pure calculator" input, not a
  /// conversion request that merely starts with one). Returns null for
  /// anything else. Throws [ConversionException] for division by zero.
  static double? tryWhole(String text) {
    final trimmed = text.trim();
    final match =
        _op.firstMatch(trimmed) ?? _spacedMinus.firstMatch(trimmed) ?? _tightMinus.firstMatch(trimmed);
    if (match == null) return null;
    final result = _evaluate(match);
    if (result == null) return null;
    if (trimmed.substring(result.consumedLength).trim().isNotEmpty) {
      return null; // trailing content (e.g. a unit) -> not pure arithmetic
    }
    return result.value;
  }

  static ArithmeticMatch? _evaluate(RegExpMatch match) {
    final left = double.tryParse(match.group(1)!);
    final op = match.group(2)!;
    final right = double.tryParse(match.group(3)!);
    if (left == null || right == null) return null;

    switch (op) {
      case '+':
        return ArithmeticMatch(left + right, match.end);
      case '-':
        return ArithmeticMatch(left - right, match.end);
      case '*':
        return ArithmeticMatch(left * right, match.end);
      case '/':
        if (right == 0) {
          throw const ConversionException('Cannot divide by zero.');
        }
        return ArithmeticMatch(left / right, match.end);
      default:
        return null;
    }
  }
}

class ArithmeticMatch {
  final double value;
  final int consumedLength;
  const ArithmeticMatch(this.value, this.consumedLength);
}
