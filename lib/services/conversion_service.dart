import '../domain/conversion_engine.dart';
import '../domain/conversion_exception.dart';
import '../models/ai_intent.dart';
import '../models/conversion_result.dart';
import 'ai_resolver_service.dart';

/// Top-level facade the UI talks to: text in, [ConversionResult] out.
///
/// Local-first pipeline: [aiResolverService] (normally backed by the
/// deterministic [LocalParser]) resolves intent, then [conversionEngine]
/// does the math - no network involved.
///
/// When local resolution can't understand the input at all, or extracts a
/// unit the local database doesn't know, and a [remoteAiResolverService] is
/// configured, that single request is retried against it. A dimension
/// mismatch or other structural error is never retried remotely - local data
/// already answers those with certainty, so there's nothing an AI call could
/// add and it should not hallucinate a workaround.
class ConversionService {
  final AiResolverService aiResolverService;
  final ConversionEngine conversionEngine;
  final AiResolverService? remoteAiResolverService;

  ConversionService({
    required this.aiResolverService,
    required this.conversionEngine,
    this.remoteAiResolverService,
  });

  Future<ConversionResult> convert(String input) async {
    AiIntent intent;
    try {
      intent = await aiResolverService.resolveIntent(input);
    } on ConversionException {
      if (remoteAiResolverService == null) rethrow;
      return _convertViaRemote(input);
    }

    try {
      return conversionEngine.compute(intent, inputText: input.trim());
    } on UnknownUnitException {
      if (remoteAiResolverService == null) rethrow;
      return _convertViaRemote(input);
    }
  }

  Future<ConversionResult> _convertViaRemote(String input) async {
    try {
      final remoteIntent = await remoteAiResolverService!.resolveIntent(input);
      return conversionEngine.compute(remoteIntent, inputText: input.trim());
    } on CurrencyResolvedException catch (e) {
      // Currency is a separate category: the backend already computed the
      // final value from a real fetched exchange rate (never AI) - it never
      // goes through the Unit Registry/ConversionEngine, which has no
      // concept of a currency or a live rate.
      return e.result;
    }
  }
}
