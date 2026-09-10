/// Centralized Android package/store identity - never hand-typed a second
/// time in any other file. The Worker's `/api/app-config` normally supplies
/// its own `storeUrl`; this is only the fallback when that's missing.
class StoreConfig {
  static const String androidPackageId = 'com.sarayuth369.auc';

  static const String fallbackAndroidStoreUrl =
      'https://play.google.com/store/apps/details?id=$androidPackageId';
}
