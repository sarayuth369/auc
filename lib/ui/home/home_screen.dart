import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../domain/conversion_exception.dart';
import '../../l10n/home_placeholder.dart';
import '../../models/conversion_result.dart';
import '../../models/saved_conversion.dart';
import '../../services/conversion_service.dart';
import '../../services/favorites_service.dart';
import '../../services/history_service.dart';
import '../../services/result_formatter.dart';
import '../../services/settings_service.dart';
import '../about/about_screen.dart';
import '../favorites/favorites_screen.dart';
import '../history/history_screen.dart';
import '../settings/settings_screen.dart';
import 'widgets/banner_ad_widget.dart';
import 'widgets/result_card.dart';

class HomeScreen extends StatefulWidget {
  final ConversionService conversionService;
  final HistoryService historyService;
  final FavoritesService favoritesService;
  final SettingsService settingsService;
  final ValueNotifier<ThemeMode> themeModeNotifier;

  /// Resolved once at app startup (device locale, or a cached server hint -
  /// see main.dart) - never null, never awaited here, so Home never shows a
  /// loading spinner or blank label while this is being decided.
  final String convertPlaceholder;

  const HomeScreen({
    super.key,
    required this.conversionService,
    required this.historyService,
    required this.favoritesService,
    required this.settingsService,
    required this.themeModeNotifier,
    this.convertPlaceholder = kDefaultConvertPlaceholder,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _controller = TextEditingController();
  ConversionResult? _result;
  String? _displayText;
  String? _errorText;
  bool _isClarification = false;
  bool _isFavorite = false;
  bool _isConverting = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _convert() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _isConverting = true;
      _errorText = null;
      _isClarification = false;
    });

    try {
      final result = await widget.conversionService.convert(text);
      final decimalPlaces = await widget.settingsService.getDecimalPlaces();
      final displayText = formatResultDisplay(result, decimalPlaces);

      if (await widget.settingsService.getHapticFeedback()) {
        await _triggerHapticFeedback();
      }

      if (await widget.settingsService.getSaveHistory()) {
        await widget.historyService.add(
          SavedConversion(
            id: DateTime.now().microsecondsSinceEpoch.toString(),
            inputText: result.inputText,
            resultText: displayText,
            timestamp: result.timestamp,
          ),
        );
      }

      final isFav = await widget.favoritesService.isFavorite(
        result.inputText,
        displayText,
      );

      setState(() {
        _result = result;
        _displayText = displayText;
        _isFavorite = isFav;
      });
    } on ConversionException catch (e) {
      setState(() {
        _result = null;
        _displayText = null;
        _errorText = e.message;
        _isClarification = e is ClarificationException;
      });
    } finally {
      setState(() => _isConverting = false);
    }
  }

  /// Some devices/environments don't support haptics - never let that
  /// affect the conversion result itself. A timeout guards against a
  /// platform channel that never responds at all (not just one that throws).
  Future<void> _triggerHapticFeedback() async {
    try {
      await HapticFeedback.mediumImpact().timeout(
        const Duration(milliseconds: 500),
      );
    } catch (_) {
      // Ignored.
    }
  }

  Future<void> _toggleFavorite() async {
    final r = _result;
    final displayText = _displayText;
    if (r == null || displayText == null) return;

    if (_isFavorite) {
      final all = await widget.favoritesService.getAll();
      for (final entry in all) {
        if (entry.inputText == r.inputText && entry.resultText == displayText) {
          await widget.favoritesService.remove(entry.id);
          break;
        }
      }
    } else {
      await widget.favoritesService.add(
        SavedConversion(
          id: DateTime.now().microsecondsSinceEpoch.toString(),
          inputText: r.inputText,
          resultText: displayText,
          timestamp: r.timestamp,
        ),
      );
    }
    setState(() => _isFavorite = !_isFavorite);
  }

  void _applySaved(SavedConversion entry) {
    setState(() {
      _controller.text = entry.inputText;
      _result = null;
      _displayText = null;
      _errorText = null;
      _isClarification = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SmartConverter'),
        actions: [
          IconButton(
            tooltip: 'History',
            icon: const Icon(Icons.history),
            onPressed: () async {
              final selected = await Navigator.of(context)
                  .push<SavedConversion>(
                    MaterialPageRoute(
                      builder: (_) =>
                          HistoryScreen(historyService: widget.historyService),
                    ),
                  );
              if (selected != null) _applySaved(selected);
            },
          ),
          IconButton(
            tooltip: 'Favorites',
            icon: const Icon(Icons.star),
            onPressed: () async {
              final selected = await Navigator.of(context)
                  .push<SavedConversion>(
                    MaterialPageRoute(
                      builder: (_) => FavoritesScreen(
                        favoritesService: widget.favoritesService,
                      ),
                    ),
                  );
              if (selected != null) _applySaved(selected);
            },
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'settings') {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => SettingsScreen(
                      settingsService: widget.settingsService,
                      themeModeNotifier: widget.themeModeNotifier,
                      historyService: widget.historyService,
                      favoritesService: widget.favoritesService,
                    ),
                  ),
                );
              } else if (value == 'about') {
                Navigator.of(
                  context,
                ).push(MaterialPageRoute(builder: (_) => const AboutScreen()));
              }
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: 'settings', child: Text('Settings')),
              PopupMenuItem(value: 'about', child: Text('About')),
            ],
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _controller,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _convert(),
                decoration: InputDecoration(
                  labelText: widget.convertPlaceholder,
                  hintText: 'e.g. 10 km to miles',
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _isConverting ? null : _convert,
                child: _isConverting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Convert'),
              ),
              const SizedBox(height: 16),
              ResultCard(
                result: _result,
                displayText: _displayText,
                errorText: _errorText,
                isClarification: _isClarification,
                isFavorite: _isFavorite,
                onToggleFavorite: _toggleFavorite,
              ),
            ],
          ),
        ),
      ),
      // A single banner, pinned below the fold. Renders as zero-height when
      // disabled or failed to load - never overlaps the input/result above,
      // never appears while AI is loading, never blocks conversion.
      bottomNavigationBar: const SafeArea(child: BannerAdWidget()),
    );
  }
}
