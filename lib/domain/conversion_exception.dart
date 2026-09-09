import '../models/conversion_result.dart';

/// Raised whenever natural-language input can't be parsed or converted
/// deterministically. The message is safe to show directly to the user.
class ConversionException implements Exception {
  final String message;
  const ConversionException(this.message);

  @override
  String toString() => message;
}

/// A unit token was extracted but isn't in the local database. Distinct from
/// the base [ConversionException] so [ConversionService] knows this specific
/// case is worth retrying against the AI resolver (unlike e.g. a dimension
/// mismatch, which local data already answers with certainty).
class UnknownUnitException extends ConversionException {
  const UnknownUnitException(super.message);
}

/// The AI resolver needs more information before it can proceed (e.g. a
/// region-dependent unit with no region given). The UI should present this
/// as a question, not a failure.
class ClarificationException extends ConversionException {
  const ClarificationException(super.message);
}

/// Currency conversion is a separate category from the Unit Registry/
/// ConversionEngine pipeline - there is no local factor for an exchange
/// rate, and the rate is never invented by AI. When the backend recognizes
/// a currency request, it computes the final value itself (deterministic
/// arithmetic on a real fetched rate) and this exception carries that
/// already-computed [ConversionResult] back to [ConversionService], which
/// returns it directly instead of routing through [ConversionEngine].
///
/// Deliberately does NOT extend [ConversionException]: this is a resolved
/// result being smuggled through the call stack, not an error.
class CurrencyResolvedException implements Exception {
  final ConversionResult result;
  CurrencyResolvedException(this.result);
}
