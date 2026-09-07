import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/privacy_config.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  static const _features = [
    'Natural-language conversion',
    'Multilingual AI assistance',
    'Scientific & engineering units',
    'Regional & local units',
    'Fast offline conversion for supported units',
    'Conversion history & favorites',
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
                  'assets/icons/app_icon_1024.png',
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
              'SmartConverter is an AI-powered universal converter designed to make '
              'everyday, scientific, engineering, and regional conversions simple.',
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
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.check_circle_outline,
                      size: 20,
                      color: theme.colorScheme.primary,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(feature, style: theme.textTheme.bodyMedium),
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
              'Supported conversions are calculated locally for speed and reliability. '
              'When a request needs language or unit understanding, SmartConverter can '
              'use AI to interpret the request before the verified conversion engine '
              'calculates the result.',
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
