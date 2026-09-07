/// A single convertible unit within a [CategoryDefinition].
///
/// For most categories, converting to the category's base unit is a plain
/// multiplication by [factor]. Temperature units have no linear factor and
/// are handled with explicit formulas in the conversion engine instead.
class UnitDefinition {
  final String canonical;
  final String symbol;
  final List<String> aliases;
  final double? factor;
  final String categoryId;
  final bool isSpecial;

  const UnitDefinition({
    required this.canonical,
    required this.symbol,
    required this.aliases,
    required this.categoryId,
    required this.isSpecial,
    this.factor,
  });

  factory UnitDefinition.fromJson(
    Map<String, dynamic> json, {
    required String categoryId,
    required bool isSpecial,
  }) {
    final canonical = json['canonical'] as String;
    return UnitDefinition(
      canonical: canonical,
      symbol: json['symbol'] as String? ?? canonical,
      aliases: (json['aliases'] as List<dynamic>).cast<String>(),
      categoryId: categoryId,
      isSpecial: isSpecial,
      factor: (json['factor'] as num?)?.toDouble(),
    );
  }
}

/// A category of units (length, area, weight, ...) that share a base unit.
class CategoryDefinition {
  final String id;
  final String name;
  final String baseUnit;
  final bool isSpecial;
  final List<UnitDefinition> units;

  const CategoryDefinition({
    required this.id,
    required this.name,
    required this.baseUnit,
    required this.isSpecial,
    required this.units,
  });

  factory CategoryDefinition.fromJson(Map<String, dynamic> json) {
    final id = json['id'] as String;
    final isSpecial = json['special'] as bool? ?? false;
    final units = (json['units'] as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map((u) => UnitDefinition.fromJson(u, categoryId: id, isSpecial: isSpecial))
        .toList();
    return CategoryDefinition(
      id: id,
      name: json['name'] as String,
      baseUnit: json['base_unit'] as String,
      isSpecial: isSpecial,
      units: units,
    );
  }
}
