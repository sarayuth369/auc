/**
 * Premium subscription architecture - foundation only. No real Google Play
 * Billing integration exists yet (no service account, no Play Console
 * products, no persistent storage) - every handler here returns an honest
 * "not implemented"/"free" answer rather than a fake success. Wiring real
 * verification requires:
 *   - a Google Cloud service account with access to the Play Developer API
 *     (stored as the GOOGLE_PLAY_SERVICE_ACCOUNT_JSON Worker secret - see
 *     wrangler.toml)
 *   - calling `purchases.subscriptionsv2.get` to authoritatively verify a
 *     purchase token (never trust a client-reported "I bought it")
 *   - a small persistent store keyed by user/purchase token to serve
 *     GET /api/billing/entitlement without re-verifying with Google on
 *     every app open (not added now - see the module doc below)
 */

/** Mirrors Flutter's EntitlementStatus (lib/models/entitlement.dart) exactly. */
export type EntitlementStatus =
  | 'inactive'
  | 'active'
  | 'grace_period'
  | 'on_hold'
  | 'paused'
  | 'expired'
  | 'revoked'
  | 'pending';

export interface NormalizedEntitlement {
  plan: 'free' | 'premium';
  status: EntitlementStatus;
  productId: string | null;
  expiresAt: string | null;
  autoRenewing: boolean;
}

export const FREE_ENTITLEMENT: NormalizedEntitlement = {
  plan: 'free',
  status: 'inactive',
  productId: null,
  expiresAt: null,
  autoRenewing: false,
};

/**
 * Google Play RTDN's real, documented `notificationType` codes (a stable
 * public API contract - safe to hard-code, not a secret). See:
 * https://developer.android.com/google/play/billing/rtdn-reference
 */
export const RTDN_NOTIFICATION_TYPE: Record<number, string> = {
  1: 'SUBSCRIPTION_RECOVERED',
  2: 'SUBSCRIPTION_RENEWED',
  3: 'SUBSCRIPTION_CANCELED',
  4: 'SUBSCRIPTION_PURCHASED',
  5: 'SUBSCRIPTION_ON_HOLD',
  6: 'SUBSCRIPTION_IN_GRACE_PERIOD',
  7: 'SUBSCRIPTION_RESTARTED',
  8: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED',
  9: 'SUBSCRIPTION_DEFERRED',
  10: 'SUBSCRIPTION_PAUSED',
  11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED',
  12: 'SUBSCRIPTION_REVOKED',
  13: 'SUBSCRIPTION_EXPIRED',
};

/** The Pub/Sub push envelope Google wraps every RTDN in. */
export interface RtdnEnvelope {
  message: { data: string; messageId: string; publishTime?: string };
  subscription?: string;
}

/** The decoded (base64 JSON) payload inside `message.data`. */
export interface RtdnPayload {
  version: string;
  packageName: string;
  eventTimeMillis: string;
  subscriptionNotification?: {
    version: string;
    notificationType: number;
    purchaseToken: string;
    subscriptionId: string;
  };
}

/**
 * Decodes an RTDN push envelope down to its notification payload. Returns
 * null (never throws) on any malformed input - RTDN delivery must never
 * crash the Worker; Google retries on non-2xx anyway, so a bad payload is
 * simply ignored rather than fought over.
 */
export function decodeRtdnPayload(envelope: unknown): RtdnPayload | null {
  if (typeof envelope !== 'object' || envelope === null) return null;
  const message = (envelope as Record<string, unknown>).message;
  if (typeof message !== 'object' || message === null) return null;
  const data = (message as Record<string, unknown>).data;
  if (typeof data !== 'string') return null;

  try {
    const decoded = atob(data);
    const parsed = JSON.parse(decoded);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as RtdnPayload;
  } catch {
    return null;
  }
}

/**
 * RTDN is only a signal that *something* changed - it is never trusted as
 * the complete subscription state by itself. The real implementation must
 * take `purchaseToken` from the decoded payload and call the Google Play
 * Developer API (subscriptionsv2.get) to fetch the authoritative current
 * state, then persist/update the normalized entitlement from THAT response
 * - never from the notification's own (mostly opaque) fields. This stub
 * only classifies the notification type so the future implementation has
 * an explicit dispatch point per lifecycle event.
 */
export function classifyRtdn(payload: RtdnPayload): string | null {
  const type = payload.subscriptionNotification?.notificationType;
  if (type === undefined) return null;
  return RTDN_NOTIFICATION_TYPE[type] ?? null;
}
