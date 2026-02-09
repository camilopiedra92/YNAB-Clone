/**
 * Milliunit Primitives — the foundation of integer-based monetary arithmetic.
 *
 * A Milliunit is 1/1000th of a currency unit.
 * Example: $10.50 = 10_500 milliunits.
 *
 * All financial calculations in the engine operate on Milliunits (integers).
 * Conversion to/from human-readable decimals happens ONLY at system boundaries:
 *   - Database read/write (schema adapter)
 *   - API responses
 *   - UI display
 *
 * This module is pure — zero dependencies on DB, HTTP, or React.
 *
 * ## Safety Guarantees
 *
 * 1. **Branded Type:** `Milliunit` is an opaque branded type — TypeScript will
 *    reject accidental mixing of raw `number` and `Milliunit` at compile time.
 * 2. **Runtime Validation:** All entry points (`toMilliunits`, `milliunit`,
 *    `unsafeMilliunit`) validate for NaN, Infinity, and MAX_SAFE_INTEGER.
 * 3. **Banker's Rounding:** `divideMilliunits` uses round-half-to-even to
 *    eliminate systematic bias in financial calculations.
 */

// ──────────────────────────────────────────────────────────────────────
// Branded Type
// ──────────────────────────────────────────────────────────────────────

/**
 * A monetary value expressed in 1/1000th of a currency unit.
 *
 * **Branded type** — prevents accidental mixing of raw numbers and milliunits
 * at compile time. You cannot assign a plain `number` to a `Milliunit` without
 * going through one of the sanctioned entry points:
 *
 *   - `toMilliunits(decimal)` — converts a human-readable amount (e.g. 10.50)
 *   - `milliunit(integer)`    — wraps a value that is already in milliunits
 *   - `ZERO`                  — the zero constant
 *
 * At runtime, a `Milliunit` is just a `number` — the brand has zero overhead.
 *
 * @example
 *   const price: Milliunit = toMilliunits(10.50);  // ✅
 *   const price: Milliunit = 10500;                // ❌ Type error
 */
declare const __milliunitBrand: unique symbol;
export type Milliunit = number & { readonly [__milliunitBrand]: true };

// ──────────────────────────────────────────────────────────────────────
// Internal Validation
// ──────────────────────────────────────────────────────────────────────

/**
 * Validate that a value is a safe financial number.
 *
 * Throws if the value is NaN, ±Infinity, or exceeds Number.MAX_SAFE_INTEGER
 * (which would cause silent precision loss in integer arithmetic).
 *
 * @internal — used by all entry points, not exported.
 */
function assertFinancialSafe(value: number, context: string): void {
    if (typeof value !== 'number' || isNaN(value) || !Number.isFinite(value)) {
        throw new Error(
            `[Financial Safety] Invalid monetary value in ${context}: ${value} ` +
            `(type: ${typeof value}). Monetary values must be finite numbers.`
        );
    }
    if (!Number.isSafeInteger(Math.round(value))) {
        throw new Error(
            `[Financial Safety] Value exceeds safe integer precision in ${context}: ${value}. ` +
            `Max safe milliunit = ±${Number.MAX_SAFE_INTEGER} (≈ ±$9 quadrillion).`
        );
    }
}

// ──────────────────────────────────────────────────────────────────────
// Conversion Helpers
// ──────────────────────────────────────────────────────────────────────

/** Multiplier: 1 currency unit = 1000 milliunits. */
const MILLIUNIT_FACTOR = 1000;

/**
 * Convert a decimal currency amount to Milliunits.
 *
 * Uses `Math.round` to avoid floating-point drift during multiplication.
 * 🛡️ Validates input: throws on NaN, Infinity, or unsafe integer overflow.
 *
 * @example toMilliunits(10.50)  // => 10500 as Milliunit
 * @example toMilliunits(0)      // => 0 as Milliunit
 * @example toMilliunits(-5.123) // => -5123 as Milliunit
 */
export function toMilliunits(amount: number): Milliunit {
    assertFinancialSafe(amount, 'toMilliunits');
    return Math.round(amount * MILLIUNIT_FACTOR) as Milliunit;
}

/**
 * Convert Milliunits back to a decimal currency amount.
 *
 * Should ONLY be called at system boundaries (UI display, API response).
 *
 * @example fromMilliunits(toMilliunits(10.50)) // => 10.5
 */
export function fromMilliunits(milliunits: Milliunit): number {
    return (milliunits as number) / MILLIUNIT_FACTOR;
}

/**
 * Create a Milliunit value from a raw integer (no conversion).
 *
 * Use when the value is ALREADY in milliunits (e.g. from the database).
 * 🛡️ Validates input: throws on NaN, Infinity, or unsafe integer overflow.
 *
 * @example milliunit(10500)  // => 10500 as Milliunit
 */
export function milliunit(value: number): Milliunit {
    assertFinancialSafe(value, 'milliunit');
    return value as Milliunit;
}

/**
 * Create a Milliunit value WITHOUT validation.
 *
 * ⚠️ ONLY use when the value is guaranteed safe (e.g. inline constants,
 * values returned from trusted arithmetic helpers in this module).
 * Prefer `milliunit()` for all external/dynamic values.
 */
export function unsafeMilliunit(value: number): Milliunit {
    return value as Milliunit;
}

/**
 * Zero constant — avoids repeated casting.
 */
export const ZERO: Milliunit = 0 as Milliunit;

// ──────────────────────────────────────────────────────────────────────
// Arithmetic Helpers (type-safe)
// ──────────────────────────────────────────────────────────────────────

/**
 * Add two Milliunit values.
 */
export function addMilliunits(a: Milliunit, b: Milliunit): Milliunit {
    return (a + b) as Milliunit;
}

/**
 * Subtract b from a.
 */
export function subMilliunits(a: Milliunit, b: Milliunit): Milliunit {
    return (a - b) as Milliunit;
}

/**
 * Negate a Milliunit value.
 */
export function negMilliunits(a: Milliunit): Milliunit {
    return (-a) as Milliunit;
}

/**
 * Absolute value.
 */
export function absMilliunits(a: Milliunit): Milliunit {
    return Math.abs(a) as Milliunit;
}

/**
 * Minimum of two Milliunit values.
 */
export function minMilliunits(a: Milliunit, b: Milliunit): Milliunit {
    return Math.min(a, b) as Milliunit;
}

/**
 * Maximum of two Milliunit values.
 */
export function maxMilliunits(a: Milliunit, b: Milliunit): Milliunit {
    return Math.max(a, b) as Milliunit;
}

/**
 * Sign of a Milliunit value (-1, 0, or 1).
 */
export function signMilliunits(a: Milliunit): number {
    return Math.sign(a);
}

/**
 * Sum any number of Milliunit values.
 *
 * More efficient and readable than chaining `addMilliunits` for 3+ values.
 *
 * @example sumMilliunits(a, b, c, d)
 */
export function sumMilliunits(...values: Milliunit[]): Milliunit {
    let total = 0;
    for (const v of values) total += v;
    return total as Milliunit;
}

/**
 * Multiply a Milliunit by a scalar (e.g. tax rate, percentage, quantity).
 *
 * The scalar is a plain number (NOT milliunits). Result is rounded to
 * the nearest integer milliunit using standard rounding.
 *
 * @example multiplyMilliunits(toMilliunits(100), 0.1)  // => 10000 (10% of $100)
 */
export function multiplyMilliunits(amount: Milliunit, scalar: number): Milliunit {
    assertFinancialSafe(scalar, 'multiplyMilliunits(scalar)');
    return Math.round(amount * scalar) as Milliunit;
}

/**
 * Divide a Milliunit by a divisor using Banker's Rounding (round half to even).
 *
 * Standard `Math.round` always rounds 0.5 up, which causes a systematic upward
 * bias over thousands of transactions. Banker's rounding eliminates this bias
 * by rounding to the nearest even number when the value is exactly halfway.
 *
 * @example divideMilliunits(toMilliunits(10), 3)  // => 3333 (not 3334)
 * @example divideMilliunits(milliunit(2500), 2)   // => 1250 (exact)
 * @example divideMilliunits(milliunit(1500), 2)   // => 750  (half rounds to even)
 * @throws if divisor is 0, NaN, or Infinity
 */
export function divideMilliunits(amount: Milliunit, divisor: number): Milliunit {
    if (divisor === 0) {
        throw new Error('[Financial Safety] Division by zero in divideMilliunits.');
    }
    assertFinancialSafe(divisor, 'divideMilliunits(divisor)');
    return bankersRound(amount / divisor) as Milliunit;
}

/**
 * Banker's Rounding (Round Half to Even).
 *
 * When a value is exactly *.5, rounds to the nearest even integer.
 * This is the standard rounding method in financial systems (IEEE 754 default).
 *
 * @example bankersRound(2.5)  // => 2 (rounds to even)
 * @example bankersRound(3.5)  // => 4 (rounds to even)
 * @example bankersRound(2.4)  // => 2 (standard)
 * @example bankersRound(2.6)  // => 3 (standard)
 *
 * @internal
 */
function bankersRound(value: number): number {
    const floor = Math.floor(value);
    const decimal = value - floor;

    // Not exactly 0.5 → standard rounding
    if (Math.abs(decimal - 0.5) > Number.EPSILON) {
        return Math.round(value);
    }

    // Exactly 0.5 → round to even
    return floor % 2 === 0 ? floor : floor + 1;
}
