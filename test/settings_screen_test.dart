import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:auc/models/saved_conversion.dart';
import 'package:auc/services/favorites_service.dart';
import 'package:auc/services/history_service.dart';
import 'package:auc/services/settings_service.dart';
import 'package:auc/ui/settings/settings_screen.dart';

Widget _wrap(Widget child) => MaterialApp(home: child);

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets(
    'selecting Dark persists the choice and updates the theme notifier',
    (WidgetTester tester) async {
      final settingsService = SettingsService();
      final themeModeNotifier = ValueNotifier(ThemeMode.system);

      await tester.pumpWidget(
        _wrap(
          SettingsScreen(
            settingsService: settingsService,
            themeModeNotifier: themeModeNotifier,
            historyService: HistoryService(),
            favoritesService: FavoritesService(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(RadioListTile<ThemeMode>, 'Dark'));
      await tester.pumpAndSettle();

      expect(themeModeNotifier.value, ThemeMode.dark);
      expect(await settingsService.getThemeMode(), ThemeMode.dark);
    },
  );

  testWidgets('selecting a fixed decimal-places option persists it', (
    WidgetTester tester,
  ) async {
    final settingsService = SettingsService();

    await tester.pumpWidget(
      _wrap(
        SettingsScreen(
          settingsService: settingsService,
          themeModeNotifier: ValueNotifier(ThemeMode.system),
          historyService: HistoryService(),
          favoritesService: FavoritesService(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(RadioListTile<DecimalPlaces>, '4'));
    await tester.pumpAndSettle();

    expect(await settingsService.getDecimalPlaces(), DecimalPlaces.four);
  });

  testWidgets(
    'Clear History asks for confirmation and only clears on confirm',
    (WidgetTester tester) async {
      final historyService = HistoryService();
      await historyService.add(
        SavedConversion(
          id: '1',
          inputText: '10 km to miles',
          resultText: '6.21371 mi',
          timestamp: DateTime.now(),
        ),
      );

      await tester.pumpWidget(
        _wrap(
          SettingsScreen(
            settingsService: SettingsService(),
            themeModeNotifier: ValueNotifier(ThemeMode.system),
            historyService: historyService,
            favoritesService: FavoritesService(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Clear History'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Clear History'));
      await tester.pumpAndSettle();
      expect(find.text('Clear all conversion history?'), findsOneWidget);

      // Cancel leaves the data intact.
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(await historyService.getAll(), hasLength(1));

      // Confirming actually clears it.
      await tester.tap(find.text('Clear History'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Clear'));
      await tester.pumpAndSettle();
      expect(await historyService.getAll(), isEmpty);
    },
  );

  testWidgets(
    'Clear Favorites asks for confirmation and only clears on confirm',
    (WidgetTester tester) async {
      final favoritesService = FavoritesService();
      await favoritesService.add(
        SavedConversion(
          id: '1',
          inputText: '10 km to miles',
          resultText: '6.21371 mi',
          timestamp: DateTime.now(),
        ),
      );

      await tester.pumpWidget(
        _wrap(
          SettingsScreen(
            settingsService: SettingsService(),
            themeModeNotifier: ValueNotifier(ThemeMode.system),
            historyService: HistoryService(),
            favoritesService: favoritesService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Clear Favorites'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Clear Favorites'));
      await tester.pumpAndSettle();
      expect(find.text('Clear all favorites?'), findsOneWidget);

      await tester.tap(find.text('Clear'));
      await tester.pumpAndSettle();
      expect(await favoritesService.getAll(), isEmpty);
    },
  );

  testWidgets(
    'toggling haptic feedback and save-history switches persists them',
    (WidgetTester tester) async {
      final settingsService = SettingsService();

      await tester.pumpWidget(
        _wrap(
          SettingsScreen(
            settingsService: settingsService,
            themeModeNotifier: ValueNotifier(ThemeMode.system),
            historyService: HistoryService(),
            favoritesService: FavoritesService(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final hapticTile = find.widgetWithText(SwitchListTile, 'Haptic feedback');
      await tester.ensureVisible(hapticTile);
      await tester.pumpAndSettle();
      await tester.tap(hapticTile);
      await tester.pumpAndSettle();
      expect(await settingsService.getHapticFeedback(), false);

      final saveHistoryTile = find.widgetWithText(
        SwitchListTile,
        'Save conversion history',
      );
      await tester.ensureVisible(saveHistoryTile);
      await tester.pumpAndSettle();
      await tester.tap(saveHistoryTile);
      await tester.pumpAndSettle();
      expect(await settingsService.getSaveHistory(), false);
    },
  );

  testWidgets('About SmartConverter navigates to the About screen', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        SettingsScreen(
          settingsService: SettingsService(),
          themeModeNotifier: ValueNotifier(ThemeMode.system),
          historyService: HistoryService(),
          favoritesService: FavoritesService(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('About SmartConverter'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('About SmartConverter'));
    await tester.pumpAndSettle();

    expect(find.text('AI Universal Converter'), findsOneWidget);
    expect(
      find.text('Developed by MLABS', skipOffstage: false),
      findsOneWidget,
    );
  });
}
