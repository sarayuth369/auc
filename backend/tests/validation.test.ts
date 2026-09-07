import { describe, expect, it } from 'vitest';
import { MAX_INPUT_LENGTH, validateResolveBody } from '../src/validation';

describe('validateResolveBody', () => {
  it('accepts a well-formed body', () => {
    const result = validateResolveBody({ text: '10 km to miles' });
    expect(result.ok).toBe(true);
  });

  it('rejects empty input', () => {
    const result = validateResolveBody({ text: '' });
    expect(result).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
      message: expect.any(String),
    });
  });

  it('rejects a missing text field', () => {
    const result = validateResolveBody({});
    expect(result.ok).toBe(false);
  });

  it('rejects oversized input', () => {
    const result = validateResolveBody({ text: 'a'.repeat(MAX_INPUT_LENGTH + 1) });
    expect(result).toEqual({
      ok: false,
      code: 'INPUT_TOO_LONG',
      message: expect.any(String),
    });
  });
});
