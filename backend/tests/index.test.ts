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
});
