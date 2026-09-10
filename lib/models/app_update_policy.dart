import '../config/store_config.dart';

/// The server's Android update policy (`GET /api/app-config`, `app.android`
/// - deliberately a separate concept/schema from AiConfig's `/api/config`).
/// Server is the source of truth; this class only parses and validates,
/// never invents a stricter or looser policy than what the server sent.
class AppUpdatePolicy {
  final String latestVersion;
  final String minimumSupportedVersion;
  final bool forceUpdate;
  final String storeUrl;

  const AppUpdatePolicy({
    required this.latestVersion,
    required this.minimumSupportedVersion,
    required this.forceUpdate,
    required this.storeUrl,
  });

  /// Throws (never silently substitutes a wrong value) if the payload is
  /// missing or has the wrong shape - the caller decides what to do on
  /// failure (fall back to a cached policy, or treat as "no policy").
  factory AppUpdatePolicy.fromJson(Map<String, dynamic> json) {
    final android = (json['app'] as Map?)?['android'];
    if (android is! Map) {
      throw const FormatException('app-config response missing app.android.');
    }
    final latestVersion = android['latestVersion'];
    final minimumSupportedVersion = android['minimumSupportedVersion'];
    final forceUpdate = android['forceUpdate'];
    if (latestVersion is! String || latestVersion.trim().isEmpty) {
      throw const FormatException('app-config missing latestVersion.');
    }
    if (minimumSupportedVersion is! String || minimumSupportedVersion.trim().isEmpty) {
      throw const FormatException('app-config missing minimumSupportedVersion.');
    }
    if (forceUpdate is! bool) {
      throw const FormatException('app-config missing forceUpdate.');
    }
    final storeUrl = android['storeUrl'];
    return AppUpdatePolicy(
      latestVersion: latestVersion,
      minimumSupportedVersion: minimumSupportedVersion,
      forceUpdate: forceUpdate,
      storeUrl: (storeUrl is String && storeUrl.trim().isNotEmpty)
          ? storeUrl
          : StoreConfig.fallbackAndroidStoreUrl,
    );
  }

  Map<String, dynamic> toCacheJson() => {
    'app': {
      'android': {
        'latestVersion': latestVersion,
        'minimumSupportedVersion': minimumSupportedVersion,
        'forceUpdate': forceUpdate,
        'storeUrl': storeUrl,
      },
    },
  };
}
