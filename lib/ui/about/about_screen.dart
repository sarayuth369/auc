import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/privacy_config.dart';

/// One row in the Features list: an icon, a short title, and a one-line
/// caption. Kept intentionally terse (not full sentences) so the section
/// reads as a scannable product overview, not documentation.
class _Feature {
  final IconData icon;
  final String title;
  final String caption;
  const _Feature(this.icon, this.title, this.caption);
}

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  // Reflects the app's actual current capabilities only - nothing listed
  // here is aspirational. Currency/crypto wording deliberately avoids
  // "live"/"real-time" (the rates are current, fetched on request, not a
  // streaming tick-by-tick feed) and never uses trading/investment/
  // portfolio language - SmartConverter is a converter, not a trading tool.
  static const _features = [
    _Feature(
      Icons.translate,
      'Natural-language conversion',
      'Type requests the way you naturally speak, in multiple languages.',
    ),
    _Feature(
      Icons.currency_exchange,
      'Global fiat currency conversion',
      'Convert between major world currencies using current exchange rates.',
    ),
    _Feature(
      Icons.currency_bitcoin,
      'Cryptocurrency conversion',
      'Convert popular cryptocurrencies using market-based prices.',
    ),
    _Feature(
      Icons.calculate_outlined,
      'Smart calculations',
      'Solve simple expressions like 10+2 or 10/2 right in the input.',
    ),
    _Feature(
      Icons.science_outlined,
      'Scientific & engineering units',
      'Length, mass, temperature, energy, power, and more, with SI prefixes.',
    ),
    _Feature(
      Icons.public,
      'Regional & local units',
      'Convert traditional and regional units like rai, ngan, and hun.',
    ),
    _Feature(
      Icons.language,
      'Multilingual AI understanding',
      'Supports English, Thai, Chinese, Japanese, Korean, Spanish, and more.',
    ),
    _Feature(
      Icons.auto_awesome_outlined,
      'AI-assisted unfamiliar units & requests',
      'When a request needs extra context, AI helps identify the right units.',
    ),
    _Feature(
      Icons.bolt_outlined,
      'Fast local conversion',
      'Supported conversions are processed locally for speed and reliability.',
    ),
    _Feature(
      Icons.history,
      'History & favorites',
      'Save frequent conversions and revisit your recent history.',
    ),
  ];

  Future<void> _openPrivacyPolicy(BuildContext context) async {
    final url = PrivacyConfig.policyUrl;
    if (url == null || url.isEmpty) return;
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasPrivacyUrl =
        PrivacyConfig.policyUrl != null && PrivacyConfig.policyUrl!.isNotEmpty;

    return Scaffold(
      appBar: AppBar(title: const Text('About')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Image.asset(
                  'assets/icons/app_icon_512.png',
                  width: 96,
                  height: 96,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'SmartConverter',
              textAlign: TextAlign.center,
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'AI Universal Converter',
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium?.copyWith(
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'SmartConverter is an AI-powered universal converter for '
              'everyday, scientific, engineering, regional, currency, '
              'cryptocurrency, and calculation needs.',
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: 12),
            Text(
              'Type what you want to convert in natural language. SmartConverter '
              'combines a fast conversion engine with AI-powered understanding for '
              'unfamiliar languages, units, and conversion requests.',
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: 28),
            Text(
              'Features',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            ..._features.map(
              (feature) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      feature.icon,
                      size: 22,
                      color: theme.colorScheme.primary,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            feature.title,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            feature.caption,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.outline,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 28),
            Text(
              'How it works',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Everyday and scientific unit conversions are calculated locally '
              'for speed and reliability. Currency and cryptocurrency conversions '
              'use current rates from external sources. When a request needs extra '
              'language or unit understanding, SmartConverter uses AI to interpret '
              'it before the conversion engine calculates the final result.',
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: 32),
            const Divider(),
            const SizedBox(height: 16),
            Text(
              'Developed by MLABS',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 4),
            Text(
              'Version 1.0.0',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
            if (hasPrivacyUrl) ...[
              const SizedBox(height: 16),
              Center(
                child: TextButton.icon(
                  onPressed: () => _openPrivacyPolicy(context),
                  icon: const Icon(Icons.privacy_tip_outlined),
                  label: const Text('Privacy Policy'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
