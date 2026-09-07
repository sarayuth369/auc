export const DEFAULT_MODEL = 'gemini-2.5-flash';

export interface RawResolveItem {
  value: number;
  unit: string;
  region?: string | null;
}

/** Shape Gemini is instructed to return. Treated as untrusted until validated. */
export interface RawResolveOutput {
  intent: string;
  language: string;
  items: RawResolveItem[];
  target_unit: string;
  needs_clarification?: boolean;
  clarification_question?: string | null;
  ambiguous_unit?: string | null;
}

export class GeminiRequestError extends Error {}
export class GeminiInvalidResponseError extends Error {}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string' },
    language: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: 'number' },
          unit: { type: 'string' },
          region: { type: 'string', nullable: true },
        },
        required: ['value', 'unit'],
      },
    },
    target_unit: { type: 'string' },
    needs_clarification: { type: 'boolean' },
    clarification_question: { type: 'string', nullable: true },
    ambiguous_unit: { type: 'string', nullable: true },
  },
  required: ['intent', 'language', 'items', 'target_unit'],
};

// Kept short on purpose: fewer input tokens per request, and the model is
// told to normalize everything into canonical, snake_case unit ids so
// Flutter's UnitRepository (not this Worker, not the model) does the math.
const PROMPT_PREFIX = `You convert one natural-language unit-conversion request into strict JSON.
Never compute the numeric answer yourself - only extract structured data.
Normalize every unit name (any language) to a lowercase snake_case canonical id,
e.g. "metre"/"meters"/"メートル" -> "meter", "กิโลเมตร" -> "kilometer".
If a unit's size depends on country/region (e.g. "bigha") and no region is
stated, set needs_clarification=true, ambiguous_unit to that unit, and
clarification_question to a short question asking which region/standard.
Otherwise set needs_clarification=false. Detect the input's language as an
ISO 639-1 code. Output JSON only, matching the given schema, no prose.

Input: `;

export async function resolveWithGemini(
  text: string,
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch,
): Promise<RawResolveOutput> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT_PREFIX + text }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });
  } catch (err) {
    throw new GeminiRequestError(err instanceof Error ? err.message : 'Gemini request failed.');
  }

  if (!response.ok) {
    throw new GeminiRequestError(`Gemini responded with HTTP ${response.status}.`);
  }

  let envelope: unknown;
  try {
    envelope = await response.json();
  } catch {
    throw new GeminiInvalidResponseError('Gemini response was not valid JSON.');
  }

  const text_ = extractText(envelope);
  if (text_ === null) {
    throw new GeminiInvalidResponseError('Gemini response had no candidate text.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text_);
  } catch {
    throw new GeminiInvalidResponseError('Gemini candidate text was not valid JSON.');
  }

  if (!isRawResolveOutput(parsed)) {
    throw new GeminiInvalidResponseError('Gemini JSON did not match the expected schema.');
  }

  return parsed;
}

function extractText(envelope: unknown): string | null {
  if (typeof envelope !== 'object' || envelope === null) return null;
  const candidates = (envelope as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const content = (candidates[0] as Record<string, unknown> | undefined)?.content;
  const parts = (content as Record<string, unknown> | undefined)?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const partText = (parts[0] as Record<string, unknown> | undefined)?.text;
  return typeof partText === 'string' ? partText : null;
}

function isRawResolveOutput(value: unknown): value is RawResolveOutput {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.intent !== 'string') return false;
  if (typeof v.language !== 'string') return false;
  if (typeof v.target_unit !== 'string') return false;
  if (!Array.isArray(v.items)) return false;
  return v.items.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).value === 'number' &&
      typeof (item as Record<string, unknown>).unit === 'string',
  );
}
