/// A single quantity extracted from natural language input, e.g. the "3 rai"
/// in "3 rai 2 ngan to square meters".
class ConversionItem {
  final double value;
  final String unit;

  const ConversionItem({required this.value, required this.unit});

  Map<String, dynamic> toJson() => {'value': value, 'unit': unit};
}

/// Structured intent describing what the user wants converted.
///
/// This is the contract between the intent-understanding layer
/// ([LocalParser] / `AiResolverService`) and the deterministic
/// [ConversionEngine] that performs the math.
class AiIntent {
  final String intent;
  final List<ConversionItem> items;
  final String targetUnit;

  const AiIntent({
    required this.intent,
    required this.items,
    required this.targetUnit,
  });

  Map<String, dynamic> toJson() => {
    'intent': intent,
    'items': items.map((i) => i.toJson()).toList(),
    'target_unit': targetUnit,
  };
}
