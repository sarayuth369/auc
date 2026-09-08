import 'package:flutter/material.dart';

import '../../models/entitlement.dart';
import '../../services/billing_service.dart';
import '../../services/entitlement_service.dart';

/// Premium entry point (Settings -> Premium). Reads the current
/// [Entitlement] from [EntitlementService] and offers to purchase via
/// [BillingService] - which, until a real Play Billing integration exists,
/// always answers with a controlled "not available yet" (see
/// UnavailableBillingService). No fake purchase is ever simulated.
class PremiumScreen extends StatefulWidget {
  final EntitlementService entitlementService;
  final BillingService billingService;

  const PremiumScreen({
    super.key,
    required this.entitlementService,
    required this.billingService,
  });

  @override
  State<PremiumScreen> createState() => _PremiumScreenState();
}

class _PremiumScreenState extends State<PremiumScreen> {
  Entitlement _entitlement = Entitlement.free;
  bool _loaded = false;
  bool _purchasing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final entitlement = await widget.entitlementService.getCached();
    if (!mounted) return;
    setState(() {
      _entitlement = entitlement;
      _loaded = true;
    });
  }

  Future<void> _purchase() async {
    setState(() => _purchasing = true);
    final result = await widget.billingService.purchasePremium();
    if (!mounted) return;
    setState(() => _purchasing = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(result.message ?? 'Billing is not available yet.')),
    );
  }

  String _formatDate(DateTime date) {
    final y = date.year.toString().padLeft(4, '0');
    final m = date.month.toString().padLeft(2, '0');
    final d = date.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Premium')),
      body: !_loaded
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'SmartConverter Premium',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  _StatusCard(entitlement: _entitlement, formatDate: _formatDate),
                  const SizedBox(height: 24),
                  const _FeatureRow(text: 'No ads'),
                  const _FeatureRow(text: 'Unlimited history'),
                  const _FeatureRow(text: 'Unlimited favorites'),
                  const _FeatureRow(text: 'Future Premium features'),
                  const SizedBox(height: 24),
                  if (!_entitlement.isPremium) ...[
                    FilledButton(
                      onPressed: _purchasing ? null : _purchase,
                      child: _purchasing
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Upgrade to Premium'),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Pricing is set by Google Play and shown at checkout.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  final Entitlement entitlement;
  final String Function(DateTime) formatDate;

  const _StatusCard({required this.entitlement, required this.formatDate});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final expiresAt = entitlement.expiresAt;

    String title;
    String? subtitle;
    if (entitlement.isPremium) {
      title = 'Premium Active';
      if (expiresAt != null) {
        subtitle = entitlement.autoRenewing
            ? 'Renews: ${formatDate(expiresAt)}'
            : 'Ends: ${formatDate(expiresAt)} · Auto-renew: Off';
      }
    } else {
      title = 'Free Plan';
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text(title, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            if (subtitle != null) ...[
              const SizedBox(height: 4),
              Text(subtitle, style: theme.textTheme.bodyMedium),
            ],
          ],
        ),
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  final String text;
  const _FeatureRow({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(Icons.check_circle_outline, size: 20, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 10),
          Text(text, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}
