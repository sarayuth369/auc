import { describe, expect, it } from 'vitest';
import { hasThaiLocalUnitMismatch } from '../src/local-unit-tokens';

describe('hasThaiLocalUnitMismatch', () => {
  it('flags a domain swap: "rai/ngan" input but "hour/minute" output', () => {
    expect(hasThaiLocalUnitMismatch('3 ไร่ 4 งาน เป็นกี่ตารางเมตร', ['hour'], 'minute')).toBe(true);
  });

  it('does not flag a correct rai/ngan -> square_meter response', () => {
    expect(hasThaiLocalUnitMismatch('3 ไร่ 4 งาน เป็นกี่ตารางเมตร', ['rai', 'ngan'], 'square_meter')).toBe(
      false,
    );
  });

  it('does not flag when the token only appears in the target (e.g. "5 acres to ตารางเมตร")', () => {
    expect(hasThaiLocalUnitMismatch('5 acres to ตารางเมตร', ['acre'], 'square_meter')).toBe(false);
  });

  it('is a no-op when no Thai local-unit token is present at all', () => {
    expect(hasThaiLocalUnitMismatch('10 km to miles', ['hour'], 'minute')).toBe(false);
  });

  it('is case/whitespace tolerant on the returned unit ids', () => {
    expect(hasThaiLocalUnitMismatch('1 ไร่ to square meters', [' RAI '], 'square_meter')).toBe(false);
  });
});
