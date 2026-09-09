import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../../../models/conversion_result.dart';
import '../../../services/conversion_service.dart';

/// Short, user-facing label for the result's category - lets the card
/// clearly distinguish a plain unit conversion, a calculation, and a live
/// currency rate (see task: result UX should distinguish these at a
/// glance). Returns null for a normal unit conversion, where no extra label
/// is needed.
String? _categoryLabel(String categoryId) {
  if (categoryId == calculationCategoryId) return 'Calculation';
  if (categoryId == 'currency') return 'Live exchange rate';
  if (categoryId == 'crypto') return 'Live crypto price';
  return null;
}

class ResultCard extends StatelessWidget {
  final ConversionResult? result;
  final String? displayText;
  final String? errorText;
  final bool isClarification;
  final bool isFavorite;
  final VoidCallback? onToggleFavorite;

  const ResultCard({
    super.key,
    this.result,
    this.displayText,
    this.errorText,
    this.isClarification = false,
    this.isFavorite = false,
    this.onToggleFavorite,
  });

  @override
  Widget build(BuildContext context) {
    final error = errorText;
    if (error != null) {
      final scheme = Theme.of(context).colorScheme;
      final background = isClarification
          ? scheme.tertiaryContainer
          : scheme.errorContainer;
      final foreground = isClarification
          ? scheme.onTertiaryContainer
          : scheme.onErrorContainer;
      return Card(
        color: background,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(
                isClarification ? Icons.help_outline : Icons.error_outline,
                color: foreground,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(error, style: TextStyle(color: foreground)),
              ),
            ],
          ),
        ),
      );
    }

    final r = result;
    final text = displayText;
    if (r == null || text == null) {
      return const SizedBox.shrink();
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(r.inputText, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 8),
            Text(
              text,
              style: Theme.of(
                context,
              ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            if (_categoryLabel(r.categoryId) case final label?) ...[
              const SizedBox(height: 2),
              Text(
                label,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                IconButton(
                  tooltip: 'Copy',
                  icon: const Icon(Icons.copy),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: text));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Copied to clipboard')),
                    );
                  },
                ),
                IconButton(
                  tooltip: 'Share',
                  icon: const Icon(Icons.share),
                  onPressed: () {
                    Share.share('${r.inputText} = $text');
                  },
                ),
                IconButton(
                  tooltip: isFavorite
                      ? 'Remove from favorites'
                      : 'Add to favorites',
                  icon: Icon(isFavorite ? Icons.star : Icons.star_border),
                  onPressed: onToggleFavorite,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
