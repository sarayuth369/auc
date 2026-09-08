import 'package:flutter_test/flutter_test.dart';

import 'package:auc/models/entitlement.dart';

Entitlement _premium({
  required EntitlementStatus status,
  DateTime? expiresAt,
  bool autoRenewing = true,
}) {
  return Entitlement(
    plan: Plan.premium,
    status: status,
    expiresAt: expiresAt,
    autoRenewing: autoRenewing,
    productId: 'smartconverter_premium_monthly',
  );
}

void main() {
  final future = DateTime.now().add(const Duration(days: 10));
  final past = DateTime.now().subtract(const Duration(days: 1));

  group('Entitlement.isPremium (centralized entitlement decision)', () {
    test('FREE -> not premium (ads enabled)', () {
      expect(Entitlement.free.isPremium, isFalse);
    });

    test('PREMIUM + active, not expired -> premium (ads disabled)', () {
      expect(_premium(status: EntitlementStatus.active, expiresAt: future).isPremium, isTrue);
    });

    test('CANCELED (autoRenewing=false) but not yet expired -> premium remains', () {
      // Google Play semantics: canceling only turns off auto-renew; status
      // stays "active" until the real expiry passes.
      final e = _premium(status: EntitlementStatus.active, expiresAt: future, autoRenewing: false);
      expect(e.isPremium, isTrue);
      expect(e.autoRenewing, isFalse);
    });

    test('EXPIRED status -> free', () {
      expect(_premium(status: EntitlementStatus.expired, expiresAt: past).isPremium, isFalse);
    });

    test('active but expiresAt already passed (stale/offline cache) -> free, never a permanent grant', () {
      expect(_premium(status: EntitlementStatus.active, expiresAt: past).isPremium, isFalse);
    });

    test('RENEWED (active + pushed-out expiry) -> premium', () {
      final renewed = DateTime.now().add(const Duration(days: 40));
      expect(_premium(status: EntitlementStatus.active, expiresAt: renewed).isPremium, isTrue);
    });

    test('GRACE_PERIOD -> premium (Play still grants access during grace)', () {
      expect(_premium(status: EntitlementStatus.gracePeriod, expiresAt: future).isPremium, isTrue);
    });

    test('REVOKED -> free', () {
      expect(_premium(status: EntitlementStatus.revoked, expiresAt: future).isPremium, isFalse);
    });

    test('ON_HOLD -> free (Play suspends access during on-hold)', () {
      expect(_premium(status: EntitlementStatus.onHold, expiresAt: future).isPremium, isFalse);
    });

    test('PAUSED -> free', () {
      expect(_premium(status: EntitlementStatus.paused, expiresAt: future).isPremium, isFalse);
    });

    test('PENDING -> free (no premature entitlement before purchase completes)', () {
      expect(_premium(status: EntitlementStatus.pending, expiresAt: null).isPremium, isFalse);
    });

    test('plan=free with an otherwise-premium-shaped status never counts as premium', () {
      const e = Entitlement(
        plan: Plan.free,
        status: EntitlementStatus.active,
        expiresAt: null,
        autoRenewing: false,
        productId: null,
      );
      expect(e.isPremium, isFalse);
    });

    test('no expiresAt set (e.g. lifetime/edge case) does not block an active premium plan', () {
      expect(_premium(status: EntitlementStatus.active, expiresAt: null).isPremium, isTrue);
    });
  });

  group('Entitlement JSON round-trip', () {
    test('serializes and parses every status without loss', () {
      for (final status in EntitlementStatus.values) {
        final original = Entitlement(
          plan: Plan.premium,
          status: status,
          expiresAt: future,
          autoRenewing: true,
          productId: 'smartconverter_premium_monthly',
        );
        final roundTripped = Entitlement.fromJson(original.toJson());
        expect(roundTripped.status, status, reason: status.toString());
        expect(roundTripped.plan, Plan.premium);
        expect(roundTripped.productId, 'smartconverter_premium_monthly');
      }
    });

    test('malformed/unknown values fall back to safe defaults, never throw', () {
      final e = Entitlement.fromJson({'plan': 'nonsense', 'status': 'nonsense'});
      expect(e.plan, Plan.free);
      expect(e.status, EntitlementStatus.inactive);
      expect(e.isPremium, isFalse);
    });

    test('an empty map parses to a safe, non-premium entitlement', () {
      expect(Entitlement.fromJson(const {}).isPremium, isFalse);
    });
  });
}
