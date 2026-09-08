import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:auc/models/entitlement.dart';
import 'package:auc/services/billing_service.dart';
import 'package:auc/services/entitlement_service.dart';
import 'package:auc/services/favorites_service.dart';
import 'package:auc/services/history_service.dart';
import 'package:auc/services/settings_service.dart';
import 'package:auc/ui/premium/premium_screen.dart';
import 'package:auc/ui/settings/settings_screen.dart';

Widget _wrap(Widget child) => MaterialApp(home: child);

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('Settings -> Premium navigation', () {
    testWidgets('the Premium promo card is visible and navigates to PremiumScreen', (
      tester,
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

      expect(find.text('SmartConverter Premium'), findsOneWidget);
      expect(find.text('UPGRADE NOW'), findsOneWidget);

      await tester.ensureVisible(find.text('SmartConverter Premium'));
      await tester.tap(find.text('SmartConverter Premium'));
      await tester.pumpAndSettle();

      expect(find.byType(PremiumScreen), findsOneWidget);
    });
  });

  group('PremiumScreen - Free state', () {
    testWidgets('shows the Free vs Premium comparison and an Upgrade CTA, "No ads" only under Premium', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          PremiumScreen(
            entitlementService: EntitlementService(),
            billingService: UnavailableBillingService(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Free'), findsOneWidget);
      expect(find.text('For power users'), findsOneWidget); // Premium card heading
      expect(find.text('Includes ads'), findsOneWidget);
      // "No ads" must appear exactly once, under the Premium card only.
      expect(find.text('No ads'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Upgrade to Premium'), findsOneWidget);
      expect(find.text('Premium Active'), findsNothing);
    });

    testWidgets('tapping Upgrade surfaces the honest "not available yet" message', (tester) async {
      await tester.pumpWidget(
        _wrap(
          PremiumScreen(
            entitlementService: EntitlementService(),
            billingService: UnavailableBillingService(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final upgradeButton = find.widgetWithText(FilledButton, 'Upgrade to Premium');
      await tester.ensureVisible(upgradeButton);
      await tester.tap(upgradeButton);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Billing is not available yet.'), findsOneWidget);
    });
  });

  group('PremiumScreen - Active state', () {
    testWidgets('shows Premium Active with renewal date and no Upgrade CTA', (tester) async {
      final entitlementService = EntitlementService();
      await entitlementService.setEntitlement(
        Entitlement(
          plan: Plan.premium,
          status: EntitlementStatus.active,
          expiresAt: DateTime(2030, 6, 15),
          autoRenewing: true,
          productId: 'smartconverter_premium_monthly',
        ),
      );

      await tester.pumpWidget(
        _wrap(
          PremiumScreen(
            entitlementService: entitlementService,
            billingService: UnavailableBillingService(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Premium Active'), findsOneWidget);
      expect(find.textContaining('Renews: 2030-06-15'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Upgrade to Premium'), findsNothing);
      expect(find.widgetWithText(OutlinedButton, 'Manage Subscription'), findsOneWidget);
    });

    testWidgets('canceled but not expired shows "Ends:" and Auto-renew: Off, Premium remains active', (
      tester,
    ) async {
      final entitlementService = EntitlementService();
      await entitlementService.setEntitlement(
        Entitlement(
          plan: Plan.premium,
          status: EntitlementStatus.active,
          expiresAt: DateTime(2030, 1, 1),
          autoRenewing: false,
          productId: 'smartconverter_premium_monthly',
        ),
      );

      await tester.pumpWidget(
        _wrap(
          PremiumScreen(
            entitlementService: entitlementService,
            billingService: UnavailableBillingService(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Premium Active'), findsOneWidget);
      expect(find.textContaining('Ends: 2030-01-01'), findsOneWidget);
      expect(find.textContaining('Auto-renew: Off'), findsOneWidget);
    });
  });

  group('PremiumScreen - Expired state', () {
    testWidgets('shows the ended-subscription banner and falls back to the Free comparison', (
      tester,
    ) async {
      final entitlementService = EntitlementService();
      await entitlementService.setEntitlement(
        Entitlement(
          plan: Plan.premium,
          status: EntitlementStatus.expired,
          expiresAt: DateTime(2020, 1, 1),
          autoRenewing: false,
          productId: 'smartconverter_premium_monthly',
        ),
      );

      await tester.pumpWidget(
        _wrap(
          PremiumScreen(
            entitlementService: entitlementService,
            billingService: UnavailableBillingService(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Your Premium subscription has ended. Ads are enabled.'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Upgrade to Premium'), findsOneWidget);
      expect(find.text('Premium Active'), findsNothing);
    });
  });
}
