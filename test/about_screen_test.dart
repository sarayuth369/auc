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

  testWidgets('shows a Privacy Policy link when a policy URL is configured', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: AboutScreen()));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(TextButton, 'Privacy Policy'), findsOneWidget);
  });
}
