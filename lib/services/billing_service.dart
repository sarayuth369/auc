/// Outcome of a billing operation. Deliberately generic (not tied to any
/// specific plugin's result types) so [BillingService] implementations stay
/// swappable.
enum BillingResultStatus { success, userCanceled, unavailable, error }

class BillingResult {
  final BillingResultStatus status;
  final String? message;
  const BillingResult(this.status, [this.message]);
}

/// A single purchasable product's store-provided display info. [formattedPrice]
/// always comes from the store at runtime (see PremiumConfig) - business
/// logic never hard-codes a price.
class BillingProduct {
  final String productId;
  final String formattedPrice;
  final String title;
  const BillingProduct({
    required this.productId,
    required this.formattedPrice,
    required this.title,
  });
}

/// Abstraction over Google Play Billing so the rest of the app (Premium
/// screen, EntitlementService) never depends on a specific billing plugin
/// directly - only this interface. Swap in a real implementation (backed by
/// `in_app_purchase`, the official Flutter/Play Billing plugin) once Google
/// Play Console products actually exist; nothing else needs to change.
abstract class BillingService {
  Future<void> initialize();
  Future<List<BillingProduct>> loadProducts(List<String> productIds);
  Future<BillingResult> purchasePremium();
  Future<BillingResult> restorePurchases();

  /// Product IDs currently owned, per the store - used to reconcile local
  /// entitlement state (e.g. after reinstall/device change), never to grant
  /// access by itself (the backend/Google Play verification step remains
  /// authoritative once wired).
  Future<List<String>> queryPurchases();

  Future<void> dispose();
}

/// Safe default while no real Google Play Billing integration exists yet
/// (no Play Console products, no signing config for a paid app flow). Every
/// operation is an honest, controlled "not available" - never a fake
/// success, so nothing downstream can mistake this for a real purchase.
class UnavailableBillingService implements BillingService {
  static const _unavailable = BillingResult(
    BillingResultStatus.unavailable,
    'Billing is not available yet.',
  );

  @override
  Future<void> initialize() async {}

  @override
  Future<List<BillingProduct>> loadProducts(List<String> productIds) async => const [];

  @override
  Future<BillingResult> purchasePremium() async => _unavailable;

  @override
  Future<BillingResult> restorePurchases() async => _unavailable;

  @override
  Future<List<String>> queryPurchases() async => const [];

  @override
  Future<void> dispose() async {}
}
