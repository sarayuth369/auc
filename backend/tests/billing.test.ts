import { describe, expect, it } from 'vitest';
import { classifyRtdn, decodeRtdnPayload, FREE_ENTITLEMENT, RTDN_NOTIFICATION_TYPE } from '../src/billing';

describe('FREE_ENTITLEMENT', () => {
  it('is a safe, non-premium default with no personal data', () => {
    expect(FREE_ENTITLEMENT).toEqual({
      plan: 'free',
      status: 'inactive',
      productId: null,
      expiresAt: null,
      autoRenewing: false,
    });
  });
});

describe('decodeRtdnPayload', () => {
  it('decodes a valid base64-encoded Pub/Sub envelope', () => {
    const payload = {
      version: '1.0',
      packageName: 'com.sarayuth369.auc',
      eventTimeMillis: '1700000000000',
      subscriptionNotification: {
        version: '1.0',
        notificationType: 4,
        purchaseToken: 'test-token',
        subscriptionId: 'smartconverter_premium_monthly',
      },
    };
    const envelope = {
      message: { data: btoa(JSON.stringify(payload)), messageId: 'm1' },
      subscription: 'projects/x/subscriptions/y',
    };
    expect(decodeRtdnPayload(envelope)).toEqual(payload);
  });

  it('never throws on malformed input - returns null instead', () => {
    expect(decodeRtdnPayload(null)).toBeNull();
    expect(decodeRtdnPayload({})).toBeNull();
    expect(decodeRtdnPayload({ message: {} })).toBeNull();
    expect(decodeRtdnPayload({ message: { data: 'not-valid-base64-json!!!' } })).toBeNull();
    expect(decodeRtdnPayload({ message: { data: btoa('not json') } })).toBeNull();
  });
});

describe('classifyRtdn', () => {
  const basePayload = {
    version: '1.0',
    packageName: 'com.sarayuth369.auc',
    eventTimeMillis: '1700000000000',
  };

  it('maps every documented Google Play RTDN notification type', () => {
    const expected = [
      [1, 'SUBSCRIPTION_RECOVERED'],
      [2, 'SUBSCRIPTION_RENEWED'],
      [3, 'SUBSCRIPTION_CANCELED'],
      [4, 'SUBSCRIPTION_PURCHASED'],
      [5, 'SUBSCRIPTION_ON_HOLD'],
      [6, 'SUBSCRIPTION_IN_GRACE_PERIOD'],
      [10, 'SUBSCRIPTION_PAUSED'],
      [12, 'SUBSCRIPTION_REVOKED'],
      [13, 'SUBSCRIPTION_EXPIRED'],
    ] as const;

    for (const [type, name] of expected) {
      const payload = {
        ...basePayload,
        subscriptionNotification: {
          version: '1.0',
          notificationType: type,
          purchaseToken: 't',
          subscriptionId: 'smartconverter_premium_monthly',
        },
      };
      expect(classifyRtdn(payload)).toBe(name);
      expect(RTDN_NOTIFICATION_TYPE[type]).toBe(name);
    }
  });

  it('returns null for a notification with no subscriptionNotification block', () => {
    expect(classifyRtdn(basePayload)).toBeNull();
  });

  it('returns null for an unrecognized notification type rather than guessing', () => {
    const payload = {
      ...basePayload,
      subscriptionNotification: {
        version: '1.0',
        notificationType: 999,
        purchaseToken: 't',
        subscriptionId: 'x',
      },
    };
    expect(classifyRtdn(payload)).toBeNull();
  });
});
