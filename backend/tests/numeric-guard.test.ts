import { describe, expect, it } from 'vitest';
import { hasFabricatedValue } from '../src/numeric-guard';

describe('hasFabricatedValue', () => {
  it('flags a value the AI derived instead of reading off the input', () => {
    expect(hasFabricatedValue('3 ไร่ 4 งาน เป็นกี่ตารางเมตร', [1.3333333333333333, 0.6666666666666666])).toBe(
      true,
    );
  });

  it('does not flag values that are literally stated in the input', () => {
    expect(hasFabricatedValue('3 ไร่ 4 งาน เป็นกี่ตารางเมตร', [3, 4])).toBe(false);
  });

  it('does not flag a single stated value', () => {
    expect(hasFabricatedValue('5 lb to kg', [5])).toBe(false);
  });

  it('tolerates floating-point noise for an exact match', () => {
    expect(hasFabricatedValue('0.1 kg to g', [0.1])).toBe(false);
  });

  it('skips the check when the input has no numeric token at all', () => {
    expect(hasFabricatedValue('a kilogram to ounces', [1])).toBe(false);
  });

  it('flags a duplicated item reusing the same single stated number twice', () => {
    // Real observed failure: "1公斤等于多少盎司？" (only one literal "1") came
    // back as two items, {value:1,unit:kilogram} and {value:1,unit:ounce}.
    expect(hasFabricatedValue('1公斤等于多少盎司？', [1, 1])).toBe(true);
  });

  it('does not flag a number that is legitimately repeated in the input', () => {
    expect(hasFabricatedValue('convert 5 kg and 5 lb to grams', [5, 5])).toBe(false);
  });
});
