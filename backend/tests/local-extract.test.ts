import { describe, expect, it } from 'vitest';
import { extractSimplePair } from '../src/local-extract';

describe('extractSimplePair', () => {
  it('extracts a simple "<number> <unit> to <unit>" pair', () => {
    expect(extractSimplePair('100 kg to °C')).toEqual({ sourceUnit: 'kg', targetUnit: '°C' });
  });

  it('handles a leading word and trailing punctuation ("Convert X to Y.")', () => {
    expect(extractSimplePair('Convert 10 kilometers to miles.')).toEqual({
      sourceUnit: 'kilometers',
      targetUnit: 'miles',
    });
  });

  it('joins a two-word target phrase when the table recognizes it (never truncates "square meters" to "meters")', () => {
    expect(extractSimplePair('1 bigha to square meters')).toEqual({
      sourceUnit: 'bigha',
      targetUnit: 'square_meters',
    });
  });

  it('returns null for multi-item input (more than one number)', () => {
    expect(extractSimplePair('5 feet 8 inches to cm')).toBeNull();
  });

  it('returns null when there is no English "to"/"in" connector (e.g. Thai phrasing)', () => {
    expect(extractSimplePair('1 กิโลกรัม เท่ากับกี่ออนซ์')).toBeNull();
  });

  it('returns null for input with no number at all', () => {
    expect(extractSimplePair('kilograms to ounces')).toBeNull();
  });

  it('handles a unit containing a slash ("BTU/h")', () => {
    expect(extractSimplePair('12000 BTU/h to kW')).toEqual({ sourceUnit: 'BTU/h', targetUnit: 'kW' });
  });
});
