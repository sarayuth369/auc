/// Centralized Premium product configuration.
///
/// Price is deliberately never hard-coded here (or anywhere in business
/// logic) - actual pricing (target concept: ~THB 39/month) is configured in
/// Google Play Console and only ever surfaced at runtime via
/// `BillingService.loadProducts`' store-provided formatted price.
class PremiumConfig {
  /// Google Play subscription product ID for the monthly Premium plan.
  static const String premiumMonthlyProductId = 'smartconverter_premium_monthly';

  /// Global kill-switch, mirroring [AdConfig.adsEnabled]'s pattern: false
  /// until a real [BillingService] implementation and Google Play Console
  /// products actually exist. The rest of the app must consult this (or,
  /// more precisely, `EntitlementService`/`Entitlement.isPremium`) rather
  /// than assuming billing is live.
  static const bool billingEnabled = false;
}
