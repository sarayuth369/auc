import { CloudflareAiInvalidResponseError, CloudflareAiRequestError } from './cloudflare-ai';
import { clarificationBody, errorBody } from './errors';
import { DEFAULT_MODEL, GeminiInvalidResponseError, GeminiRequestError } from './gemini';
import { findDimensionMismatch } from './dimensions';
import { extractSimplePair } from './local-extract';
import { hasThaiLocalUnitMismatch } from './local-unit-tokens';
import { hasFabricatedValue } from './numeric-guard';
import { getProvider, UnsupportedProviderError } from './provider-registry';
import { canonicalRegionalUnit, isRegionDependent, needsRegionClarification } from './regional';
import { validateResolveBody } from './validation';
import type { ConfigEnv } from './config';
import type { WorkersAiBinding } from './cloudflare-ai';

export interface ResolveEnv extends ConfigEnv {
  GEMINI_API_KEY: string;
  /** Workers AI binding (see wrangler.toml `[ai] binding = "AI"`), only used when AI_PROVIDER=cloudflare. */
  AI?: WorkersAiBinding;
}

export interface ResolveDeps {
  fetchImpl: typeof fetch;
}

export interface ResolveOutcome {
  status: number;
  body: object;
}

function dimensionMismatchOutcome(itemUnit: string, itemDimension: string, targetUnit: string, targetDimension: string): ResolveOutcome {
  return {
    status: 422,
    body: errorBody(
      'UNSUPPORTED_CONVERSION',
      `Cannot convert "${itemUnit}" (${itemDimension}) to "${targetUnit}" (${targetDimension}): different physical dimensions.`,
    ),
  };
}

/**
 * Full /api/resolve pipeline: validate -> ask Gemini -> validate Gemini's
 * answer -> apply regional/dimensional guards -> return a structured result.
 * Returns a plain {status, body} pair so it can be unit-tested without
 * spinning up a real Worker Request/Response round-trip.
 */
export async function resolveConversion(
  rawBody: unknown,
  env: ResolveEnv,
  deps: ResolveDeps,
): Promise<ResolveOutcome> {
  const validation = validateResolveBody(rawBody);
  if (!validation.ok) {
    return { status: 400, body: errorBody(validation.code, validation.message) };
  }

  // Deterministic, AI-free short-circuit: for the one phrasing shape simple
  // enough to classify with certainty - "<one number> <unit> to <unit>" -
  // a dimension mismatch (e.g. "100 kg to °C") never needs to depend on
  // model behavior. Never fires for multi-item, non-English-connector, or
  // otherwise ambiguous input - that still goes through the AI resolver
  // exactly as before.
  const localPair = extractSimplePair(validation.text);
  if (localPair) {
    const localMismatch = findDimensionMismatch([localPair.sourceUnit], localPair.targetUnit);
    if (localMismatch) {
      return dimensionMismatchOutcome(
        localMismatch.itemUnit,
        localMismatch.itemDimension,
        localMismatch.targetUnit,
        localMismatch.targetDimension,
      );
    }
  }

  if (env.AI_ENABLED === 'false') {
    return { status: 502, body: errorBody('AI_ERROR', 'AI assistance is currently disabled.') };
  }

  let raw;
  try {
    const provider = getProvider(env.AI_PROVIDER ?? 'gemini');
    raw = await provider.resolve({
      text: validation.text,
      apiKey: env.GEMINI_API_KEY,
      model: env.AI_MODEL ?? env.GEMINI_MODEL ?? DEFAULT_MODEL,
      fetchImpl: deps.fetchImpl,
      ai: env.AI,
    });
  } catch (err) {
    if (err instanceof GeminiInvalidResponseError || err instanceof CloudflareAiInvalidResponseError) {
      return {
        status: 502,
        body: errorBody('AI_INVALID_RESPONSE', 'The AI resolver returned an unreadable response.'),
      };
    }
    if (err instanceof GeminiRequestError || err instanceof CloudflareAiRequestError) {
      return { status: 502, body: errorBody('AI_ERROR', 'The AI resolver is temporarily unavailable.') };
    }
    if (err instanceof UnsupportedProviderError) {
      return { status: 502, body: errorBody('AI_ERROR', 'The configured AI provider is unavailable.') };
    }
    throw err;
  }

  // The Unit Registry, not the AI's opinion, decides what's actually
  // region-dependent (regional.ts's small curated list, e.g. "bigha") -
  // rai/ngan/etc. are nationally fixed and must never be blocked on a
  // clarification the model occasionally, incorrectly, thinks they need.
  if (raw.needs_clarification && isRegionDependent(raw.ambiguous_unit ?? raw.items[0]?.unit ?? '')) {
    const unit = raw.ambiguous_unit ?? raw.items[0]?.unit ?? 'unit';
    const question = raw.clarification_question ?? `Which region or standard does "${unit}" use?`;
    return { status: 200, body: clarificationBody(unit, question) };
  }

  if (raw.items.length === 0 || raw.target_unit.trim().length === 0) {
    return {
      status: 422,
      body: errorBody('INVALID_INPUT', 'Could not extract a conversion from the input.'),
    };
  }

  // Catches an AI that silently swapped domains (e.g. "3 rai 4 ngan" ->
  // "3 hour to minute") - the dimension guard below can't see this because
  // such a hallucination is often internally self-consistent.
  if (
    hasThaiLocalUnitMismatch(
      validation.text,
      raw.items.map((item) => item.unit),
      raw.target_unit,
    )
  ) {
    return {
      status: 502,
      body: errorBody('AI_INVALID_RESPONSE', 'The AI resolver misidentified the requested units.'),
    };
  }

  // Hard backend enforcement of "the AI never computes the numeric answer":
  // every extracted value must literally appear in the request, never one
  // the model derived (e.g. "3 rai 4 ngan" -> a pre-blended "1.333 rai").
  if (hasFabricatedValue(validation.text, raw.items.map((item) => item.value))) {
    return {
      status: 502,
      body: errorBody('AI_INVALID_RESPONSE', 'The AI resolver returned a value not present in the request.'),
    };
  }

  for (const item of raw.items) {
    if (needsRegionClarification(item.unit, item.region)) {
      return {
        status: 200,
        body: clarificationBody(item.unit, `Which region or state does "${item.unit}" refer to?`),
      };
    }
  }

  const mismatch = findDimensionMismatch(
    raw.items.map((item) => item.unit),
    raw.target_unit,
  );
  if (mismatch) {
    return dimensionMismatchOutcome(
      mismatch.itemUnit,
      mismatch.itemDimension,
      mismatch.targetUnit,
      mismatch.targetDimension,
    );
  }

  const items = raw.items.map((item) => ({
    value: item.value,
    unit: item.region ? canonicalRegionalUnit(item.unit, item.region) : item.unit,
  }));

  return {
    status: 200,
    body: {
      success: true,
      intent: 'convert',
      language: raw.language,
      items,
      target_unit: raw.target_unit,
    },
  };
}
