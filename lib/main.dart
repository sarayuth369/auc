import 'package:flutter/material.dart';

import 'app.dart';
import 'data/unit_repository.dart';
import 'domain/conversion_engine.dart';
import 'services/ai_resolver_service.dart';
import 'services/conversion_service.dart';
import 'services/favorites_service.dart';
import 'services/history_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final repository = await UnitRepository.loadFromAssets();
  final conversionService = ConversionService(
    aiResolverService: MockAiResolverService(),
    conversionEngine: ConversionEngine(repository),
  );

  runApp(AucApp(
    conversionService: conversionService,
    historyService: HistoryService(),
    favoritesService: FavoritesService(),
  ));
}
