import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/saved_conversion.dart';

/// Shared local-storage plumbing for [HistoryService] and [FavoritesService].
/// Not part of the public API - both services expose their own type name
/// per the app's architecture, this just avoids duplicating JSON (de)serialization.
class SavedConversionStore {
  final String prefsKey;
  final int? maxEntries;

  SavedConversionStore({required this.prefsKey, this.maxEntries});

  Future<List<SavedConversion>> loadAll() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(prefsKey);
    if (raw == null || raw.isEmpty) return [];
    final decoded = jsonDecode(raw) as List<dynamic>;
    return decoded
        .cast<Map<String, dynamic>>()
        .map(SavedConversion.fromJson)
        .toList();
  }

  Future<void> _saveAll(List<SavedConversion> entries) async {
    final prefs = await SharedPreferences.getInstance();
    final encoded = jsonEncode(entries.map((e) => e.toJson()).toList());
    await prefs.setString(prefsKey, encoded);
  }

  Future<List<SavedConversion>> addToFront(SavedConversion entry) async {
    final entries = await loadAll();
    entries.insert(0, entry);
    final trimmed = maxEntries != null && entries.length > maxEntries!
        ? entries.sublist(0, maxEntries!)
        : entries;
    await _saveAll(trimmed);
    return trimmed;
  }

  Future<List<SavedConversion>> remove(String id) async {
    final entries = await loadAll();
    entries.removeWhere((e) => e.id == id);
    await _saveAll(entries);
    return entries;
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(prefsKey);
  }
}
