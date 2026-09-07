import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/ai_config.dart';

/// Fetches and caches the backend's public AI runtime config
/// (`GET /api/config`) so the AI provider/model/timeout can change from the
/// Cloudflare Worker without an app update.
///
/// Never blocks app startup and never throws: [refresh] is best-effort and
/// silently keeps whatever was already cached (or the built-in defaults) on
/// any failure, so local-first conversion never depends on this succeeding.
class AiConfigService {
  static const _prefsKey = 'auc_ai_config_v1';

  final String baseUrl;
  final http.Client _client;

  AiConfigService({required this.baseUrl, http.Client? client})
    : _client = client ?? http.Client();

  Future<AiConfig> getCached() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw == null) return AiConfig.defaults;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return AiConfig.defaults;
      return AiConfig.fromJson(decoded);
    } catch (_) {
      return AiConfig.defaults;
    }
  }

  Future<void> refresh() async {
    try {
      final response = await _client
          .get(Uri.parse('$baseUrl/api/config'))
          .timeout(const Duration(seconds: 8));
      if (response.statusCode != 200) return;

      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) return;
      AiConfig.fromJson(decoded); // Validates shape before caching it.

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, response.body);
    } catch (_) {
      // Ignored: keep whatever is already cached (or the built-in defaults).
    }
  }
}
