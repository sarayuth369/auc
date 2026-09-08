import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/entitlement.dart';

/// Centralized, cached source of truth for the user's [Entitlement] - the
/// ONLY place `isPremium`-style decisions should be read from (see
/// `Entitlement.isPremium`). Mirrors `AiConfigService`'s exact cache
/// pattern: local storage for instant, offline-safe UX; never itself the
/// authority (see [refresh]).
///
/// Google Play / the backend's `GET /api/billing/entitlement` remain
/// authoritative for anything that actually grants access - this cache
/// exists so the app doesn't need a network round-trip just to decide
/// whether to render an ad on startup.
class EntitlementService {
  static const _prefsKey = 'auc_entitlement_v1';

  Future<Entitlement> getCached() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw == null) return Entitlement.free;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return Entitlement.free;
      return Entitlement.fromJson(decoded);
    } catch (_) {
      return Entitlement.free;
    }
  }

  /// Persists [entitlement] as the new cached UX state - e.g. right after a
  /// successful purchase/restore, or after a real backend refresh (once
  /// wired). Never called with an unverified/client-invented state.
  Future<void> setEntitlement(Entitlement entitlement) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, jsonEncode(entitlement.toJson()));
  }

  /// Best-effort refresh from the backend's authoritative entitlement
  /// endpoint. Intentionally a documented no-op for now: billing isn't
  /// active yet (see `PremiumConfig.billingEnabled` / `BillingService`),
  /// and calling a stub endpoint that can't actually verify anything with
  /// Google Play would be worse than not calling it - a 200 response is
  /// not the same as "verified." Wire this to `GET /api/billing/entitlement`
  /// once a real BillingService/backend verification exists; call sites
  /// (e.g. app startup, same shape as `AiConfigService.refresh`) won't need
  /// to change when that happens.
  Future<void> refresh() async {
    return;
  }
}
