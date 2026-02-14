/**
 * Unit tests for the pure financial engine.
 *
 * These tests run in isolation — no database, no SQLite, no DB helpers.
 * They test every engine module with hardcoded inputs and expected outputs.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect } from 'vitest';
import {
    computeCarryforward,
    calculateRTA,
    calculateRTABreakdown,
    parseLocaleNumber,
    validateAssignment,
    calculateAssignment,
    MAX_ASSIGNED_VALUE,
    calculateFundedAmount,
    calculateTotalFundedSpending,
    calculateCCPaymentAvailable,
    calculateCashOverspending,
    classifyOverspending,
    calculateBudgetAvailable,
    validateMoveMoney,
    type Milliunit,
} from '../engine';

/** Shorthand cast for branded Milliunit in tests */
const m = (n: number) => n as Milliunit;

// ═══════════════════════════════════════════════════════════════════════
// Carryforward
// ═══════════════════════════════════════════════════════════════════════

describe('computeCarryforward', () => {
    it('returns 0 for null available', () => {
        expect(computeCarryforward(null, false)).toBe(0);
        expect(computeCarryforward(null, true)).toBe(0);
    });

    it('returns 0 for zero available', () => {
        expect(computeCarryforward(m(0), false)).toBe(0);
        expect(computeCarryforward(m(0), true)).toBe(0);
    });

    it('carries forward positive values', () => {
        expect(computeCarryforward(m(500), false)).toBe(500);
        expect(computeCarryforward(m(500), true)).toBe(500);
    });

    it('resets negative to 0 for regular categories', () => {
        expect(computeCarryforward(m(-200), false)).toBe(0);
    });

    it('carries forward negative for CC Payment categories (debt)', () => {
        expect(computeCarryforward(m(-200), true)).toBe(-200);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// RTA
// ═══════════════════════════════════════════════════════════════════════

describe('calculateRTA', () => {
    it('basic RTA = cash + positiveCC − available', () => {
        const rta = calculateRTA({
            cashBalance: m(5000),
            positiveCCBalances: m(100),
            totalAvailable: m(1500),
            futureAssigned: m(0),
            totalOverspending: m(0),
            cashOverspending: m(0),
            currentMonth: '2026-02',
            viewedMonth: '2026-02',
        });
        expect(rta).toBe(3600);
    });

    it('subtracts future assigned', () => {
        const rta = calculateRTA({
            cashBalance: m(5000),
            positiveCCBalances: m(0),
            totalAvailable: m(1000),
            futureAssigned: m(500),
            totalOverspending: m(0),
            cashOverspending: m(0),
            currentMonth: '2026-02',
            viewedMonth: '2026-03',
        });
        expect(rta).toBe(3500); // 5000 - 1000 - 500
    });

    it('credit overspending correction', () => {
        const rta = calculateRTA({
            cashBalance: m(5000),
            positiveCCBalances: m(0),
            totalAvailable: m(4000),
            futureAssigned: m(0),
            totalOverspending: m(300),
            cashOverspending: m(100),
            currentMonth: '2026-02',
            viewedMonth: '2026-02',
        });
        // 5000 - 4000 - 0 = 1000; creditOverspending = 300 - 100 = 200; RTA = 1000 - 200 = 800
        expect(rta).toBe(800);
    });

    it('returns 0 for past months regardless of computed value', () => {
        const rta = calculateRTA({
            cashBalance: m(1000),
            positiveCCBalances: m(0),
            totalAvailable: m(2000),
            futureAssigned: m(0),
            totalOverspending: m(0),
            cashOverspending: m(0),
            currentMonth: '2026-02',
            viewedMonth: '2026-01',
        });
        expect(rta).toBe(0); // Past month always returns 0

        // Also verify with positive computed RTA
        const rtaPositive = calculateRTA({
            cashBalance: m(5000),
            positiveCCBalances: m(0),
            totalAvailable: m(1000),
            futureAssigned: m(0),
            totalOverspending: m(0),
            cashOverspending: m(0),
            currentMonth: '2026-02',
            viewedMonth: '2026-01',
        });
        expect(rtaPositive).toBe(0); // Past month always returns 0, even if positive
    });

    it('allows negative RTA for current/future months', () => {
        const rta = calculateRTA({
            cashBalance: m(1000),
            positiveCCBalances: m(0),
            totalAvailable: m(2000),
            futureAssigned: m(0),
            totalOverspending: m(0),
            cashOverspending: m(0),
            currentMonth: '2026-02',
            viewedMonth: '2026-02',
        });
        expect(rta).toBe(-1000);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// RTA Breakdown
// ═══════════════════════════════════════════════════════════════════════

describe('calculateRTABreakdown', () => {
    it('back-calculates leftOver correctly', () => {
        const bd = calculateRTABreakdown({
            rta: m(2000),
            inflowThisMonth: m(5000),
            positiveCCBalances: m(100),
            assignedThisMonth: m(1500),
            cashOverspendingPreviousMonth: m(200),
            assignedInFuture: m(300),
        });

        // leftOver = 2000 - 5000 - 100 + 1500 + 200 = -1400
        expect(bd.leftOverFromPreviousMonth).toBe(-1400);
        expect(bd.readyToAssign).toBe(2000);
        expect(bd.assignedInFuture).toBe(300);
    });

    it('passes through all fields', () => {
        const bd = calculateRTABreakdown({
            rta: m(1000),
            inflowThisMonth: m(1000),
            positiveCCBalances: m(0),
            assignedThisMonth: m(0),
            cashOverspendingPreviousMonth: m(0),
            assignedInFuture: m(0),
        });
        expect(bd.leftOverFromPreviousMonth).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// Assignment
// ═══════════════════════════════════════════════════════════════════════

describe('parseLocaleNumber', () => {
    it('parses plain numbers', () => {
        expect(parseLocaleNumber('1234.56')).toBe(1234.56);
        expect(parseLocaleNumber('500')).toBe(500);
        expect(parseLocaleNumber('0')).toBe(0);
    });

    it('parses European format', () => {
        expect(parseLocaleNumber('1.234,56')).toBe(1234.56);
    });

    it('returns 0 for non-numeric', () => {
        expect(parseLocaleNumber('abc')).toBe(0);
        expect(parseLocaleNumber('')).toBe(0);
    });

    it('handles currency symbols', () => {
        expect(parseLocaleNumber('$1234.56')).toBe(1234.56);
        expect(parseLocaleNumber('€1.234,56')).toBe(1234.56);
    });
});

describe('validateAssignment', () => {
    it('accepts normal values', () => {
        expect(validateAssignment(m(1000))).toEqual({ valid: true, clamped: 1000 });
    });

    it('rejects non-finite values', () => {
        expect(validateAssignment(NaN as Milliunit)).toEqual({ valid: false, clamped: 0 });
        expect(validateAssignment(Infinity as Milliunit)).toEqual({ valid: false, clamped: 0 });
    });

    it('clamps extreme values', () => {
        const result = validateAssignment(m(MAX_ASSIGNED_VALUE * 2));
        expect(result.valid).toBe(true);
        expect(result.clamped).toBe(MAX_ASSIGNED_VALUE);
    });
});

describe('calculateAssignment', () => {
    it('updates existing row and computes delta', () => {
        const result = calculateAssignment({
            existing: { assigned: m(500), available: m(800) },
            carryforward: m(300),
            newAssigned: m(1000),
        });
        expect(result.delta).toBe(500); // 1000 - 500
        expect(result.shouldCreate).toBe(false);
        expect(result.shouldSkip).toBe(false);
    });

    it('detects ghost entry on zero assignment', () => {
        const result = calculateAssignment({
            existing: { assigned: m(500), available: m(500) },
            carryforward: m(0),
            newAssigned: m(0),
        });
        expect(result.delta).toBe(-500);
        expect(result.shouldDelete).toBe(true);
    });

    it('skips when no existing row and assigned=0', () => {
        const result = calculateAssignment({
            existing: null,
            carryforward: m(0),
            newAssigned: m(0),
        });
        expect(result.shouldSkip).toBe(true);
    });

    it('creates new row with carryforward', () => {
        const result = calculateAssignment({
            existing: null,
            carryforward: m(300),
            newAssigned: m(500),
        });
        expect(result.shouldCreate).toBe(true);
        expect(result.newAvailable).toBe(800); // 300 + 500
        expect(result.delta).toBe(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// CC Payment
// ═══════════════════════════════════════════════════════════════════════

describe('calculateFundedAmount', () => {
    it('fully funds spending within available', () => {
        // Category has 100 available, spends 80
        // currentAvailable = 100 - 80 = 20 (after spending)
        expect(calculateFundedAmount(m(80), m(20))).toBe(80);
    });

    it('partially funds overspending', () => {
        // Category had 80 available, spends 100 → overspent by 20
        // currentAvailable = 80 - 100 = -20
        expect(calculateFundedAmount(m(100), m(-20))).toBe(80);
    });

    it('handles refunds (negative net spending)', () => {
        expect(calculateFundedAmount(m(-50), m(300))).toBe(-50);
    });

    it('handles zero available category', () => {
        // Category had 0 available, spends 100
        // currentAvailable = 0 - 100 = -100
        expect(calculateFundedAmount(m(100), m(-100))).toBe(0);
    });
});

describe('calculateCCPaymentAvailable', () => {
    it('computes full CC Payment available', () => {
        const result = calculateCCPaymentAvailable({
            spending: [
                { categoryId: 1, outflow: m(100), inflow: m(0) },
                { categoryId: 2, outflow: m(200), inflow: m(0) },
            ],
            categoryAvailables: new Map([[1, m(50)], [2, m(200)]]),  // cat1: -50 after, cat2: 0 after
            carryforward: m(500),
            assigned: m(100),
            payments: m(150),
        });

        // Cat1: netSpending=100, currentAvailable=50, availableBefore=150, funded=100
        // Cat2: netSpending=200, currentAvailable=200, availableBefore=400, funded=200
        // totalFunded = 300
        // activity = 300 - 150 = 150
        // available = 500 + 100 + 150 = 750
        expect(result.fundedSpending).toBe(300);
        expect(result.activity).toBe(150);
        expect(result.available).toBe(750);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// Overspending
// ═══════════════════════════════════════════════════════════════════════

describe('calculateCashOverspending', () => {
    it('sums cash overspending across categories', () => {
        const total = calculateCashOverspending([
            { categoryId: 1, available: m(-100), linkedAccountId: null, cashSpending: m(80) },
            { categoryId: 2, available: m(-200), linkedAccountId: null, cashSpending: m(300) },
        ]);
        // Cat1: MIN(100, 80) = 80; Cat2: MIN(200, 300) = 200
        expect(total).toBe(280);
    });

    it('ignores CC Payment categories', () => {
        const total = calculateCashOverspending([
            { categoryId: 1, available: m(-100), linkedAccountId: 5, cashSpending: m(100) },
        ]);
        expect(total).toBe(0);
    });

    it('ignores non-overspent categories', () => {
        const total = calculateCashOverspending([
            { categoryId: 1, available: m(100), linkedAccountId: null, cashSpending: m(50) },
        ]);
        expect(total).toBe(0);
    });
});

describe('classifyOverspending', () => {
    it('returns null for non-overspent', () => {
        expect(classifyOverspending({
            categoryId: 1, available: m(100), linkedAccountId: null, cashSpending: m(0),
        })).toBeNull();
    });

    it('returns credit for CC Payment categories', () => {
        expect(classifyOverspending({
            categoryId: 1, available: m(-100), linkedAccountId: 5, cashSpending: m(0),
        })).toBe('credit');
    });

    it('returns cash for pure cash overspending', () => {
        expect(classifyOverspending({
            categoryId: 1, available: m(-100), linkedAccountId: null, cashSpending: m(100),
        })).toBe('cash');
    });

    it('returns credit for pure credit overspending', () => {
        expect(classifyOverspending({
            categoryId: 1, available: m(-100), linkedAccountId: null, cashSpending: m(0),
        })).toBe('credit');
    });

    it('returns cash for mixed (cash takes priority)', () => {
        expect(classifyOverspending({
            categoryId: 1, available: m(-100), linkedAccountId: null, cashSpending: m(50),
        })).toBe('cash');
    });
});

// ═══════════════════════════════════════════════════════════════════════
// Activity
// ═══════════════════════════════════════════════════════════════════════

describe('calculateBudgetAvailable', () => {
    it('sums carryforward + assigned + activity', () => {
        expect(calculateBudgetAvailable(m(300), m(500), m(-100))).toBe(700);
    });

    it('handles all zeros', () => {
        expect(calculateBudgetAvailable(m(0), m(0), m(0))).toBe(0);
    });

    it('handles negative carryforward (should not happen for regular, but engine is agnostic)', () => {
        expect(calculateBudgetAvailable(m(-200), m(500), m(-100))).toBe(200);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// Move Money
// ═══════════════════════════════════════════════════════════════════════

describe('validateMoveMoney', () => {
    it('rejects zero amount', () => {
        const result = validateMoveMoney({
            amount: m(0), sourceAvailable: m(500), sourceCategoryId: 1, targetCategoryId: 2,
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('zero_amount');
    });

    it('rejects negative amount', () => {
        const result = validateMoveMoney({
            amount: m(-100), sourceAvailable: m(500), sourceCategoryId: 1, targetCategoryId: 2,
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('negative_amount');
    });

    it('rejects NaN', () => {
        const result = validateMoveMoney({
            amount: NaN as Milliunit, sourceAvailable: m(500), sourceCategoryId: 1, targetCategoryId: 2,
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('non_finite_amount');
    });

    it('rejects Infinity', () => {
        const result = validateMoveMoney({
            amount: Infinity as Milliunit, sourceAvailable: m(500), sourceCategoryId: 1, targetCategoryId: 2,
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('non_finite_amount');
    });

    it('rejects same source and target', () => {
        const result = validateMoveMoney({
            amount: m(100), sourceAvailable: m(500), sourceCategoryId: 1, targetCategoryId: 1,
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('same_category');
    });

    it('allows valid move within available', () => {
        const result = validateMoveMoney({
            amount: m(300), sourceAvailable: m(500), sourceCategoryId: 1, targetCategoryId: 2,
        });
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.warning).toBeUndefined();
        expect(result.clampedAmount).toBe(300);
    });

    it('allows exact available amount', () => {
        const result = validateMoveMoney({
            amount: m(500), sourceAvailable: m(500), sourceCategoryId: 1, targetCategoryId: 2,
        });
        expect(result.valid).toBe(true);
        expect(result.warning).toBeUndefined();
    });

    it('allows exceeding available with warning (YNAB behavior)', () => {
        const result = validateMoveMoney({
            amount: m(800), sourceAvailable: m(500), sourceCategoryId: 1, targetCategoryId: 2,
        });
        expect(result.valid).toBe(true);
        expect(result.warning).toBe('exceeds_available');
        expect(result.clampedAmount).toBe(800);
    });

    it('allows moving from zero-available source with warning', () => {
        const result = validateMoveMoney({
            amount: m(100), sourceAvailable: m(0), sourceCategoryId: 1, targetCategoryId: 2,
        });
        expect(result.valid).toBe(true);
        expect(result.warning).toBe('exceeds_available');
    });

    it('clamps to MAX_ASSIGNED_VALUE', () => {
        const result = validateMoveMoney({
            amount: m(MAX_ASSIGNED_VALUE * 2), sourceAvailable: m(MAX_ASSIGNED_VALUE * 3), sourceCategoryId: 1, targetCategoryId: 2,
        });
        expect(result.valid).toBe(true);
        expect(result.clampedAmount).toBe(MAX_ASSIGNED_VALUE);
    });
});
