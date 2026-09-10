import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const env = { GEMINI_API_KEY: 'test-key' };

describe('GET /privacy-policy', () => {
  it('is publicly accessible with no auth and returns HTML', async () => {
    const request = new Request('https://auc-backend.example/privacy-policy');
    const response = await worker.fetch(request, env as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=UTF-8');

    const body = await response.text();
    expect(body).toContain('SmartConverter');
    expect(body).toContain('Privacy Policy');
    expect(body).toContain('MLABS');
    expect(body).not.toContain('claude.ai');
    expect(body).not.toContain(env.GEMINI_API_KEY);
  });
});

describe('regression: existing routes still work', () => {
  it('GET /health', async () => {
    const response = await worker.fetch(
      new Request('https://auc-backend.example/health'),
      env as never,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
  });

  it('GET /api/config never leaks the API key', async () => {
    const response = await worker.fetch(
      new Request('https://auc-backend.example/api/config'),
      env as never,
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).not.toContain(env.GEMINI_API_KEY);
  });

  it('GET /api/config exposes only public billing info (foundation, not active)', async () => {
    const response = await worker.fetch(
      new Request('https://auc-backend.example/api/config'),
      env as never,
    );
    const body = (await response.json()) as { billing: unknown };
    expect(body.billing).toEqual({ enabled: false, premiumProductId: 'smartconverter_premium_monthly' });
  });

  it('GET /api/app-config returns the Android update policy, separate from /api/config', async () => {
    const response = await worker.fetch(
      new Request('https://auc-backend.example/api/app-config'),
      env as never,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { configVersion: number; app: { android: unknown } };
    expect(body.configVersion).toBe(1);
    expect(body.app.android).toMatchObject({
      latestVersion: expect.any(String),
      minimumSupportedVersion: expect.any(String),
      forceUpdate: expect.any(Boolean),
      storeUrl: expect.stringContaining('play.google.com'),
    });
  });

  it('GET /api/crypto-health still works alongside the new app-config route', async () => {
    const response = await worker.fetch(
      new Request('https://auc-backend.example/api/crypto-health'),
      env as never,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { providers: unknown };
    expect(body.providers).toBeTruthy();
  });
});

describe('billing endpoints (foundation - no real verification yet)', () => {
  it('GET /api/billing/entitlement returns a safe free entitlement, never a fabricated premium grant', async () => {
    const response = await worker.fetch(
      new Request('https://auc-backend.example/api/billing/entitlement'),
      env as never,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      plan: 'free',
      status: 'inactive',
      productId: null,
      expiresAt: null,
      autoRenewing: false,
    });
  });

  it('POST /api/billing/verify honestly reports not-implemented rather than faking verification', async () => {
    const response = await worker.fetch(
      new Request('https://auc-backend.example/api/billing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseToken: 'whatever' }),
      }),
      env as never,
    );
    expect(response.status).toBe(501);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, error: { code: 'NOT_IMPLEMENTED' } });
  });

  it('POST /api/billing/rtdn always acks 2xx (required by Pub/Sub push) and never crashes on malformed input', async () => {
    const malformed = await worker.fetch(
      new Request('https://auc-backend.example/api/billing/rtdn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      env as never,
    );
    expect(malformed.status).toBe(200);

    const wellFormed = await worker.fetch(
      new Request('https://auc-backend.example/api/billing/rtdn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            data: btoa(
              JSON.stringify({
                version: '1.0',
                packageName: 'com.sarayuth369.auc',
                eventTimeMillis: '1700000000000',
                subscriptionNotification: {
                  version: '1.0',
                  notificationType: 4,
                  purchaseToken: 't',
                  subscriptionId: 'smartconverter_premium_monthly',
                },
              }),
            ),
            messageId: 'm1',
          },
        }),
      }),
      env as never,
    );
    expect(wellFormed.status).toBe(200);
    expect(await wellFormed.json()).toEqual({ ok: true });
  });
});
