import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../domain/conversion_engine.dart';
import '../domain/conversion_exception.dart';
import '../models/ai_intent.dart';
import '../models/conversion_result.dart';
import 'ai_config_service.dart';
import 'ai_resolver_service.dart';

/// Calls the AUC Cloudflare Worker's `/api/resolve` endpoint when the local
/// parser can't understand the input (unfamiliar language, unknown or
/// regional unit). The Worker forwards to an AI provider (Gemini today,
/// configurable server-side) for language/unit/context understanding only -
/// this class never computes a numeric result itself, it only turns the
/// Worker's structured JSON into an [AiIntent] for [ConversionEngine] to do
/// the real math on. Flutter never knows or cares which provider answered.
///
/// Every field coming back is treated as untrusted input until validated
/// here; nothing is passed through to [ConversionEngine] unchecked.
class RemoteAiResolverService implements AiResolverService {
  final String baseUrl;
  final Duration timeout;

  /// Optional: when given, the request's enabled/timeout are read from the
  /// latest cached `/api/config` on every call, overriding [timeout] above.
  /// Left null, this behaves exactly as a fixed-timeout resolver (used by
  /// existing tests and as the simplest configuration).
  final AiConfigService? configService;

  final http.Client _client;

  RemoteAiResolverService({
    required this.baseUrl,
    this.timeout = const Duration(seconds: 12),
    this.configService,
    http.Client? client,
  }) : _client = client ?? http.Client();

  @override
  Future<AiIntent> resolveIntent(String input) async {
    var effectiveTimeout = timeout;
    final configService = this.configService;
    if (configService != null) {
      final config = await configService.getCached();
      if (!config.enabled) {
        throw const ConversionException(
          'AI assistance is currently unavailable. Try a simpler request.',
        );
      }
      effectiveTimeout = config.timeout;
    }

    final uri = Uri.parse('$baseUrl/api/resolve');

    http.Response response;
    try {
      response = await _client
          .post(
            uri,
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({'text': input}),
          )
          .timeout(effectiveTimeout);
    } on TimeoutException {
      throw const ConversionException(
        'The AI resolver timed out. Check your connection and try again.',
      );
    } on SocketException {
      throw const ConversionException(
        'No internet connection. Try a simpler input or check your network.',
      );
    } catch (_) {
      throw const ConversionException(
        'Could not reach the AI resolver. Try again later.',
      );
    }

    final Map<String, dynamic> body;
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) {
        throw const FormatException('Response body was not a JSON object.');
      }
      body = decoded;
    } catch (_) {
      throw const ConversionException(
        'The AI resolver returned an unreadable response.',
      );
    }

    if (body['success'] == true) {
      if (body['intent'] == 'currency_convert') {
        throw CurrencyResolvedException(_parseCurrencyResult(body, input));
      }
      return _parseSuccess(body);
    }

    if (body['needs_clarification'] == true) {
      final question = body['question'];
      throw ClarificationException(
        question is String && question.trim().isNotEmpty
            ? question
            : 'Please clarify which region or standard to use.',
      );
    }

    final error = body['error'];
    if (error is Map && error['message'] is String) {
      throw ConversionException(error['message'] as String);
    }

    throw const ConversionException(
      'The AI resolver could not understand this input.',
    );
  }

  /// Builds the already-computed [ConversionResult] for a currency response
  /// - see [CurrencyResolvedException]. The rate/result numbers came from
  /// the backend's real FX provider (never AI); this only validates shape
  /// and formats for display, exactly like [ConversionEngine.formatNumber]
  /// does for every other category.
  ConversionResult _parseCurrencyResult(Map<String, dynamic> body, String inputText) {
    final to = body['to'];
    final result = body['result'];
    if (to is! String || to.trim().isEmpty || result is! num) {
      throw const ConversionException(
        'The AI resolver returned a malformed currency result.',
      );
    }
    return ConversionResult(
      inputText: inputText,
      value: result.toDouble(),
      unit: to,
      formattedValue: ConversionEngine.formatNumber(result.toDouble(), maxDecimals: 2),
      categoryId: 'currency',
    );
  }

  AiIntent _parseSuccess(Map<String, dynamic> body) {
    final itemsRaw = body['items'];
    final targetUnit = body['target_unit'];

    if (itemsRaw is! List || itemsRaw.isEmpty) {
      throw const ConversionException(
        'The AI resolver returned no quantities.',
      );
    }
    if (targetUnit is! String || targetUnit.trim().isEmpty) {
      throw const ConversionException(
        'The AI resolver returned no target unit.',
      );
    }

    final items = <ConversionItem>[];
    for (final raw in itemsRaw) {
      if (raw is! Map) {
        throw const ConversionException(
          'The AI resolver returned a malformed item.',
        );
      }
      final value = raw['value'];
      final unit = raw['unit'];
      if (value is! num || unit is! String || unit.trim().isEmpty) {
        throw const ConversionException(
          'The AI resolver returned a malformed item.',
        );
      }
      items.add(ConversionItem(value: value.toDouble(), unit: unit));
    }

    return AiIntent(intent: 'convert', items: items, targetUnit: targetUnit);
  }
}
