/**
 * Thai local area units are NATIONALLY FIXED - unlike "bigha", there is no
 * regional ambiguity, and the Unit Registry/ConversionEngine (Flutter side)
 * is the sole source of truth for their factors: 1 rai = 1600 m^2,
 * 1 ngan = 400 m^2. This module never states or uses those factors; it only
 * checks that when one of these tokens is literally present in the user's
 * request, the AI's structured output actually mentions the matching
 * canonical unit somewhere - catching a model that silently swaps domains
 * (e.g. "3 rai 4 ngan" -> "3 hour to minute") before that reaches the
 * dimension guard, which can't see the mismatch because the hallucinated
 * pair is often dimensionally self-consistent with itself.
 *
 * Deliberately data-driven and generic: add a token/canonical-id pair here,
 * never branch on a specific input string.
 */
const THAI_LOCAL_UNIT_TOKENS: Record<string, string> = {
  'ตารางกิโลเมตร': 'square_kilometer',
  'ตารางเมตร': 'square_meter',
  'ตารางวา': 'square_wah',
  'ไร่': 'rai',
  'งาน': 'ngan',
};

// Longest token first so "ตารางเมตร" is consumed before any shorter token
// that might otherwise coincidentally match inside it.
const TOKENS_LONGEST_FIRST = Object.keys(THAI_LOCAL_UNIT_TOKENS).sort((a, b) => b.length - a.length);

interface ExpectedUnit {
  token: string;
  canonicalUnit: string;
}

/** Which known Thai local-unit tokens literally appear in the raw request text. */
function findExpectedThaiUnits(text: string): ExpectedUnit[] {
  const found: ExpectedUnit[] = [];
  let remaining = text;
  for (const token of TOKENS_LONGEST_FIRST) {
    if (remaining.includes(token)) {
      found.push({ token, canonicalUnit: THAI_LOCAL_UNIT_TOKENS[token] });
      remaining = remaining.split(token).join('');
    }
  }
  return found;
}

/**
 * True when the input text names a Thai local unit but the AI's extracted
 * units (items + target) reference none of the matching canonical ids -
 * i.e. the AI most likely misidentified the request entirely.
 */
export function hasThaiLocalUnitMismatch(text: string, itemUnits: string[], targetUnit: string): boolean {
  const expected = findExpectedThaiUnits(text);
  if (expected.length === 0) return false;

  const returned = new Set(
    [...itemUnits, targetUnit].map((u) => u.trim().toLowerCase()),
  );
  return !expected.some((e) => returned.has(e.canonicalUnit));
}
