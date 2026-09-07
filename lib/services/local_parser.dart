import '../domain/conversion_exception.dart';
import '../models/ai_intent.dart';

/// Deterministic, offline natural-language parser.
///
/// Understands patterns like:
///   "10 km to miles"
///   "72 F to C"
///   "5 feet 8 inches to cm"
///   "3 rai 2 ngan to square meters"
///
/// This never guesses unit meaning - it only extracts numbers and the
/// literal words around them. Unit resolution happens later in
/// [UnitRepository]; actual math happens in [ConversionEngine].
class LocalParser {
  static final RegExp _toSplitter = RegExp(r'\bto\b', caseSensitive: false);
  static final RegExp _pairPattern = RegExp(
    r'''(-?\d+(?:\.\d+)?)\s*([a-zA-Z°'"]+(?:\s+[a-zA-Z]+)?)''',
  );

  AiIntent parse(String input) {
    final text = input.trim();
    if (text.isEmpty) {
      throw const ConversionException('Please enter something to convert.');
    }

    final match = _toSplitter.firstMatch(text);
    if (match == null) {
      throw const ConversionException(
        'Could not understand input. Try e.g. "10 km to miles".',
      );
    }

    final left = text.substring(0, match.start);
    final right = text.substring(match.end).trim();

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
}
