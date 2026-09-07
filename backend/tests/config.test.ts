import { describe, expect, it } from 'vitest';
import { buildPublicConfig, CONFIG_VERSION } from '../src/config';

describe('buildPublicConfig', () => {
  it('returns safe defaults when no AI_* vars are set', () => {
    const config = buildPublicConfig({});
    expect(config).toEqual({
      configVersion: CONFIG_VERSION,
      ai: { enabled: true, provider: 'gemini', model: 'gemini-3.6-flash', timeoutMs: 25000 },
    });
  });

  it('honors AI_PROVIDER/AI_MODEL/AI_TIMEOUT_MS overrides', () => {
    const config = buildPublicConfig({
      AI_PROVIDER: 'openai',
      AI_MODEL: 'test-model',
      AI_TIMEOUT_MS: '9000',
    });
    expect(config.ai).toEqual({
      enabled: true,
      provider: 'openai',
      model: 'test-model',
      timeoutMs: 9000,
    });
  });

  it('AI_ENABLED=false disables AI, anything else leaves it enabled', () => {
    expect(buildPublicConfig({ AI_ENABLED: 'false' }).ai.enabled).toBe(false);
    expect(buildPublicConfig({ AI_ENABLED: 'true' }).ai.enabled).toBe(true);
    expect(buildPublicConfig({}).ai.enabled).toBe(true);
  });

  it('falls back to the legacy GEMINI_MODEL var when AI_MODEL is unset', () => {
    expect(buildPublicConfig({ GEMINI_MODEL: 'legacy-model' }).ai.model).toBe('legacy-model');
  });

  it('ignores a non-numeric or non-positive AI_TIMEOUT_MS', () => {
    expect(buildPublicConfig({ AI_TIMEOUT_MS: 'not-a-number' }).ai.timeoutMs).toBe(25000);
    expect(buildPublicConfig({ AI_TIMEOUT_MS: '-5' }).ai.timeoutMs).toBe(25000);
    expect(buildPublicConfig({ AI_TIMEOUT_MS: '0' }).ai.timeoutMs).toBe(25000);
  });

  it('never includes an API key or any secret field', () => {
    const config = buildPublicConfig({
      AI_PROVIDER: 'openai',
      AI_MODEL: 'test-model',
    } as Record<string, string>);
    const serialized = JSON.stringify(config);
    expect(serialized).not.toMatch(/key/i);
    expect(serialized).not.toMatch(/secret/i);
    expect(Object.keys(config.ai)).toEqual(['enabled', 'provider', 'model', 'timeoutMs']);
  });
});
