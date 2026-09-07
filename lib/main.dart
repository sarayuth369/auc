import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'app.dart';
import 'config/ad_config.dart';
import 'config/backend_config.dart';
import 'data/unit_repository.dart';
import 'domain/conversion_engine.dart';
import 'services/ai_resolver_service.dart';
import 'services/conversion_service.dart';
import 'services/favorites_service.dart';
import 'services/history_service.dart';
import 'services/remote_ai_resolver_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (AdConfig.adsEnabled) {
    // Best-effort: a slow/missing network or SDK hiccup here must never
    // block app startup or crash the app.
    unawaited(MobileAds.instance.initialize());
  }

  final repository = await UnitRepository.loadFromAssets();
  final conversionService = ConversionService(
    aiResolverService: MockAiResolverService(),
    conversionEngine: ConversionEngine(repository),
    remoteAiResolverService: RemoteAiResolverService(
      baseUrl: BackendConfig.baseUrl,
      timeout: BackendConfig.requestTimeout,
    ),
  );

  runApp(AucApp(
    conversionService: conversionService,
    historyService: HistoryService(),
    favoritesService: FavoritesService(),
  ));
}
