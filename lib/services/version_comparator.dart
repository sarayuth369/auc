/// Compares dotted version strings correctly - never a plain string
/// comparison (which would wrongly rank "1.0.10" below "1.0.9"). Tolerates
/// build metadata after a `+` or `-` (e.g. "1.0.0+3", pubspec's own
/// `version:` format) by stripping it before comparing.
///
/// Returns negative if [a] < [b], zero if equal, positive if [a] > [b].
int compareVersions(String a, String b) {
  final partsA = _numericSegments(a);
  final partsB = _numericSegments(b);
  final length = partsA.length > partsB.length ? partsA.length : partsB.length;

  for (var i = 0; i < length; i++) {
    final segmentA = i < partsA.length ? partsA[i] : 0;
    final segmentB = i < partsB.length ? partsB[i] : 0;
    if (segmentA != segmentB) return segmentA - segmentB;
  }
  return 0;
}

bool isVersionLower(String current, String other) => compareVersions(current, other) < 0;

List<int> _numericSegments(String version) {
  final withoutMetadata = version.split(RegExp(r'[+-]')).first;
  return withoutMetadata
      .split('.')
      .map((segment) => int.tryParse(segment.trim()) ?? 0)
      .toList();
}
