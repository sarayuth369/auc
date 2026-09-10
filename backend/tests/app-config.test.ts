import { describe, expect, it } from 'vitest';
import { buildAppUpdateConfig } from '../src/app-config';

describe('buildAppUpdateConfig', () => {
  it('defaults to the current shipped version and forceUpdate=false when no env vars are set', () => {
    const config = buildAppUpdateConfig({});
    expect(config).toEqual({
      configVersion: 1,
      app: {
        android: {
          latestVersion: '1.0.0',
          minimumSupportedVersion: '1.0.0',
          forceUpdate: false,
          storeUrl: 'https://play.google.com/store/apps/details?id=com.sarayuth369.auc',
        },
      },
    });
  });

  it('reads all fields from env vars when set', () => {
    const config = buildAppUpdateConfig({
      APP_ANDROID_LATEST_VERSION: '1.0.2',
      APP_ANDROID_MIN_SUPPORTED_VERSION: '1.0.1',
      APP_ANDROID_FORCE_UPDATE: 'true',
      APP_ANDROID_STORE_URL: 'https://example.com/store',
    });
    expect(config.app.android).toEqual({
      latestVersion: '1.0.2',
      minimumSupportedVersion: '1.0.1',
      forceUpdate: true,
      storeUrl: 'https://example.com/store',
    });
  });

  it('treats any value other than the literal string "true" as forceUpdate=false', () => {
    expect(buildAppUpdateConfig({ APP_ANDROID_FORCE_UPDATE: 'yes' }).app.android.forceUpdate).toBe(false);
    expect(buildAppUpdateConfig({ APP_ANDROID_FORCE_UPDATE: '1' }).app.android.forceUpdate).toBe(false);
    expect(buildAppUpdateConfig({ APP_ANDROID_FORCE_UPDATE: undefined }).app.android.forceUpdate).toBe(false);
  });

  it('falls back to the default when an env var is present but blank', () => {
    const config = buildAppUpdateConfig({ APP_ANDROID_LATEST_VERSION: '   ' });
    expect(config.app.android.latestVersion).toBe('1.0.0');
  });

  it('never includes secrets or credentials - only version strings and a public URL', () => {
    const config = buildAppUpdateConfig({});
    const values = Object.values(config.app.android);
    for (const value of values) {
      expect(String(value)).not.toMatch(/key|secret|token|password/i);
    }
  });
});
