import 'package:flutter/material.dart';

import '../../models/app_update_decision.dart';
import '../../services/app_update_service.dart';

/// Blocks entry to the rest of the app when the server's remote policy
/// says the installed version is no longer supported. Deliberately has no
/// Skip/Later/Continue-anyway button - see task: once minimumSupportedVersion
/// forces an update, there is no way past this screen except updating.
class ForceUpdateScreen extends StatefulWidget {
  final AppUpdateDecision decision;
  final AppUpdateService appUpdateService;

  const ForceUpdateScreen({
    super.key,
    required this.decision,
    required this.appUpdateService,
  });

  @override
  State<ForceUpdateScreen> createState() => _ForceUpdateScreenState();
}

class _ForceUpdateScreenState extends State<ForceUpdateScreen> {
  bool _updating = false;

  Future<void> _onUpdateNow() async {
    setState(() => _updating = true);
    final startedInAppFlow = await widget.appUpdateService.startImmediateUpdate();
    if (!startedInAppFlow) {
      await widget.appUpdateService.openStore(widget.decision.storeUrl);
    }
    if (mounted) setState(() => _updating = false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return PopScope(
      // Update is mandatory once this screen is shown - the system back
      // gesture/button must not provide a way around it.
      canPop: false,
      child: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.system_update_outlined, size: 72, color: theme.colorScheme.primary),
                const SizedBox(height: 24),
                Text(
                  'Update required',
                  style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  'A newer version of SmartConverter is available. '
                  'Please update to continue.',
                  style: theme.textTheme.bodyLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                Text(
                  'Current version: ${widget.decision.currentVersion}',
                  style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.outline),
                ),
                Text(
                  'Latest version: ${widget.decision.latestVersion}',
                  style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.outline),
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _updating ? null : _onUpdateNow,
                    child: _updating
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Update now'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
