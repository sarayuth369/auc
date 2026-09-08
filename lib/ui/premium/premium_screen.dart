import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../models/entitlement.dart';
import '../../services/billing_service.dart';
import '../../services/entitlement_service.dart';

const _premiumStart = Color(0xFF4F46E5);
const _premiumEnd = Color(0xFF7C3AED);
const _premiumGold = Color(0xFFFBBF24);
const _premiumGoldText = Color(0xFF1F2937);

/// Premium entry point (Settings -> Premium). Reads the current
/// [Entitlement] from [EntitlementService] and offers to purchase via
/// [BillingService] - which, until a real Play Billing integration exists,
/// always answers with a controlled "not available yet" (see
/// UnavailableBillingService). No fake purchase is ever simulated, and no
/// price is ever hard-coded - Google Play owns pricing and shows it at
/// checkout once real billing exists.
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

  Future<void> _manageSubscription() async {
    final productId = _entitlement.productId;
    final url = productId == null
        ? 'https://play.google.com/store/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions?sku=$productId&package=com.sarayuth369.auc';
    final opened = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open Google Play subscriptions.')),
      );
    }
  }

  String _formatDate(DateTime date) {
    final y = date.year.toString().padLeft(4, '0');
    final m = date.month.toString().padLeft(2, '0');
    final d = date.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Premium')),
      body: !_loaded
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _HeroSection(entitlement: _entitlement),
                    const SizedBox(height: 20),
                    if (_entitlement.isPremium) ...[
                      _PremiumActiveCard(entitlement: _entitlement, formatDate: _formatDate),
                      const SizedBox(height: 16),
                      OutlinedButton.icon(
                        onPressed: _manageSubscription,
                        icon: const Icon(Icons.open_in_new, size: 18),
                        label: const Text('Manage Subscription'),
                      ),
                    ] else ...[
                      if (_entitlement.status == EntitlementStatus.expired) ...[
                        const _ExpiredBanner(),
                        const SizedBox(height: 16),
                      ],
                      const _PlanComparison(),
                      const SizedBox(height: 20),
                      FilledButton(
                        onPressed: _purchasing ? null : _purchase,
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(52),
                          backgroundColor: _premiumGold,
                          foregroundColor: _premiumGoldText,
                        ),
                        child: _purchasing
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text(
                                'Upgrade to Premium',
                                style: TextStyle(fontWeight: FontWeight.bold),
                              ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Pricing is set by Google Play and shown at checkout.',
                        textAlign: TextAlign.center,
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.outline),
                      ),
                      const SizedBox(height: 16),
                      const _RenewalDisclosure(),
                    ],
                  ],
                ),
              ),
            ),
    );
  }
}

/// Gradient hero banner. Colors are fixed (not theme-derived) so the
/// Premium brand treatment stays legible and consistent in both light and
/// dark app themes - the same approach as the app icon's own indigo/violet
/// palette.
class _HeroSection extends StatelessWidget {
  final Entitlement entitlement;
  const _HeroSection({required this.entitlement});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_premiumStart, _premiumEnd],
        ),
        boxShadow: [
          BoxShadow(
            color: _premiumStart.withValues(alpha: 0.35),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.workspace_premium, color: _premiumGold, size: 32),
          const SizedBox(height: 12),
          Text(
            'SmartConverter Premium',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            entitlement.isPremium
                ? 'Thanks for supporting SmartConverter.'
                : 'Convert smarter. Without interruptions.',
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(color: Colors.white.withValues(alpha: 0.92)),
          ),
          const SizedBox(height: 6),
          Text(
            entitlement.isPremium
                ? 'You have full access to everything Premium offers.'
                : 'Unlock the full potential of SmartConverter with Premium.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: Colors.white.withValues(alpha: 0.8)),
          ),
        ],
      ),
    );
  }
}

class _ExpiredBanner extends StatelessWidget {
  const _ExpiredBanner();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.errorContainer.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline, color: theme.colorScheme.error),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Your Premium subscription has ended. Ads are enabled.',
              style: theme.textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}

class _PremiumActiveCard extends StatelessWidget {
  final Entitlement entitlement;
  final String Function(DateTime) formatDate;
  const _PremiumActiveCard({required this.entitlement, required this.formatDate});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final expiresAt = entitlement.expiresAt;
    final subtitle = expiresAt == null
        ? null
        : (entitlement.autoRenewing
              ? 'Renews: ${formatDate(expiresAt)}'
              : 'Ends: ${formatDate(expiresAt)} · Auto-renew: Off');

    return Card(
      elevation: 0,
      color: theme.colorScheme.primaryContainer.withValues(alpha: 0.5),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: _premiumGold.withValues(alpha: 0.6)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.check_circle, color: Color(0xFF16A34A)),
                const SizedBox(width: 8),
                Text(
                  'Premium Active',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                ),
              ],
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(subtitle, style: theme.textTheme.bodyMedium),
            ],
            if (!entitlement.autoRenewing) ...[
              const SizedBox(height: 6),
              Text(
                'Premium remains available until the end of the current billing period.',
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
              ),
            ],
            const SizedBox(height: 16),
            const _BenefitLine(text: 'No ads'),
            const _BenefitLine(text: 'Unlimited history'),
            const _BenefitLine(text: 'Unlimited favorites'),
            const _BenefitLine(text: 'Access to future Premium features'),
          ],
        ),
      ),
    );
  }
}

/// Free vs Premium comparison. Stacked (not side-by-side) so nothing wraps
/// or truncates on narrow phones - each plan gets its own full-width card.
class _PlanComparison extends StatelessWidget {
  const _PlanComparison();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          elevation: 0,
          color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Free',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                ),
                Text(
                  'Great to get started',
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
                ),
                const SizedBox(height: 12),
                const _BenefitLine(text: 'Basic conversions'),
                const _BenefitLine(text: 'AI-powered unit recognition'),
                const _BenefitLine(text: 'History'),
                const _BenefitLine(text: 'Favorites'),
                _BenefitLine(
                  text: 'Includes ads',
                  icon: Icons.campaign_outlined,
                  iconColor: theme.colorScheme.outline,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          elevation: 0,
          color: theme.colorScheme.primaryContainer.withValues(alpha: 0.35),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(color: _premiumGold.withValues(alpha: 0.7), width: 1.5),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.workspace_premium, color: _premiumGold, size: 20),
                    const SizedBox(width: 6),
                    Text(
                      'Premium',
                      style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                Text(
                  'For power users',
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
                ),
                const SizedBox(height: 12),
                const _BenefitLine(text: 'Everything in Free'),
                const _BenefitLine(text: 'No ads'),
                const _BenefitLine(text: 'Unlimited history'),
                const _BenefitLine(text: 'Unlimited favorites'),
                const _BenefitLine(text: 'Access to future Premium features'),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _BenefitLine extends StatelessWidget {
  final String text;
  final IconData icon;
  final Color? iconColor;
  const _BenefitLine({
    required this.text,
    this.icon = Icons.check_circle,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: iconColor ?? _premiumGold),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: theme.textTheme.bodyMedium)),
        ],
      ),
    );
  }
}

class _RenewalDisclosure extends StatelessWidget {
  const _RenewalDisclosure();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.shield_outlined, size: 18, color: theme.colorScheme.outline),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Cancel anytime. Subscription renews automatically unless canceled '
              'before the next billing date.',
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
            ),
          ),
        ],
      ),
    );
  }
}
