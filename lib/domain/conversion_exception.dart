/// Raised whenever natural-language input can't be parsed or converted
/// deterministically. The message is safe to show directly to the user.
class ConversionException implements Exception {
  final String message;
  const ConversionException(this.message);

  @override
  String toString() => message;
}
