/**
 * Hard backend guarantee behind "the AI never computes the numeric answer":
 * every value the AI extracts must be a number that literally appears in
 * the user's raw request text, not one it derived (e.g. converting "3 rai
 * 4 ngan" into some already-blended "1.333 rai" instead of just returning
 * the stated 3 and 4). Language-agnostic and unit-agnostic by design - it
 * only looks at digits, never at unit names - so it applies to every
 * request the same way, not a specific phrase or provider.
 */
const NUMBER_TOKEN = /\d+(?:\.\d+)?/g;

function numbersIn(text: string): number[] {
  return [...text.matchAll(NUMBER_TOKEN)].map((m) => Number(m[0]));
}

/**
 * True when the AI's extracted values don't literally match the numbers
 * stated in the input - either a value that isn't present at all (computed/
 * derived, e.g. "3 rai 4 ngan" -> a pre-blended "1.333 rai"), or the same
 * stated number reused for more items than it actually appears (e.g. a
 * single "1" in the input duplicated into two separate items). Matching is
 * a multiset consumption, not simple membership, so a number that's
 * genuinely repeated in the input (e.g. "convert 5 kg and 5 lb") still
 * satisfies two separate items. Skips the check entirely when the input has
 * no numeric token to compare against (e.g. an implied "a kilogram to ounces").
 */
export function hasFabricatedValue(text: string, itemValues: number[]): boolean {
  const remaining = numbersIn(text);
  if (remaining.length === 0) return false;
  for (const value of itemValues) {
    const idx = remaining.findIndex((s) => Math.abs(s - value) < 1e-9);
    if (idx === -1) return true;
    remaining.splice(idx, 1);
  }
  return false;
}
