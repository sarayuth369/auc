import '../domain/conversion_engine.dart';
import '../models/conversion_result.dart';
import 'ai_resolver_service.dart';

/// Top-level facade the UI talks to: text in, [ConversionResult] out.
///
/// Pipeline: AiResolverService (intent) -> ConversionEngine (math).
/// Throws [ConversionException] on invalid input or unknown units.
class ConversionService {
  final AiResolverService aiResolverService;
  final ConversionEngine conversionEngine;

  ConversionService({
    required this.aiResolverService,
    required this.conversionEngine,
  });

  Future<ConversionResult> convert(String input) async {
    final intent = await aiResolverService.resolveIntent(input);
    return conversionEngine.compute(intent, inputText: input.trim());
  }
}
