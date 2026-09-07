/// Placeholder abstraction for future AdMob integration.
///
/// Phase 1.1 does not show real ads and carries no App ID / Ad Unit ID.
/// This exists only so the rest of the app can depend on a stable
/// interface once ads are wired in.
abstract class AdService {
  Future<void> loadBanner();
  Future<void> showInterstitial();
}

/// No-op implementation used while ads are not yet enabled.
class NoOpAdService implements AdService {
  @override
  Future<void> loadBanner() async {}

  @override
  Future<void> showInterstitial() async {}
}
