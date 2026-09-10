import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:in_app_update/in_app_update.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/store_config.dart';
import '../models/app_update_decision.dart';
import '../models/app_update_policy.dart';
import 'version_comparator.dart';

/// AppUpdateGate's data/decision layer: fetches the remote update policy
/// (`GET /api/app-config`), compares it against the actual installed
/// version, and drives the Google Play In-App Update flow. Mirrors
/// AiConfigService's cache-with-fallback pattern (same reasoning: never
/// let a network hiccup take down something this fundamental to startup).
///
/// Fail-safe by construction: any failure to determine a policy (network
/// down, malformed response, no cache yet) resolves to "not required" -
/// see task's explicit rule that a server outage must never block normal
/// users. Only a successfully-obtained (fresh or cached) policy whose
/// forceUpdate flag is true AND whose minimumSupportedVersion exceeds the
/// installed version blocks the app.
class AppUpdateService {
  static const _prefsKey = 'auc_app_update_policy_v1';
  static const _checkedAtKey = 'auc_app_update_checked_at_v1';

  final String baseUrl;
  final http.Client _client;

  AppUpdateService({required this.baseUrl, http.Client? client})
    : _client = client ?? http.Client();

  Future<String> getCurrentVersion() async {
    try {
      // Bounded: on some platforms/test harnesses with no plugin registered,
      // this call never resolves rather than throwing - a plain try/catch
      // alone wouldn't save the caller from hanging forever.
      final info = await PackageInfo.fromPlatform().timeout(const Duration(seconds: 2));
      if (info.version.trim().isNotEmpty) return info.version;
    } catch (_) {
      // Sideloaded/dev builds or a platform without package metadata -
      // fall through to the safe default below rather than crashing.
    }
    return '1.0.0';
  }

  /// The single entry point AppUpdateGate calls at startup and on resume.
  /// Always attempts a fresh network check (bounded by [timeout]); on any
  /// failure, falls back to the last cached policy rather than skipping
  /// the check entirely - a server outage must never silently disable an
  /// already-active emergency force update.
  Future<AppUpdateDecision> getUpdateDecision({
    Duration timeout = const Duration(seconds: 4),
  }) async {
    final currentVersion = await getCurrentVersion();

    AppUpdatePolicy? policy;
    try {
      policy = await _fetchAndCachePolicy(timeout);
    } catch (_) {
      policy = await _getCachedPolicy();
    }

    if (policy == null) {
      return AppUpdateDecision(
        required: false,
        currentVersion: currentVersion,
        latestVersion: currentVersion,
        storeUrl: StoreConfig.fallbackAndroidStoreUrl,
      );
    }

    final required = policy.forceUpdate && isVersionLower(currentVersion, policy.minimumSupportedVersion);
    return AppUpdateDecision(
      required: required,
      currentVersion: currentVersion,
      latestVersion: policy.latestVersion,
      storeUrl: policy.storeUrl,
    );
  }

  Future<AppUpdatePolicy> _fetchAndCachePolicy(Duration timeout) async {
    final response = await _client.get(Uri.parse('$baseUrl/api/app-config')).timeout(timeout);
    if (response.statusCode != 200) {
      throw HttpException('app-config returned HTTP ${response.statusCode}');
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('app-config response was not a JSON object.');
    }
    final policy = AppUpdatePolicy.fromJson(decoded); // validates shape

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, jsonEncode(policy.toCacheJson()));
    await prefs.setInt(_checkedAtKey, DateTime.now().millisecondsSinceEpoch);
    return policy;
  }

  Future<AppUpdatePolicy?> _getCachedPolicy() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_prefsKey);
      if (raw == null) return null;
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return null;
      return AppUpdatePolicy.fromJson(decoded);
    } catch (_) {
      return null;
    }
  }

  /// Starts Google Play's Immediate In-App Update flow. Returns true only
  /// if the flow was actually launched - false for every case the caller
  /// should fall back to opening the Play Store listing directly (no Play
  /// Store on this build/device, sideloaded/debug APK, update not
  /// immediate-eligible, or any plugin error). Never throws.
  Future<bool> startImmediateUpdate() async {
    if (!Platform.isAndroid) return false;
    try {
      final info = await InAppUpdate.checkForUpdate();
      if (info.updateAvailability == UpdateAvailability.updateAvailable && info.immediateUpdateAllowed) {
        await InAppUpdate.performImmediateUpdate();
        return true;
      }
      return false;
    } catch (_) {
      // Expected for sideloaded APKs, debug builds, or no Play Store
      // account on the device - not an error the user needs to see.
      return false;
    }
  }

  Future<void> openStore(String storeUrl) async {
    final uri = Uri.tryParse(storeUrl);
    if (uri == null) return;
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      // Nothing more we can safely do - no browser/Play Store available.
    }
  }
}
