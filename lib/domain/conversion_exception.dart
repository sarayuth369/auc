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
