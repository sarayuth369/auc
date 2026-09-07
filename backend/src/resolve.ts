import { clarificationBody, errorBody } from './errors';
import { DEFAULT_MODEL, GeminiInvalidResponseError, GeminiRequestError } from './gemini';
import { findDimensionMismatch } from './dimensions';
import { getProvider, UnsupportedProviderError } from './provider-registry';
import { canonicalRegionalUnit, needsRegionClarification } from './regional';
import { validateResolveBody } from './validation';
import type { ConfigEnv } from './config';

export interface ResolveEnv extends ConfigEnv {
  GEMINI_API_KEY: string;
}

export interface ResolveDeps {
  fetchImpl: typeof fetch;
}

export interface ResolveOutcome {
  status: number;
  body: object;
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
    });
  } catch (err) {
    if (err instanceof GeminiInvalidResponseError) {
      return {
        status: 502,
        body: errorBody('AI_INVALID_RESPONSE', 'The AI resolver returned an unreadable response.'),
      };
    }
    if (err instanceof GeminiRequestError) {
      return { status: 502, body: errorBody('AI_ERROR', 'The AI resolver is temporarily unavailable.') };
    }
    if (err instanceof UnsupportedProviderError) {
      return { status: 502, body: errorBody('AI_ERROR', 'The configured AI provider is unavailable.') };
    }
    throw err;
  }

  if (raw.needs_clarification) {
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
    return {
      status: 422,
      body: errorBody(
        'UNSUPPORTED_CONVERSION',
        `Cannot convert "${mismatch.itemUnit}" (${mismatch.itemDimension}) to ` +
          `"${mismatch.targetUnit}" (${mismatch.targetDimension}): different physical dimensions.`,
      ),
    };
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
