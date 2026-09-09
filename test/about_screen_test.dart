import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:auc/ui/about/about_screen.dart';

void main() {
  testWidgets(
    'renders professional product copy, not developer/debug wording',
    (WidgetTester tester) async {
      await tester.pumpWidget(const MaterialApp(home: AboutScreen()));
      await tester.pumpAndSettle();

      expect(find.text('SmartConverter'), findsOneWidget);
      expect(find.text('AI Universal Converter'), findsOneWidget);
      expect(
        find.textContaining('AI-powered universal converter'),
        findsOneWidget,
      );
      expect(find.text('Features'), findsOneWidget);
      expect(find.text('Natural-language conversion'), findsOneWidget);
      expect(find.text('How it works'), findsOneWidget);
      expect(find.text('Developed by MLABS'), findsOneWidget);
      expect(find.text('Version 1.0.0'), findsOneWidget);

      // Must read as a product page, not internal engineering language.
      expect(find.textContaining('intent parsing'), findsNothing);
      expect(
        find.textContaining('deterministic conversion engine'),
        findsNothing,
      );

      // Must not overclaim.
      expect(find.textContaining('100% accur'), findsNothing);
      expect(find.textContaining('every language'), findsNothing);
      expect(find.textContaining('every unit'), findsNothing);
      expect(find.textContaining('guaranteed'), findsNothing);
    },
  );

  testWidgets(
    'Features cover currency, crypto, calculator, and AI-assisted capabilities (not just plain unit conversion)',
    (WidgetTester tester) async {
      await tester.pumpWidget(const MaterialApp(home: AboutScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Global fiat currency conversion'), findsOneWidget);
      expect(find.text('Cryptocurrency conversion'), findsOneWidget);
      expect(find.text('Smart calculations'), findsOneWidget);
      expect(find.text('Scientific & engineering units'), findsOneWidget);
      expect(find.text('Regional & local units'), findsOneWidget);
      expect(find.text('Multilingual AI understanding'), findsOneWidget);
      expect(find.text('AI-assisted unfamiliar units & requests'), findsOneWidget);
      expect(find.text('Fast local conversion'), findsOneWidget);
      expect(find.text('History & favorites'), findsOneWidget);
    },
  );

  testWidgets(
    'never reads as a trading/investment product - it is a converter only',
    (WidgetTester tester) async {
      await tester.pumpWidget(const MaterialApp(home: AboutScreen()));
      await tester.pumpAndSettle();

      expect(find.textContaining('trading'), findsNothing);
      expect(find.textContaining('invest'), findsNothing);
      expect(find.textContaining('portfolio'), findsNothing);
      expect(find.textContaining('financial advis'), findsNothing);
      // Currency/crypto rates are current, not a streaming real-time feed -
      // must not overclaim "live"/"real-time".
      expect(find.textContaining('live exchange'), findsNothing);
      expect(find.textContaining('real-time'), findsNothing);
    },
  );

  testWidgets(
    'is honest that only SOME conversions are local (currency/crypto need external rates)',
    (WidgetTester tester) async {
      await tester.pumpWidget(const MaterialApp(home: AboutScreen()));
      await tester.pumpAndSettle();

      expect(find.textContaining('Everyday and scientific unit conversions are calculated locally'), findsOneWidget);
      expect(find.textContaining('external sources'), findsOneWidget);
    },
  );

  testWidgets('shows a Privacy Policy link when a policy URL is configured', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: AboutScreen()));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(TextButton, 'Privacy Policy'), findsOneWidget);
  });
}
