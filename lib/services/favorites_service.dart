import '../models/saved_conversion.dart';
import 'saved_conversion_store.dart';

/// Local-only favorite conversions, pinned by the user. No login, no sync.
class FavoritesService {
  final SavedConversionStore _store = SavedConversionStore(prefsKey: 'auc_favorites_v1');

  Future<List<SavedConversion>> getAll() => _store.loadAll();

  Future<List<SavedConversion>> add(SavedConversion entry) => _store.addToFront(entry);

  Future<List<SavedConversion>> remove(String id) => _store.remove(id);

  Future<bool> isFavorite(String inputText, String resultText) async {
    final all = await getAll();
    return all.any((e) => e.inputText == inputText && e.resultText == resultText);
  }
}
