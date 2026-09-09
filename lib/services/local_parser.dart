import '../domain/conversion_exception.dart';
import '../models/ai_intent.dart';
import 'arithmetic_evaluator.dart';

/// Deterministic, offline natural-language parser.
///
/// Understands patterns like:
///   "10 km to miles"
///   "10 km = m"
///   "10 km = m ?"
///   "72 F to C"
///   "5 feet 8 inches to cm"
///   "3 rai 2 ngan to square meters"
///   "1 ไร่ to square meters"
///   "10 วา เป็นกี่เมตร"
///   "3 ไร่ 2 งาน เป็นกี่ตารางเมตร"
///   "1 กิโลกรัม เท่ากับกี่ออนซ์"
///   "1 กิโลกรัม แปลงเป็นออนซ์"
///   "1 กิโลกรัม กี่ออนซ์"
///   "10/2 km = m" (arithmetic resolved before unit lookup)
///   "10 kilometer per hour to m/s" (multi-word compound alias)
///
/// This never guesses unit meaning - it only extracts numbers/expressions
/// and the literal words around them (Thai script included). Unit
/// resolution happens later in [UnitRepository]; actual math (both the
/// arithmetic reduction below and the unit conversion) is deterministic
/// code, never AI.
class LocalParser {
  // English "to"/"=" /"→" (word boundary where relevant) or a Thai connector
  // phrase: "เป็นกี่" ("is how many"), "เท่ากับกี่" ("equals how many"),
  // "แปลงเป็น" ("convert to"), or bare "กี่" ("how many"). Thai script has no
  // \w-based word boundary in Dart's regex engine, so these are matched as
  // plain literals; longer/more specific phrases are listed first, though
  // regex's leftmost-match rule means order only matters for documentation
  // clarity here (each phrase starts at a distinct position in real input).
  static final RegExp _toSplitter = RegExp(
    r'\bto\b|=|→|เท่ากับกี่|เป็นกี่|แปลงเป็น|กี่',
    caseSensitive: false,
  );

  // Unit tokens may be Latin letters, Thai script (U+0E00-U+0E7F), the
  // degree sign, quote marks (for ' / " feet-inches shorthand), or a slash
  // (for compound units like "BTU/h", "km/h"). Up to two extra
  // space-separated words are allowed so 3-word compound aliases like
  // "kilometer per hour" / "meters per second" are captured whole instead
  // of being truncated to the first two words.
  static final RegExp _pairPattern = RegExp(
    r'''(-?\d+(?:\.\d+)?)\s*([a-zA-Z฀-๿°'"/]+(?:\s+[a-zA-Z฀-๿]+){0,2})''',
  );

  AiIntent parse(String input) {
    final text = input.trim();
    if (text.isEmpty) {
      throw const ConversionException('Please enter something to convert.');
    }

    final match = _toSplitter.firstMatch(text);
    if (match == null) {
      throw const ConversionException(
        'Could not understand input. Try e.g. "10 km to miles" or "10 km = m".',
      );
    }

    final left = _resolveArithmetic(text.substring(0, match.start));
    final right = text
        .substring(match.end)
        .trim()
        // Trailing "?" (ASCII or full-width) is a natural way to end a
        // short command ("10 km = m ?") and carries no meaning for the
        // target unit itself.
        .replaceAll(RegExp(r'[?？]+$'), '')
        .trim();

    if (right.isEmpty) {
      throw const ConversionException('Missing target unit after "to".');
    }

    final items = <ConversionItem>[];
    for (final m in _pairPattern.allMatches(left)) {
      final value = double.tryParse(m.group(1)!);
      final unit = m.group(2)?.trim();
      if (value == null || unit == null || unit.isEmpty) continue;
      items.add(ConversionItem(value: value, unit: unit));
    }

    if (items.isEmpty) {
      throw const ConversionException(
        'No quantity found. Try e.g. "10 km to miles".',
      );
    }

    return AiIntent(intent: 'convert', items: items, targetUnit: right);
  }

  /// Reduces a leading arithmetic expression (see [ArithmeticEvaluator]) to
  /// its computed value, e.g. "10/2 km" -> "5 km". Deterministic arithmetic
  /// only - never sent to AI. Only the FIRST such expression at the very
  /// start of [source] is reduced (a single quantity, not a general
  /// calculator), leaving the rest of the string (the unit) untouched for
  /// the normal pair extraction above.
  String _resolveArithmetic(String source) {
    final match = ArithmeticEvaluator.tryLeading(source);
    if (match == null) return source;
    return match.value.toString() + source.substring(match.consumedLength);
  }
}
