import { INSTRUCTIONS, isRawResolveOutput, type RawResolveOutput } from './gemini';

export class CloudflareAiRequestError extends Error {}
export class CloudflareAiInvalidResponseError extends Error {}

/**
 * Minimal shape of the Workers AI binding (env.AI, see wrangler.toml's
 * `[ai] binding = "AI"`) this provider actually calls - kept narrow so tests
 * can stub it without pulling in @cloudflare/workers-types' full `Ai` type.
 */
export interface WorkersAiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

// Chat models aren't given Gemini's strict responseSchema, so the JSON shape
// is spelled out in the prompt itself as a fallback guardrail.
const SCHEMA_HINT =
  '\nRespond with ONLY the JSON object, no markdown code fences, matching exactly: ' +
  '{"intent":string,"language":string,"items":[{"value":number,"unit":string,"region"?:string}],' +
  '"target_unit":string,"needs_clarification"?:boolean,"clarification_question"?:string,"ambiguous_unit"?:string}';

/**
 * Resolves one request via Cloudflare Workers AI (env.AI.run), reusing the
 * exact same extraction instructions and canonical-schema validator as
 * GeminiProvider. Like Gemini, this only extracts structured intent - it
 * never computes the numeric answer itself.
 */
export async function resolveWithCloudflareAi(
  text: string,
  model: string,
  ai: WorkersAiBinding,
): Promise<RawResolveOutput> {
  let result: unknown;
  try {
    result = await ai.run(model, {
      messages: [
        { role: 'system', content: INSTRUCTIONS + SCHEMA_HINT },
        { role: 'user', content: text },
      ],
      // Structured extraction, not conversation: skip chain-of-thought for
      // lower latency, lower output tokens, and more predictable JSON.
      chat_template_kwargs: { enable_thinking: false },
    });
  } catch (err) {
    console.error('Workers AI run failed:', err instanceof Error ? err.message : err);
    throw new CloudflareAiRequestError(err instanceof Error ? err.message : 'Workers AI request failed.');
  }

  const rawText = extractResponseText(result);
  if (rawText === null) {
    console.error('Workers AI response had no text. Shape:', JSON.stringify(result).slice(0, 300));
    throw new CloudflareAiInvalidResponseError('Workers AI response had no text.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(rawText));
  } catch {
    // Safe to log: model text only, never a secret/credential.
    console.error('Workers AI response was not valid JSON:', rawText.slice(0, 300));
    throw new CloudflareAiInvalidResponseError('Workers AI response was not valid JSON.');
  }

  if (!isRawResolveOutput(parsed)) {
    console.error('Workers AI JSON did not match schema:', rawText.slice(0, 300));
    throw new CloudflareAiInvalidResponseError('Workers AI JSON did not match the expected schema.');
  }

  return parsed;
}

/**
 * Workers AI text-generation models reply as `{ response: string }`, but
 * OpenAI-compatible chat models (like the Gemma build this project targets)
 * reply as `{ choices: [{ message: { content: string } }] }`. Support both
 * so switching AI_MODEL doesn't silently break extraction.
 */
function extractResponseText(result: unknown): string | null {
  if (typeof result !== 'object' || result === null) return null;
  const obj = result as Record<string, unknown>;

  if (typeof obj.response === 'string') return obj.response;

  const choices = obj.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const message = (choices[0] as Record<string, unknown> | undefined)?.message;
    const content = (message as Record<string, unknown> | undefined)?.content;
    if (typeof content === 'string') return content;
  }

  return null;
}

/** Some chat models wrap JSON in ```json ... ``` fences despite instructions not to. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}
