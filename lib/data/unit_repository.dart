import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

import '../models/unit_definition.dart';

/// Loads unit definitions from the bundled JSON asset and provides
/// alias-based lookup for the conversion engine and parser.
///
/// This is the seam where country/regional unit packs or an AI unit
/// resolver can be plugged in later without touching the engine.
class UnitRepository {
  final List<CategoryDefinition> categories;
  final Map<String, UnitDefinition> _aliasIndex;

  UnitRepository._(this.categories, this._aliasIndex);

  static const String assetPath = 'assets/data/units.json';

  static Future<UnitRepository> loadFromAssets() async {
    final raw = await rootBundle.loadString(assetPath);
    return UnitRepository.fromJsonString(raw);
  }

  factory UnitRepository.fromJsonString(String raw) {
    final decoded = jsonDecode(raw) as Map<String, dynamic>;
    final categories = (decoded['categories'] as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map(CategoryDefinition.fromJson)
        .toList();

    final index = <String, UnitDefinition>{};
    for (final category in categories) {
      for (final unit in category.units) {
        for (final alias in unit.aliases) {
          index[_normalizeKey(alias)] = unit;
        }
        index[_normalizeKey(unit.canonical)] = unit;
      }
    }
    return UnitRepository._(categories, index);
  }

  static String _normalizeKey(String raw) {
    return raw.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');
  }

  /// Resolves a raw unit token (e.g. "km", "Square Meters", "°F") to its
  /// [UnitDefinition], or `null` if unknown.
  UnitDefinition? resolve(String rawUnit) {
    final key = _normalizeKey(rawUnit);
    final direct = _aliasIndex[key];
    if (direct != null) return direct;

    // Fallback: simple plural -> singular (e.g. "kms" -> "km").
    if (key.endsWith('s') && key.length > 1) {
      final singular = _aliasIndex[key.substring(0, key.length - 1)];
      if (singular != null) return singular;
    }
    return null;
  }

  CategoryDefinition categoryById(String id) {
    return categories.firstWhere((c) => c.id == id);
  }
}
