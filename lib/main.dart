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
  // Guards the entire startup sequence: an uncaught error anywhere here
  // (including an async one from ad-SDK init, below) must never take down
  // the whole app before it even gets a chance to show its own error UI.
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();

    if (AdConfig.adsEnabled) {
      unawaited(_initializeAdsSafely());
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
  }, (error, stackTrace) {
    // Last-resort net: never let a stray error crash the app silently.
  });
}

/// A slow/missing network, outdated Play Services, or any other ad-SDK
/// hiccup must never block app startup or crash the app - conversion works
/// with or without ads.
Future<void> _initializeAdsSafely() async {
  try {
    await MobileAds.instance.initialize();
  } catch (_) {
    // Ignored: ads simply won't show; nothing else depends on this.
  }
}
