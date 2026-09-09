/// The outcome of a successful conversion, ready for display.
class ConversionResult {
  final String inputText;
  final double value;
  final String unit;
  final String formattedValue;
  final String categoryId;
  final DateTime timestamp;

  /// True only for a crypto/currency result served from a stale (expired but
  /// still-recent) cached price because the live provider was unavailable -
  /// must never be silently presented as a live/current price. Always false
  /// for every non-money category.
  final bool isStalePrice;

  ConversionResult({
    required this.inputText,
    required this.value,
    required this.unit,
    required this.formattedValue,
    required this.categoryId,
    this.isStalePrice = false,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  /// Short human-readable form, e.g. "6.21371 mile". A pure calculation
  /// result has no unit at all (see [calculationCategoryId]); the trailing
  /// space is omitted rather than shown dangling.
  String get displayText => unit.isEmpty ? formattedValue : '$formattedValue $unit';
}
