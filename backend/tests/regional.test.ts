import { describe, expect, it } from 'vitest';
import { canonicalRegionalUnit, needsRegionClarification } from '../src/regional';

describe('needsRegionClarification', () => {
  it('is true for a region-dependent unit with no region given', () => {
    expect(needsRegionClarification('bigha', undefined)).toBe(true);
    expect(needsRegionClarification('bigha', '')).toBe(true);
  });

  it('is false once a region is given', () => {
    expect(needsRegionClarification('bigha', 'Bihar')).toBe(false);
  });

  it('is false for units that are not region-dependent', () => {
    expect(needsRegionClarification('rai', undefined)).toBe(false);
  });
});

describe('canonicalRegionalUnit', () => {
  it('builds a lowercase, underscore-joined composite id', () => {
    expect(canonicalRegionalUnit('bigha', 'Bihar')).toBe('bigha_bihar');
    expect(canonicalRegionalUnit('bigha', 'West Bengal')).toBe('bigha_west_bengal');
  });
});
