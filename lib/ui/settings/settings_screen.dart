import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/privacy_config.dart';
import '../../services/billing_service.dart';
import '../../services/entitlement_service.dart';
import '../../services/favorites_service.dart';
import '../../services/history_service.dart';
import '../../services/settings_service.dart';
import '../about/about_screen.dart';
import '../premium/premium_screen.dart';

class SettingsScreen extends StatefulWidget {
  final SettingsService settingsService;
  final ValueNotifier<ThemeMode> themeModeNotifier;
  final HistoryService historyService;
  final FavoritesService favoritesService;

  /// Nullable so existing call sites (tests included) don't need to change;
  /// a fresh default is created internally when omitted.
  final EntitlementService? entitlementService;
  final BillingService? billingService;

  const SettingsScreen({
    super.key,
    required this.settingsService,
    required this.themeModeNotifier,
    required this.historyService,
    required this.favoritesService,
    this.entitlementService,
    this.billingService,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  ThemeMode _themeMode = ThemeMode.system;
  DecimalPlaces _decimalPlaces = DecimalPlaces.auto;
  bool _hapticFeedback = true;
  bool _saveHistory = true;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final themeMode = await widget.settingsService.getThemeMode();
    final decimalPlaces = await widget.settingsService.getDecimalPlaces();
    final haptic = await widget.settingsService.getHapticFeedback();
    final saveHistory = await widget.settingsService.getSaveHistory();
    if (!mounted) return;
    setState(() {
      _themeMode = themeMode;
      _decimalPlaces = decimalPlaces;
      _hapticFeedback = haptic;
      _saveHistory = saveHistory;
      _loaded = true;
    });
  }

  Future<void> _setThemeMode(ThemeMode? mode) async {
    if (mode == null) return;
    await widget.settingsService.setThemeMode(mode);
    widget.themeModeNotifier.value = mode;
    if (!mounted) return;
    setState(() => _themeMode = mode);
  }

  Future<void> _setDecimalPlaces(DecimalPlaces? value) async {
    if (value == null) return;
    await widget.settingsService.setDecimalPlaces(value);
    if (!mounted) return;
    setState(() => _decimalPlaces = value);
  }

  Future<void> _setHapticFeedback(bool value) async {
    await widget.settingsService.setHapticFeedback(value);
    if (!mounted) return;
    setState(() => _hapticFeedback = value);
  }

  Future<void> _setSaveHistory(bool value) async {
    await widget.settingsService.setSaveHistory(value);
    if (!mounted) return;
    setState(() => _saveHistory = value);
  }

  Future<void> _confirmAndClear({
    required String question,
    required Future<void> Function() clear,
    required String doneMessage,
  }) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(question),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Clear'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    await clear();
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(doneMessage)));
  }

  Future<void> _clearHistory() => _confirmAndClear(
    question: 'Clear all conversion history?',
    clear: widget.historyService.clear,
    doneMessage: 'History cleared',
  );

  Future<void> _clearFavorites() => _confirmAndClear(
    question: 'Clear all favorites?',
    clear: widget.favoritesService.clear,
    doneMessage: 'Favorites cleared',
  );

  Future<void> _openPrivacyPolicy() async {
    final url = PrivacyConfig.policyUrl;
    if (url == null || url.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('The privacy policy link is not available yet.'),
        ),
      );
      return;
    }
    final opened = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    );
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not open the privacy policy link.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _SectionHeader('Appearance'),
            RadioGroup<ThemeMode>(
              groupValue: _themeMode,
              onChanged: _setThemeMode,
              child: const Column(
                children: [
                  RadioListTile<ThemeMode>(
                    title: Text('System default'),
                    value: ThemeMode.system,
                  ),
                  RadioListTile<ThemeMode>(
                    title: Text('Light'),
                    value: ThemeMode.light,
                  ),
                  RadioListTile<ThemeMode>(
                    title: Text('Dark'),
                    value: ThemeMode.dark,
                  ),
                ],
              ),
            ),
            const Divider(),
            const _SectionHeader('Conversion'),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 4),
              child: Text('Decimal places'),
            ),
            RadioGroup<DecimalPlaces>(
              groupValue: _decimalPlaces,
              onChanged: _setDecimalPlaces,
              child: Column(
                children: DecimalPlaces.values
                    .map(
                      (option) => RadioListTile<DecimalPlaces>(
                        title: Text(option.label),
                        value: option,
                      ),
                    )
                    .toList(),
              ),
            ),
            SwitchListTile(
              title: const Text('Haptic feedback'),
              subtitle: const Text('Vibrate on a successful conversion'),
              value: _hapticFeedback,
              onChanged: _setHapticFeedback,
            ),
            SwitchListTile(
              title: const Text('Save conversion history'),
              subtitle: const Text('Keep new conversions in History'),
              value: _saveHistory,
              onChanged: _setSaveHistory,
            ),
            const Divider(),
            const _SectionHeader('Data'),
            ListTile(
              leading: const Icon(Icons.delete_sweep_outlined),
              title: const Text('Clear History'),
              onTap: _clearHistory,
            ),
            ListTile(
              leading: const Icon(Icons.star_border),
              title: const Text('Clear Favorites'),
              onTap: _clearFavorites,
            ),
            const Divider(),
            const _SectionHeader('Privacy'),
            ListTile(
              leading: const Icon(Icons.privacy_tip_outlined),
              title: const Text('Privacy Policy'),
              onTap: _openPrivacyPolicy,
            ),
            const Divider(),
            const _SectionHeader('Premium'),
            ListTile(
              leading: const Icon(Icons.workspace_premium_outlined),
              title: const Text('SmartConverter Premium'),
              subtitle: const Text('Remove ads, unlock future features'),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => PremiumScreen(
                    entitlementService: widget.entitlementService ?? EntitlementService(),
                    billingService: widget.billingService ?? UnavailableBillingService(),
                  ),
                ),
              ),
            ),
            const Divider(),
            const _SectionHeader('About'),
            ListTile(
              leading: const Icon(Icons.info_outline),
              title: const Text('About SmartConverter'),
              onTap: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const AboutScreen())),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Text(
        title,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
          color: Theme.of(context).colorScheme.primary,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
