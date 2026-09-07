import { describe, expect, it } from 'vitest';
import { dimensionOf, findDimensionMismatch } from '../src/dimensions';

describe('dimensionOf', () => {
  it('classifies known units', () => {
    expect(dimensionOf('km')).toBe('length');
    expect(dimensionOf('BTU')).toBe('energy');
    expect(dimensionOf('kW')).toBe('power');
    expect(dimensionOf('ไร่')).toBe('area');
  });

  it('returns null for unknown units', () => {
    expect(dimensionOf('flibbertigibbet')).toBeNull();
  });
});

describe('findDimensionMismatch', () => {
  it('allows same-dimension conversions', () => {
    expect(findDimensionMismatch(['km'], 'miles')).toBeNull();
    expect(findDimensionMismatch(['btu/h'], 'kW')).toBeNull();
  });

  it('flags BTU -> W as a dimension mismatch (energy vs power)', () => {
    const result = findDimensionMismatch(['btu'], 'W');
    expect(result).not.toBeNull();
    expect(result?.itemDimension).toBe('energy');
    expect(result?.targetDimension).toBe('power');
  });

  it('flags J -> W as a dimension mismatch (energy vs power)', () => {
    const result = findDimensionMismatch(['J'], 'W');
    expect(result).not.toBeNull();
    expect(result?.itemDimension).toBe('energy');
    expect(result?.targetDimension).toBe('power');
  });

  it('skips the check when a unit is unknown to the table', () => {
    expect(findDimensionMismatch(['flibbertigibbet'], 'km')).toBeNull();
  });
});
