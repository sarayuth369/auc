/// Single place to point the app at the AUC Cloudflare Worker (AI resolver
/// fallback). No secrets live here - the Gemini API key never leaves the
/// Worker.
class BackendConfig {
  static const String baseUrl = 'https://auc-backend.biz2success.workers.dev';

  // Gemini's structured-output calls (JSON schema mode) commonly take
  // several seconds and occasionally 15-20s under load. Kept generous so a
  // legitimate slow-but-successful answer isn't cut off as a false timeout.
  static const Duration requestTimeout = Duration(seconds: 25);
}
