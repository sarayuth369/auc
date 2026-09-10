import 'package:flutter_test/flutter_test.dart';

import 'package:auc/services/version_comparator.dart';

void main() {
  group('compareVersions', () {
    test('equal versions compare to zero', () {
      expect(compareVersions('1.0.0', '1.0.0'), 0);
    });

    test('1.0.0 vs 1.0.1', () {
      expect(compareVersions('1.0.0', '1.0.1'), lessThan(0));
      expect(compareVersions('1.0.1', '1.0.0'), greaterThan(0));
    });

    test('1.0.10 vs 1.0.9 - never a string comparison', () {
      expect(compareVersions('1.0.10', '1.0.9'), greaterThan(0));
      expect(compareVersions('1.0.9', '1.0.10'), lessThan(0));
    });

    test('1.1.0 vs 1.0.9', () {
      expect(compareVersions('1.1.0', '1.0.9'), greaterThan(0));
    });

    test('2.0.0 vs 1.9.9', () {
      expect(compareVersions('2.0.0', '1.9.9'), greaterThan(0));
    });

    test('shorter version strings are zero-padded before comparing', () {
      expect(compareVersions('1.0', '1.0.0'), 0);
      expect(compareVersions('1.0', '1.0.1'), lessThan(0));
      expect(compareVersions('2', '1.9.9'), greaterThan(0));
    });

    test('build metadata after + or - is ignored', () {
      expect(compareVersions('1.0.0+3', '1.0.0+7'), 0);
      expect(compareVersions('1.0.1+1', '1.0.0+99'), greaterThan(0));
    });
  });

  group('isVersionLower', () {
    test('current == minimum is NOT lower (allowed)', () {
      expect(isVersionLower('1.0.1', '1.0.1'), isFalse);
    });

    test('current < minimum is lower (blocked)', () {
      expect(isVersionLower('1.0.0', '1.0.1'), isTrue);
    });

    test('current > minimum is not lower (allowed)', () {
      expect(isVersionLower('1.0.2', '1.0.1'), isFalse);
    });
  });
}
