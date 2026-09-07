import 'package:flutter_test/flutter_test.dart';

import 'package:auc/config/backend_config.dart';
import 'package:auc/config/privacy_config.dart';

void main() {
  test('points to the public Cloudflare Worker page, not a Claude artifact', () {
    final url = PrivacyConfig.policyUrl;
    expect(url, isNotNull);
    expect(url, '${BackendConfig.baseUrl}/privacy-policy');
    expect(url, startsWith('https://'));
    expect(url, isNot(contains('claude.ai')));
  });
}
