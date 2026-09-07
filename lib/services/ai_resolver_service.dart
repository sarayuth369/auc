import '../models/ai_intent.dart';
import 'local_parser.dart';

/// Understands user intent from free-form natural language text.
///
/// In production this seam is meant to be backed by a cloud AI call
/// (never invoked directly from Flutter - always through a backend).
/// The Conversion Engine never talks to AI directly and never lets AI
/// compute the final numeric result; AI (real or mocked) only ever
/// produces an [AiIntent] for the engine to act on.
abstract class AiResolverService {
  Future<AiIntent> resolveIntent(String input);
}

/// Phase 1.1 mock implementation: no network call, no API key.
///
/// It simulates "AI understanding" by delegating to the deterministic
/// [LocalParser], keeping the pipeline fully offline while preserving the
/// same interface a future real resolver would implement.
class MockAiResolverService implements AiResolverService {
  final LocalParser _parser;

  MockAiResolverService({LocalParser? parser})
    : _parser = parser ?? LocalParser();

  @override
  Future<AiIntent> resolveIntent(String input) async {
    return _parser.parse(input);
  }
}
