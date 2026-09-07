/// Public HTTPS privacy policy URL. The Settings/About screens only show
/// the link when this is non-null/non-empty - never a placeholder or
/// invented address.
class PrivacyConfig {
  // Nullable by design: set to null (not an empty string) if a policy isn't
  // published yet. Settings/About only show the link when this is set.
  // ignore: unnecessary_nullable_for_final_variable_declarations
  static const String? policyUrl =
      'https://claude.ai/code/artifact/05006212-42f9-43a4-9789-13d317a45afd';
}
