import { dimensionOf } from './dimensions';

const NUMBER_TOKEN = /\d+(?:[.,]\d+)?/g;
// "to" only, matching the same connector the Flutter LocalParser's own
// splitter uses - "in" is deliberately excluded here because it's also the
// region-qualifier preposition (e.g. "1 bigha in Bihar to square meters"),
// so treating it as a connector would grab the wrong split point.
const CONNECTOR = /\bto\b/i;

export interface SimplePair {
  sourceUnit: string;
  targetUnit: string;
}

/** Prefers the full multi-word phrase (e.g. "square meters" -> "square_meters")
 *  when the dimension table recognizes it, else falls back to just the last
 *  word - so a two-word unit is never truncated into a wrong single word. */
function bestUnitPhrase(phrase: string): string {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return phrase.trim();
  const joined = words.join('_');
  return dimensionOf(joined) ? joined : words[words.length - 1];
}

/**
 * Deliberately narrow, deterministic extraction of the single clearest
 * phrasing shape - "<one number> <unit phrase> to <unit phrase>" - so
 * resolve.ts can run the existing dimension guard BEFORE ever calling the
 * AI resolver for requests unambiguous enough not to need it. Returns null
 * for anything else (multi-item input like "5 feet 8 inches", non-English
 * connectors, no connector at all, etc.) so all genuinely ambiguous or
 * natural-language input still goes to the AI resolver exactly as before.
 *
 * This never resolves a conversion itself - it only feeds two unit phrases
 * to the existing dimensions.ts table for a mismatch check.
 */
export function extractSimplePair(text: string): SimplePair | null {
  const trimmed = text.trim();

  const numbers = [...trimmed.matchAll(NUMBER_TOKEN)];
  if (numbers.length !== 1) return null;

  const connector = CONNECTOR.exec(trimmed);
  if (!connector) return null;

  const numberEnd = numbers[0].index! + numbers[0][0].length;
  if (connector.index <= numberEnd) return null;

  const sourcePhrase = trimmed.slice(numberEnd, connector.index);
  const targetPhrase = trimmed.slice(connector.index + connector[0].length).replace(/[.?!]+\s*$/, '');

  const sourceUnit = bestUnitPhrase(sourcePhrase);
  const targetUnit = bestUnitPhrase(targetPhrase);
  if (!sourceUnit || !targetUnit) return null;

  return { sourceUnit, targetUnit };
}
