import '../models/saved_conversion.dart';
import 'saved_conversion_store.dart';

/// Local-only conversion history (most recent first). No login, no sync.
class HistoryService {
  static const int _maxEntries = 50;

  final SavedConversionStore _store = SavedConversionStore(
    prefsKey: 'auc_history_v1',
    maxEntries: _maxEntries,
  );

  Future<List<SavedConversion>> getAll() => _store.loadAll();

  Future<List<SavedConversion>> add(SavedConversion entry) =>
      _store.addToFront(entry);

  Future<List<SavedConversion>> remove(String id) => _store.remove(id);

  Future<void> clear() => _store.clear();
}
