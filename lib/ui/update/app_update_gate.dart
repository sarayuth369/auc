import 'package:flutter/material.dart';

import '../../models/app_update_decision.dart';
import '../../services/app_update_service.dart';
import 'force_update_screen.dart';

/// Sits in front of Home in the widget tree: runs the update check before
/// anything else is shown, and re-checks on resume (so returning from the
/// Play Store re-evaluates instead of trusting stale state - see task).
/// The loading state is intentionally brief - AppUpdateService bounds its
/// own network timeout, so this never hangs the splash indefinitely.
class AppUpdateGate extends StatefulWidget {
  final AppUpdateService appUpdateService;
  final Widget child;

  const AppUpdateGate({super.key, required this.appUpdateService, required this.child});

  @override
  State<AppUpdateGate> createState() => _AppUpdateGateState();
}

class _AppUpdateGateState extends State<AppUpdateGate> with WidgetsBindingObserver {
  AppUpdateDecision? _decision;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _check();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Only re-check when the update screen is actually blocking - a normal
    // resume from backgrounding the app doesn't need another network call.
    if (state == AppLifecycleState.resumed && _decision?.required == true) {
      _check();
    }
  }

  Future<void> _check() async {
    final decision = await widget.appUpdateService.getUpdateDecision();
    if (!mounted) return;
    setState(() {
      _decision = decision;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final decision = _decision;
    if (decision != null && decision.required) {
      return ForceUpdateScreen(decision: decision, appUpdateService: widget.appUpdateService);
    }
    return widget.child;
  }
}
