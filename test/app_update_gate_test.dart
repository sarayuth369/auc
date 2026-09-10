import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:auc/services/app_update_service.dart';
import 'package:auc/ui/update/app_update_gate.dart';

String _policyBody({required String minimum, required bool force}) {
  return '{"configVersion":1,"app":{"android":{"latestVersion":"1.0.1",'
      '"minimumSupportedVersion":"$minimum","forceUpdate":$force,'
      '"storeUrl":"https://play.google.com/store/apps/details?id=com.sarayuth369.auc"}}}';
}

/// AppUpdateGate's loading state shows an indeterminate CircularProgressIndicator,
/// whose repeating animation never lets pumpAndSettle() reach quiescence
/// (a well-known Flutter testing gotcha) - bounded pumps instead.
Future<void> pumpPastLoading(WidgetTester tester) async {
  // Must clear AppUpdateService.getCurrentVersion()'s internal 2s
  // PackageInfo.fromPlatform() timeout (no plugin registered in tests).
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 500));
  }
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('no update required -> shows the child (Home), never the update screen', (tester) async {
    final client = MockClient((request) async => http.Response(_policyBody(minimum: '1.0.0', force: true), 200));
    final service = AppUpdateService(baseUrl: 'https://example.test', client: client);

    await tester.pumpWidget(
      MaterialApp(home: AppUpdateGate(appUpdateService: service, child: const Text('HOME_CONTENT'))),
    );
    await pumpPastLoading(tester);

    expect(find.text('HOME_CONTENT'), findsOneWidget);
    expect(find.text('Update required'), findsNothing);
  });

  testWidgets('update required -> shows ForceUpdateScreen, blocks the child entirely', (tester) async {
    final client = MockClient((request) async => http.Response(_policyBody(minimum: '1.0.1', force: true), 200));
    final service = AppUpdateService(baseUrl: 'https://example.test', client: client);

    await tester.pumpWidget(
      MaterialApp(home: AppUpdateGate(appUpdateService: service, child: const Text('HOME_CONTENT'))),
    );
    await pumpPastLoading(tester);

    expect(find.text('Update required'), findsOneWidget);
    expect(find.text('HOME_CONTENT'), findsNothing);
  });

  testWidgets('ForceUpdateScreen shows current/latest version and an Update now button, no Skip/Later', (
    tester,
  ) async {
    final client = MockClient((request) async => http.Response(_policyBody(minimum: '1.0.1', force: true), 200));
    final service = AppUpdateService(baseUrl: 'https://example.test', client: client);

    await tester.pumpWidget(
      MaterialApp(home: AppUpdateGate(appUpdateService: service, child: const Text('HOME_CONTENT'))),
    );
    await pumpPastLoading(tester);

    expect(find.textContaining('Current version'), findsOneWidget);
    expect(find.textContaining('Latest version'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Update now'), findsOneWidget);
    expect(find.textContaining('Skip'), findsNothing);
    expect(find.textContaining('Later'), findsNothing);
    expect(find.textContaining('Continue anyway'), findsNothing);
  });

  testWidgets('resuming from background re-checks and unblocks once the policy allows it', (tester) async {
    var callCount = 0;
    final client = MockClient((request) async {
      callCount++;
      // First check (startup): server demands 1.0.1, blocks the fallback
      // '1.0.0' current version. Second check (on resume): server has
      // relaxed the minimum - the gate must re-evaluate, not trust stale
      // in-memory state.
      final minimum = callCount == 1 ? '1.0.1' : '1.0.0';
      return http.Response(_policyBody(minimum: minimum, force: true), 200);
    });
    final service = AppUpdateService(baseUrl: 'https://example.test', client: client);

    await tester.pumpWidget(
      MaterialApp(home: AppUpdateGate(appUpdateService: service, child: const Text('HOME_CONTENT'))),
    );
    await pumpPastLoading(tester);
    expect(find.text('Update required'), findsOneWidget);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await pumpPastLoading(tester);

    expect(find.text('HOME_CONTENT'), findsOneWidget);
    expect(find.text('Update required'), findsNothing);
    expect(callCount, 2);
  });

  testWidgets('a normal background/resume cycle while NOT blocking does not trigger an extra network check', (
    tester,
  ) async {
    var callCount = 0;
    final client = MockClient((request) async {
      callCount++;
      return http.Response(_policyBody(minimum: '1.0.0', force: true), 200);
    });
    final service = AppUpdateService(baseUrl: 'https://example.test', client: client);

    await tester.pumpWidget(
      MaterialApp(home: AppUpdateGate(appUpdateService: service, child: const Text('HOME_CONTENT'))),
    );
    await pumpPastLoading(tester);
    expect(callCount, 1);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await pumpPastLoading(tester);

    expect(callCount, 1); // not blocking -> resume does not re-check
  });
}
