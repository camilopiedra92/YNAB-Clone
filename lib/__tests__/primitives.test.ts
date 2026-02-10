/**
 * Unit tests for Milliunit primitives — conversion, validation, and arithmetic.
 *
 * Pure tests — no database or external dependencies.
 */
import { describe, it, expect } from 'vitest';
import {
  toMilliunits,
  fromMilliunits,
  milliunit,
  unsafeMilliunit,
  ZERO,
  addMilliunits,
  subMilliunits,
  negMilliunits,
  absMilliunits,
  minMilliunits,
  maxMilliunits,
  signMilliunits,
  sumMilliunits,
  multiplyMilliunits,
  divideMilliunits,
  type Milliunit,
} from '../engine/primitives';

/** Shorthand cast */
const m = (n: number) => n as Milliunit;

// ═══════════════════════════════════════════════════════════════════════
// Conversion Helpers
// ═══════════════════════════════════════════════════════════════════════

describe('toMilliunits', () => {
  it('converts positive decimals', () => {
    expect(toMilliunits(10.50)).toBe(10500);
  });

  it('converts zero', () => {
    expect(toMilliunits(0)).toBe(0);
  });

  it('converts negative decimals', () => {
    expect(toMilliunits(-5.123)).toBe(-5123);
  });

  it('rounds to avoid floating-point drift', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(toMilliunits(0.1 + 0.2)).toBe(300);
  });

  it('throws on NaN', () => {
    expect(() => toMilliunits(NaN)).toThrow('[Financial Safety]');
  });

  it('throws on Infinity', () => {
    expect(() => toMilliunits(Infinity)).toThrow('[Financial Safety]');
  });

  it('throws on -Infinity', () => {
    expect(() => toMilliunits(-Infinity)).toThrow('[Financial Safety]');
  });
});

describe('fromMilliunits', () => {
  it('converts back to decimal', () => {
    expect(fromMilliunits(m(10500))).toBe(10.5);
  });

  it('handles zero', () => {
    expect(fromMilliunits(m(0))).toBe(0);
  });

  it('handles negative', () => {
    expect(fromMilliunits(m(-5000))).toBe(-5);
  });

  it('round-trips correctly', () => {
    expect(fromMilliunits(toMilliunits(10.50))).toBe(10.5);
  });
});

describe('milliunit', () => {
  it('wraps a raw integer', () => {
    expect(milliunit(10500)).toBe(10500);
  });

  it('throws on NaN', () => {
    expect(() => milliunit(NaN)).toThrow('[Financial Safety]');
  });

  it('throws on Infinity', () => {
    expect(() => milliunit(Infinity)).toThrow('[Financial Safety]');
  });

  it('throws on value exceeding MAX_SAFE_INTEGER', () => {
    expect(() => milliunit(Number.MAX_SAFE_INTEGER + 1)).toThrow('safe integer precision');
  });
});

describe('unsafeMilliunit', () => {
  it('wraps without validation', () => {
    expect(unsafeMilliunit(42)).toBe(42);
  });
});

describe('ZERO', () => {
  it('is zero', () => {
    expect(ZERO).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Arithmetic Helpers
// ═══════════════════════════════════════════════════════════════════════

describe('addMilliunits', () => {
  it('adds two values', () => {
    expect(addMilliunits(m(100), m(200))).toBe(300);
  });

  it('handles negatives', () => {
    expect(addMilliunits(m(100), m(-300))).toBe(-200);
  });
});

describe('subMilliunits', () => {
  it('subtracts b from a', () => {
    expect(subMilliunits(m(500), m(200))).toBe(300);
  });

  it('can go negative', () => {
    expect(subMilliunits(m(100), m(300))).toBe(-200);
  });
});

describe('negMilliunits', () => {
  it('negates positive', () => {
    expect(negMilliunits(m(500))).toBe(-500);
  });

  it('negates negative', () => {
    expect(negMilliunits(m(-200))).toBe(200);
  });

  it('zero stays zero', () => {
    // JS: -0 === 0 is true, but Object.is(-0, 0) is false
    expect(negMilliunits(m(0))).toBe(-0);
  });
});

describe('absMilliunits', () => {
  it('returns positive for negative', () => {
    expect(absMilliunits(m(-500))).toBe(500);
  });

  it('returns same for positive', () => {
    expect(absMilliunits(m(500))).toBe(500);
  });
});

describe('minMilliunits', () => {
  it('returns the smaller value', () => {
    expect(minMilliunits(m(100), m(200))).toBe(100);
    expect(minMilliunits(m(300), m(50))).toBe(50);
  });
});

describe('maxMilliunits', () => {
  it('returns the larger value', () => {
    expect(maxMilliunits(m(100), m(200))).toBe(200);
    expect(maxMilliunits(m(300), m(50))).toBe(300);
  });
});

describe('signMilliunits', () => {
  it('returns 1 for positive', () => {
    expect(signMilliunits(m(500))).toBe(1);
  });

  it('returns -1 for negative', () => {
    expect(signMilliunits(m(-500))).toBe(-1);
  });

  it('returns 0 for zero', () => {
    expect(signMilliunits(m(0))).toBe(0);
  });
});

describe('sumMilliunits', () => {
  it('sums zero values', () => {
    expect(sumMilliunits()).toBe(0);
  });

  it('sums one value', () => {
    expect(sumMilliunits(m(100))).toBe(100);
  });

  it('sums multiple values', () => {
    expect(sumMilliunits(m(100), m(200), m(300), m(-50))).toBe(550);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Multiply & Divide
// ═══════════════════════════════════════════════════════════════════════

describe('multiplyMilliunits', () => {
  it('multiplies by a scalar', () => {
    // $100 * 0.1 = $10 = 10000 milliunits
    expect(multiplyMilliunits(m(100000), 0.1)).toBe(10000);
  });

  it('rounds the result', () => {
    // 1000 * 0.333... = 333.0 (rounded)
    expect(multiplyMilliunits(m(1000), 1 / 3)).toBe(333);
  });

  it('throws on NaN scalar', () => {
    expect(() => multiplyMilliunits(m(100), NaN)).toThrow('[Financial Safety]');
  });

  it('throws on Infinity scalar', () => {
    expect(() => multiplyMilliunits(m(100), Infinity)).toThrow('[Financial Safety]');
  });
});

describe('divideMilliunits', () => {
  it('divides evenly', () => {
    expect(divideMilliunits(m(1000), 2)).toBe(500);
  });

  it('throws on division by zero', () => {
    expect(() => divideMilliunits(m(1000), 0)).toThrow('Division by zero');
  });

  it('throws on NaN divisor', () => {
    expect(() => divideMilliunits(m(1000), NaN)).toThrow('[Financial Safety]');
  });

  it('uses bankers rounding (half to even) — even floor', () => {
    // 2500 / 2 = 1250 (exact, no rounding needed)
    expect(divideMilliunits(m(2500), 2)).toBe(1250);
  });

  it('uses bankers rounding (half to even) — rounds down to even', () => {
    // 2500 / 1000 = 2.5 → rounds to 2 (even)
    expect(divideMilliunits(m(2500), 1000)).toBe(2);
  });

  it('uses bankers rounding (half to even) — rounds up to even', () => {
    // 3500 / 1000 = 3.5 → rounds to 4 (even)
    expect(divideMilliunits(m(3500), 1000)).toBe(4);
  });

  it('rounds normally for non-0.5 decimals', () => {
    // 10000 / 3 = 3333.33... → 3333
    expect(divideMilliunits(m(10000), 3)).toBe(3333);
  });
});
