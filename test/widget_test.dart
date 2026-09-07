import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:auc/app.dart';
import 'package:auc/data/unit_repository.dart';
import 'package:auc/domain/conversion_engine.dart';
import 'package:auc/services/ai_resolver_service.dart';
import 'package:auc/services/conversion_service.dart';
import 'package:auc/services/favorites_service.dart';
import 'package:auc/services/history_service.dart';

void main() {
  late UnitRepository repository;

  setUpAll(() async {
    repository = await UnitRepository.loadFromAssets();
  });

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  ConversionService buildConversionService() => ConversionService(
        aiResolverService: MockAiResolverService(),
        conversionEngine: ConversionEngine(repository),
      );

  testWidgets('convert "10 km to miles" shows the result on the home screen',
      (WidgetTester tester) async {
    await tester.pumpWidget(AucApp(
      conversionService: buildConversionService(),
      historyService: HistoryService(),
      favoritesService: FavoritesService(),
    ));

    expect(find.text('AI Universal Converter'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '10 km to miles');
    await tester.tap(find.widgetWithText(FilledButton, 'Convert'));
    await tester.pumpAndSettle();

    expect(find.text('6.21371 mi'), findsOneWidget);
  });

  testWidgets('unknown unit shows an error message', (WidgetTester tester) async {
    await tester.pumpWidget(AucApp(
      conversionService: buildConversionService(),
      historyService: HistoryService(),
      favoritesService: FavoritesService(),
    ));

    await tester.enterText(find.byType(TextField), '10 km to zzz');
    await tester.tap(find.widgetWithText(FilledButton, 'Convert'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Unknown unit'), findsOneWidget);
  });
}
