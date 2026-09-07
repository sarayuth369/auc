/// AdMob configuration. Test IDs are Google's official public test
/// identifiers (safe to ship, never serve real ads, never require a real
/// AdMob account) - swap the two `*AdUnitId` values and the AndroidManifest
/// `com.google.android.gms.ads.APPLICATION_ID` meta-data for the real ones
/// once a production AdMob app/ad units exist. Nothing else needs to change.
///
/// AdMob App ID (goes in AndroidManifest, identifies the *app*) and Ad Unit
/// ID (used here, identifies one ad *placement*) are different values -
/// never mix them up.
class AdConfig {
  /// Global kill-switch: the app must work identically with this false, so
  /// ads can be turned off entirely (e.g. before a production ID exists)
  /// without touching any other code.
  static const bool adsEnabled = true;

  /// Google's official Android test banner ad unit ID.
  /// https://developers.google.com/admob/android/test-ads
  static const String bannerAdUnitId = 'ca-app-pub-3940256099942544/9214589741';
}
