/**
 * Application update policy: a separate concept from config.ts's AI/runtime
 * config (/api/config). This one controls whether an installed app version
 * is still allowed to run at all - deliberately its own endpoint/schema so
 * the two are never confused (see task).
 *
 * Server is the sole source of truth for minimumSupportedVersion/
 * latestVersion/forceUpdate - Flutter only reads and compares, never writes
 * or overrides these. Values live as Worker [vars] (same pattern as
 * AI_PROVIDER/AI_MODEL in config.ts) so an emergency minimum-version bump
 * needs a `wrangler deploy`, never a new APK.
 */
export const APP_CONFIG_VERSION = 1;

export interface AndroidAppUpdatePolicy {
  latestVersion: string;
  minimumSupportedVersion: string;
  /** Master switch: false means the version check below is entirely
   *  inactive (nobody is blocked) even if minimumSupportedVersion is set -
   *  this is the fail-safe default so a routine config bump never
   *  accidentally locks out users; an operator flips this to true only
   *  when they actually intend to force an update. */
  forceUpdate: boolean;
  storeUrl: string;
}

export interface AppUpdateEnv {
  APP_ANDROID_LATEST_VERSION?: string;
  APP_ANDROID_MIN_SUPPORTED_VERSION?: string;
  APP_ANDROID_FORCE_UPDATE?: string;
  APP_ANDROID_STORE_URL?: string;
}

// Matches the applicationId in android/app/build.gradle.kts - single
// source for the fallback store URL so it's never hand-typed a second time.
const ANDROID_PACKAGE_ID = 'com.sarayuth369.auc';
const DEFAULT_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}`;

// Matches the app's current shipped version (pubspec.yaml `version:`) so an
// unconfigured/fresh deploy never blocks anyone by default.
const DEFAULT_VERSION = '1.0.0';

export function buildAppUpdateConfig(
  env: AppUpdateEnv,
): { configVersion: number; app: { android: AndroidAppUpdatePolicy } } {
  return {
    configVersion: APP_CONFIG_VERSION,
    app: {
      android: {
        latestVersion: env.APP_ANDROID_LATEST_VERSION?.trim() || DEFAULT_VERSION,
        minimumSupportedVersion: env.APP_ANDROID_MIN_SUPPORTED_VERSION?.trim() || DEFAULT_VERSION,
        forceUpdate: env.APP_ANDROID_FORCE_UPDATE === 'true',
        storeUrl: env.APP_ANDROID_STORE_URL?.trim() || DEFAULT_STORE_URL,
      },
    },
  };
}
