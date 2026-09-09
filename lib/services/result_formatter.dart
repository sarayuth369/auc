import '../domain/conversion_engine.dart';
import '../models/conversion_result.dart';
import 'settings_service.dart';

/// Formats a [ConversionResult] for on-screen/copy/share/history display
/// according to the user's decimal-places preference.
///
/// This is purely presentational: [ConversionEngine] always computes the
/// same full-precision value regardless of this setting, and that value
/// (`result.value`) is never rounded internally. [DecimalPlaces.auto] keeps
/// the engine's own default formatting (category-aware, trailing zeros
/// stripped); a fixed digit count formats the raw value to exactly that
/// many decimals, trailing zeros included.
String formatResultDisplay(
  ConversionResult result,
  DecimalPlaces decimalPlaces,
) {
  final digits = decimalPlaces.fixedDigits;
  if (digits == null) return result.displayText;

  final formatted = ConversionEngine.formatFixed(result.value, digits);
  return '$formatted ${result.unit}';
}
