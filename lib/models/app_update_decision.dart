/// The outcome of evaluating the remote update policy against the
/// installed version - what AppUpdateGate/ForceUpdateScreen act on.
class AppUpdateDecision {
  final bool required;
  final String currentVersion;
  final String latestVersion;
  final String storeUrl;

  const AppUpdateDecision({
    required this.required,
    required this.currentVersion,
    required this.latestVersion,
    required this.storeUrl,
  });

  AppUpdateDecision copyWith({bool? required}) => AppUpdateDecision(
    required: required ?? this.required,
    currentVersion: currentVersion,
    latestVersion: latestVersion,
    storeUrl: storeUrl,
  );
}
