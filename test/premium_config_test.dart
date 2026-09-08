import 'package:flutter_test/flutter_test.dart';

import 'package:auc/config/premium_config.dart';

void main() {
  test('premium product ID is the expected Google Play subscription ID', () {
    expect(PremiumConfig.premiumMonthlyProductId, 'smartconverter_premium_monthly');
  });

  test('billing stays disabled until a real Play Billing integration exists', () {
    expect(PremiumConfig.billingEnabled, isFalse);
  });
}
