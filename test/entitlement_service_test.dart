import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:auc/models/entitlement.dart';
import 'package:auc/services/entitlement_service.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('getCached returns free when nothing has been cached', () async {
    final service = EntitlementService();
    final entitlement = await service.getCached();
    expect(entitlement.isPremium, isFalse);
    expect(entitlement.plan, Plan.free);
  });

  test('setEntitlement caches the given state for a later getCached()', () async {
    final service = EntitlementService();
    final future = DateTime.now().add(const Duration(days: 5));
    await service.setEntitlement(
      Entitlement(
        plan: Plan.premium,
        status: EntitlementStatus.active,
        expiresAt: future,
        autoRenewing: true,
        productId: 'smartconverter_premium_monthly',
      ),
    );

    final cached = await service.getCached();
    expect(cached.isPremium, isTrue);
    expect(cached.productId, 'smartconverter_premium_monthly');
  });

  test('a fresh app start (new service instance) reuses the same cached entitlement', () async {
    final first = EntitlementService();
    await first.setEntitlement(
      Entitlement(
        plan: Plan.premium,
        status: EntitlementStatus.gracePeriod,
        expiresAt: DateTime.now().add(const Duration(days: 3)),
        autoRenewing: true,
        productId: 'smartconverter_premium_monthly',
      ),
    );

    final second = EntitlementService();
    final cached = await second.getCached();
    expect(cached.isPremium, isTrue);
    expect(cached.status, EntitlementStatus.gracePeriod);
  });

  test('an expired cached entitlement never grants Premium, even across app restarts', () async {
    final service = EntitlementService();
    await service.setEntitlement(
      Entitlement(
        plan: Plan.premium,
        status: EntitlementStatus.active,
        expiresAt: DateTime.now().subtract(const Duration(days: 1)),
        autoRenewing: false,
        productId: 'smartconverter_premium_monthly',
      ),
    );

    // Simulates reopening the app with the same on-disk cache - offline
    // safety must not create a permanent-Premium loophole (see task section
    // 11 / Entitlement.isPremium).
    final reopened = EntitlementService();
    expect((await reopened.getCached()).isPremium, isFalse);
  });

  test('refresh() is a documented no-op for now and never throws (billing not active yet)', () async {
    final service = EntitlementService();
    await service.refresh();
    // Reaching this line means it didn't throw; cache is untouched.
    expect((await service.getCached()).isPremium, isFalse);
  });
}
