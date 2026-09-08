import 'package:flutter/material.dart';

import 'l10n/home_placeholder.dart';
import 'services/conversion_service.dart';
import 'services/favorites_service.dart';
import 'services/history_service.dart';
import 'services/settings_service.dart';
import 'ui/home/home_screen.dart';

class AucApp extends StatelessWidget {
  final ConversionService conversionService;
  final HistoryService historyService;
  final FavoritesService favoritesService;
  final SettingsService settingsService;
  final ValueNotifier<ThemeMode> themeModeNotifier;
  final String convertPlaceholder;

  const AucApp({
    super.key,
    required this.conversionService,
    required this.historyService,
    required this.favoritesService,
    required this.settingsService,
    required this.themeModeNotifier,
    this.convertPlaceholder = kDefaultConvertPlaceholder,
  });

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeModeNotifier,
      builder: (context, themeMode, _) {
        return MaterialApp(
          title: 'SmartConverter',
          debugShowCheckedModeBanner: false,
          themeMode: themeMode,
          theme: ThemeData(
            colorSchemeSeed: Colors.indigo,
            useMaterial3: true,
            brightness: Brightness.light,
          ),
          darkTheme: ThemeData(
            colorSchemeSeed: Colors.indigo,
            useMaterial3: true,
            brightness: Brightness.dark,
          ),
          home: HomeScreen(
            conversionService: conversionService,
            historyService: historyService,
            favoritesService: favoritesService,
            settingsService: settingsService,
            themeModeNotifier: themeModeNotifier,
            convertPlaceholder: convertPlaceholder,
          ),
        );
      },
    );
  }
}
