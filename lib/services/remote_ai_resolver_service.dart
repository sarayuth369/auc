import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../domain/conversion_exception.dart';
import '../models/ai_intent.dart';
import 'ai_resolver_service.dart';

/// Calls the AUC Cloudflare Worker's `/api/resolve` endpoint when the local
/// parser can't understand the input (unfamiliar language, unknown or
/// regional unit). The Worker forwards to Gemini for language/unit/context
/// understanding only - this class never computes a numeric result itself,
/// it only turns the Worker's structured JSON into an [AiIntent] for
/// [ConversionEngine] to do the real math on.
///
/// Every field coming back is treated as untrusted input until validated
/// here; nothing is passed through to [ConversionEngine] unchecked.
class RemoteAiResolverService implements AiResolverService {
  final String baseUrl;
  final Duration timeout;
  final http.Client _client;

  RemoteAiResolverService({
    required this.baseUrl,
    this.timeout = const Duration(seconds: 12),
    http.Client? client,
  }) : _client = client ?? http.Client();

  @override
  Future<AiIntent> resolveIntent(String input) async {
    final uri = Uri.parse('$baseUrl/api/resolve');

    http.Response response;
    try {
      response = await _client
          .post(
            uri,
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({'text': input}),
          )
          .timeout(timeout);
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
