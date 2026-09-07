export type ErrorCode =
  | 'INVALID_INPUT'
  | 'INPUT_TOO_LONG'
  | 'AI_ERROR'
  | 'AI_INVALID_RESPONSE'
  | 'RATE_LIMITED'
  | 'NEEDS_CLARIFICATION'
  | 'UNSUPPORTED_CONVERSION';

export interface ErrorBody {
  success: false;
  error: { code: ErrorCode; message: string };
}

export interface ClarificationBody {
  success: false;
  needs_clarification: true;
  question: string;
  unit: string;
  error: { code: 'NEEDS_CLARIFICATION'; message: string };
}

/** Generic error envelope. Never include internal/AI-provider detail here. */
export function errorBody(code: ErrorCode, message: string): ErrorBody {
  return { success: false, error: { code, message } };
}

/** Structured clarification envelope for region/standard-dependent units. */
export function clarificationBody(unit: string, question: string): ClarificationBody {
  return {
    success: false,
    needs_clarification: true,
    question,
    unit,
    error: { code: 'NEEDS_CLARIFICATION', message: question },
  };
}
