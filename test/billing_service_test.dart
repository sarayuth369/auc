import 'package:flutter_test/flutter_test.dart';

import 'package:auc/services/billing_service.dart';

void main() {
  group('UnavailableBillingService (safe default before real Play Billing exists)', () {
    final service = UnavailableBillingService();

    test('purchasePremium never fakes a success', () async {
      final result = await service.purchasePremium();
      expect(result.status, BillingResultStatus.unavailable);
    });

    test('restorePurchases never fakes a success', () async {
      final result = await service.restorePurchases();
      expect(result.status, BillingResultStatus.unavailable);
    });

    test('loadProducts and queryPurchases return empty, never invented data', () async {
      expect(await service.loadProducts(['smartconverter_premium_monthly']), isEmpty);
      expect(await service.queryPurchases(), isEmpty);
    });

    test('initialize/dispose never throw', () async {
      await service.initialize();
      await service.dispose();
    });
  });
}
