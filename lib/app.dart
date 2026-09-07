import 'package:flutter/material.dart';

import 'services/conversion_service.dart';
import 'services/favorites_service.dart';
import 'services/history_service.dart';
import 'ui/home/home_screen.dart';

class AucApp extends StatelessWidget {
  final ConversionService conversionService;
  final HistoryService historyService;
  final FavoritesService favoritesService;

  const AucApp({
    super.key,
    required this.conversionService,
    required this.historyService,
    required this.favoritesService,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AI Universal Converter',
      debugShowCheckedModeBanner: false,
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
      ),
    );
  }
}
