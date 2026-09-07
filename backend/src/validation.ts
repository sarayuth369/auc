export const MAX_INPUT_LENGTH = 200;

export type ValidationResult =
  | { ok: true; text: string }
  | { ok: false; code: 'INVALID_INPUT' | 'INPUT_TOO_LONG'; message: string };

/** Validates the `{ text: string }` request body. No trust placed in shape until checked here. */
export function validateResolveBody(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, code: 'INVALID_INPUT', message: 'Request body must be a JSON object.' };
  }

  const text = (body as Record<string, unknown>).text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { ok: false, code: 'INVALID_INPUT', message: '"text" is required and must be a non-empty string.' };
  }

  if (text.length > MAX_INPUT_LENGTH) {
    return {
      ok: false,
      code: 'INPUT_TOO_LONG',
      message: `"text" must be ${MAX_INPUT_LENGTH} characters or fewer.`,
    };
  }

  return { ok: true, text: text.trim() };
}
