import 'backend_config.dart';

/// Public HTTPS privacy policy URL. The Settings/About screens only show
/// the link when this is non-null/non-empty - never a placeholder or
/// invented address.
class PrivacyConfig {
  // Public, unauthenticated page served by our own Cloudflare Worker
  // (backend/src/privacy-policy-html.ts) - not a Claude artifact, no login
  // required. Nullable by design: set to null (not an empty string) if a
  // policy isn't published yet. Settings/About only show the link when
  // this is set.
  // ignore: unnecessary_nullable_for_final_variable_declarations
  static const String? policyUrl = '${BackendConfig.baseUrl}/privacy-policy';
}
