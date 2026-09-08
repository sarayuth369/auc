/// Which plan the user is on. This alone is not enough to decide feature
/// access - see [Entitlement.isPremium], which also checks [status] and
/// expiry.
enum Plan { free, premium }

/// Mirrors Google Play's real subscription lifecycle states (RTDN /
/// subscriptionsv2), not an invented one. `active` and `gracePeriod` are the
/// only states where Play still grants entitlement; `onHold`/`paused` are
/// real Play states where access is currently suspended even though the
/// subscription isn't fully gone yet.
enum EntitlementStatus {
  inactive,
  active,
  gracePeriod,
  onHold,
  paused,
  expired,
  revoked,
  pending,
}

const Map<EntitlementStatus, String> _statusJsonValues = {
  EntitlementStatus.inactive: 'inactive',
  EntitlementStatus.active: 'active',
  EntitlementStatus.gracePeriod: 'grace_period',
  EntitlementStatus.onHold: 'on_hold',
  EntitlementStatus.paused: 'paused',
  EntitlementStatus.expired: 'expired',
  EntitlementStatus.revoked: 'revoked',
  EntitlementStatus.pending: 'pending',
};

/// The single, centralized representation of the user's subscription state.
/// Every "is the user Premium" decision in the app must go through
/// [isPremium] - never a scattered ad-hoc `plan == Plan.premium` check - so
/// the lifecycle rules (cancel-but-not-expired, grace period, offline
/// safety) are enforced in exactly one place.
class Entitlement {
  final Plan plan;
  final EntitlementStatus status;
  final DateTime? expiresAt;
  final bool autoRenewing;
  final String? productId;

  const Entitlement({
    required this.plan,
    required this.status,
    required this.expiresAt,
    required this.autoRenewing,
    required this.productId,
  });

  static const Entitlement free = Entitlement(
    plan: Plan.free,
    status: EntitlementStatus.inactive,
    expiresAt: null,
    autoRenewing: false,
    productId: null,
  );

  /// True only when ALL of:
  /// - [plan] is premium
  /// - [status] is one of Play's access-granting states (`active` or
  ///   `gracePeriod` - NOT `onHold`/`paused`/`pending`, which are real Play
  ///   states where access is currently suspended)
  /// - [expiresAt], if set, has not already passed - a safety net against
  ///   stale/offline cached state (see EntitlementService): this cache is
  ///   for UX only, never a permanent grant. Canceling auto-renew alone
  ///   does NOT flip this to false - status stays `active` and [expiresAt]
  ///   stays in the future until the real expiry, matching real Play
  ///   subscription semantics.
  bool get isPremium {
    if (plan != Plan.premium) return false;
    if (status != EntitlementStatus.active && status != EntitlementStatus.gracePeriod) {
      return false;
    }
    final expiry = expiresAt;
    if (expiry != null && !expiry.isAfter(DateTime.now())) return false;
    return true;
  }

  factory Entitlement.fromJson(Map<String, dynamic> json) {
    final planRaw = json['plan'];
    final plan = planRaw == 'premium' ? Plan.premium : Plan.free;

    final statusRaw = json['status'];
    final status = _statusJsonValues.entries
        .firstWhere(
          (e) => e.value == statusRaw,
          orElse: () => const MapEntry(EntitlementStatus.inactive, 'inactive'),
        )
        .key;

    final expiresAtRaw = json['expiresAt'];
    final expiresAt = expiresAtRaw is String ? DateTime.tryParse(expiresAtRaw) : null;

    return Entitlement(
      plan: plan,
      status: status,
      expiresAt: expiresAt,
      autoRenewing: json['autoRenewing'] == true,
      productId: json['productId'] is String ? json['productId'] as String : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'plan': plan == Plan.premium ? 'premium' : 'free',
    'status': _statusJsonValues[status],
    'expiresAt': expiresAt?.toIso8601String(),
    'autoRenewing': autoRenewing,
    'productId': productId,
  };
}
