/// The outcome of a successful conversion, ready for display.
class ConversionResult {
  final String inputText;
  final double value;
  final String unit;
  final String formattedValue;
  final String categoryId;
  final DateTime timestamp;

  ConversionResult({
    required this.inputText,
    required this.value,
    required this.unit,
    required this.formattedValue,
    required this.categoryId,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  /// Short human-readable form, e.g. "6.21371 mile".
  String get displayText => '$formattedValue $unit';
}
