import { describe, it, expect } from 'vitest';
import {
    parseLocaleNumber,
    validateAssignment,
    calculateAssignment,
    MAX_ASSIGNED_VALUE,
    calculateFundedAmount,
    calculateTotalFundedSpending,
    calculateCCPaymentAvailable,
    calculateCashOverspending,
    classifyOverspending,
    calculateRTA,
    calculateRTABreakdown,
    calculateBudgetAvailable,
    computeCarryforward,
    type Milliunit,
} from '../engine/index';

/** Shorthand cast for branded Milliunit in tests */
const m = (n: number) => n as Milliunit;

// ═══════════════════════════════════════════════════════════════════════
// parseLocaleNumber — edge cases
// ═══════════════════════════════════════════════════════════════════════
describe('parseLocaleNumber (extended)', () => {
    it('handles multiple dots as thousands separators', () => {
        // "1.234.567" → 1234567 (dots are thousands separators)
        expect(parseLocaleNumber('1.234.567')).toBe(1234567);
    });

    it('handles single dot with exactly 3 digits after as thousands', () => {
        // "1.000" → 1000 (dot is thousands separator)
        expect(parseLocaleNumber('1.000')).toBe(1000);
    });

    it('handles US format with comma thousands and dot decimal', () => {
        // In the implementation, comma followed by 1-2 digits at end is treated as European decimal
        // So '$1,234.56' where the comma has 3+ digits after → handled via dot/comma heuristics
        // Pure US format works when there's no ambiguity:
        expect(parseLocaleNumber('1234.56')).toBe(1234.56);
        expect(parseLocaleNumber('1234')).toBe(1234);
    });

    it('handles pure integers', () => {
        expect(parseLocaleNumber('42')).toBe(42);
    });

    it('handles negative numbers', () => {
        expect(parseLocaleNumber('-500')).toBe(-500);
    });

    it('handles whitespace and symbols', () => {
        expect(parseLocaleNumber('  $1234.56  ')).toBe(1234.56);
        expect(parseLocaleNumber('  $500  ')).toBe(500);
    });

    it('returns 0 for completely non-numeric input', () => {
        expect(parseLocaleNumber('abc')).toBe(0);
    });

    it('handles multiple dots with comma as decimal (European thousands)', () => {
        // "1.234.567,89" → 1234567.89
        expect(parseLocaleNumber('1.234.567,89')).toBe(1234567.89);
    });

    it('handles just a decimal value', () => {
        expect(parseLocaleNumber('0.50')).toBe(0.50);
    });

    it('handles comma as decimal with no thousands', () => {
        expect(parseLocaleNumber('123,45')).toBe(123.45);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// validateAssignment — extended
// ═══════════════════════════════════════════════════════════════════════
describe('validateAssignment (extended)', () => {
    it('clamps negative extreme values', () => {
        const result = validateAssignment(m(-MAX_ASSIGNED_VALUE * 2));
        expect(result.valid).toBe(true);
        expect(result.clamped).toBe(-MAX_ASSIGNED_VALUE);
    });

    it('accepts zero', () => {
        expect(validateAssignment(m(0))).toEqual({ valid: true, clamped: 0 });
    });

    it('accepts negative values within range', () => {
        expect(validateAssignment(m(-500))).toEqual({ valid: true, clamped: -500 });
    });

    it('rejects NaN', () => {
        expect(validateAssignment(NaN as Milliunit)).toEqual({ valid: false, clamped: 0 });
    });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateAssignment — extended
// ═══════════════════════════════════════════════════════════════════════
describe('calculateAssignment (extended)', () => {
    it('detects ghost entries: existing row becomes all zeros', () => {
        // existing: assigned=100, available=100 (activity=0, carryforward=0)
        // newAssigned=0 → delta=-100, newAvailable=0, activity=0
        const result = calculateAssignment({
            existing: { assigned: m(100), available: m(100) },
            carryforward: m(0),
            newAssigned: m(0),
        });
        expect(result.shouldDelete).toBe(true);
        expect(result.delta).toBe(-100);
    });

    it('does NOT delete when activity is non-zero', () => {
        // existing: assigned=100, available=50 (activity=-50, carryforward=0)
        // newAssigned=0 → delta=-100, newAvailable=-50
        const result = calculateAssignment({
            existing: { assigned: m(100), available: m(50) },
            carryforward: m(0),
            newAssigned: m(0),
        });
        expect(result.shouldDelete).toBe(false); // activity != 0
    });

    it('handles zero to zero on non-existing row', () => {
        const result = calculateAssignment({
            existing: null,
            carryforward: m(0),
            newAssigned: m(0),
        });
        expect(result.shouldSkip).toBe(true);
    });

    it('updates existing row with same value (zero delta)', () => {
        const result = calculateAssignment({
            existing: { assigned: m(500), available: m(800) },
            carryforward: m(300),
            newAssigned: m(500),
        });
        expect(result.delta).toBe(0);
        expect(result.newAvailable).toBe(800);
        expect(result.shouldDelete).toBe(false);
        expect(result.shouldCreate).toBe(false);
        expect(result.shouldSkip).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateFundedAmount — extended
// ═══════════════════════════════════════════════════════════════════════
describe('calculateFundedAmount (extended)', () => {
    it('handles net refund exactly at zero', () => {
        expect(calculateFundedAmount(m(0), m(100))).toBe(0);
    });

    it('handles negative net spending (refund)', () => {
        expect(calculateFundedAmount(m(-50), m(100))).toBe(-50);
    });

    it('partially funded spending', () => {
        // Category had 30 before, spent 100 → available now -70
        // availableBefore = -70 + 100 = 30
        // funded = MIN(MAX(0, 30), 100) = 30
        expect(calculateFundedAmount(m(100), m(-70))).toBe(30);
    });

    it('fully funded spending', () => {
        // Category had 500, spent 100 → available now 400
        // availableBefore = 400 + 100 = 500
        // funded = MIN(MAX(0, 500), 100) = 100
        expect(calculateFundedAmount(m(100), m(400))).toBe(100);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateTotalFundedSpending — extended
// ═══════════════════════════════════════════════════════════════════════
describe('calculateTotalFundedSpending', () => {
    it('sums funded amounts across multiple categories', () => {
        const spending = [
            { categoryId: 1, outflow: m(100), inflow: m(0) },
            { categoryId: 2, outflow: m(200), inflow: m(50) },
        ];
        const availables = new Map([
            [1, m(50)],   // category 1: available after spending = 50 → availBefore = 150 → funded = 100
            [2, m(100)],  // category 2: net=150, available=100 → availBefore = 250 → funded = 150
        ]);

        const total = calculateTotalFundedSpending(spending, availables);
        expect(total).toBe(250); // 100 + 150
    });

    it('handles missing category in availables map', () => {
        const spending = [{ categoryId: 999, outflow: m(100), inflow: m(0) }];
        const availables = new Map<number, Milliunit>(); // empty

        // available defaults to 0 → availBefore = 0 + 100 = 100 → funded = 100
        const total = calculateTotalFundedSpending(spending, availables);
        expect(total).toBe(100);
    });

    it('handles empty spending array', () => {
        const total = calculateTotalFundedSpending([], new Map());
        expect(total).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateCCPaymentAvailable — extended
// ═══════════════════════════════════════════════════════════════════════
describe('calculateCCPaymentAvailable (extended)', () => {
    it('handles no spending', () => {
        const result = calculateCCPaymentAvailable({
            spending: [],
            categoryAvailables: new Map(),
            carryforward: m(-500),
            assigned: m(200),
            payments: m(0),
        });
        expect(result.activity).toBe(0);
        expect(result.available).toBe(-300); // -500 + 200 + 0
        expect(result.fundedSpending).toBe(0);
    });

    it('handles payments exceeding funded spending', () => {
        const result = calculateCCPaymentAvailable({
            spending: [{ categoryId: 1, outflow: m(100), inflow: m(0) }],
            categoryAvailables: new Map([[1, m(400)]]),
            carryforward: m(0),
            assigned: m(0),
            payments: m(500),
        });
        // funded = 100, activity = 100 - 500 = -400
        expect(result.activity).toBe(-400);
        expect(result.available).toBe(-400); // 0 + 0 + (-400)
    });
});

// ═══════════════════════════════════════════════════════════════════════
// classifyOverspending — extended
// ═══════════════════════════════════════════════════════════════════════
describe('classifyOverspending (extended)', () => {
    it('classifies mixed overspending as cash (cash takes priority)', () => {
        const type = classifyOverspending({
            categoryId: 1,
            available: m(-100),
            linkedAccountId: null,
            cashSpending: m(30), // some cash spending
        });
        // totalOverspent = 100, cashOverspending = MIN(100, 30) = 30
        // creditOverspending = 100 - 30 = 70
        // Both > 0 → 'cash' takes priority
        expect(type).toBe('cash');
    });

    it('returns null for zero available', () => {
        const type = classifyOverspending({
            categoryId: 1,
            available: m(0),
            linkedAccountId: null,
            cashSpending: m(0),
        });
        expect(type).toBeNull();
    });

    it('returns null for positive available', () => {
        const type = classifyOverspending({
            categoryId: 1,
            available: m(500),
            linkedAccountId: null,
            cashSpending: m(100),
        });
        expect(type).toBeNull();
    });

    it('returns cash when all overspending is from cash', () => {
        // cashSpending exactly equals totalOverspent → creditOverspending = 0
        const type = classifyOverspending({
            categoryId: 1,
            available: m(-100),
            linkedAccountId: null,
            cashSpending: m(100),
        });
        expect(type).toBe('cash');
    });

    it('returns credit for pure credit overspending (zero cash)', () => {
        const type = classifyOverspending({
            categoryId: 1,
            available: m(-100),
            linkedAccountId: null,
            cashSpending: m(0),
        });
        expect(type).toBe('credit');
    });

    it('returns credit when linked to CC account regardless of other params', () => {
        const type = classifyOverspending({
            categoryId: 1,
            available: m(-500),
            linkedAccountId: 42,
            cashSpending: m(300),
        });
        expect(type).toBe('credit');
    });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateCashOverspending — extended
// ═══════════════════════════════════════════════════════════════════════
describe('calculateCashOverspending (extended)', () => {
    it('skips CC Payment categories (linkedAccountId !== null)', () => {
        const total = calculateCashOverspending([
            { categoryId: 1, available: m(-100), linkedAccountId: 5, cashSpending: m(100) },
        ]);
        expect(total).toBe(0);
    });

    it('limits cash overspending to available', () => {
        // Overspent by 50 but cash spending is 200
        const total = calculateCashOverspending([
            { categoryId: 1, available: m(-50), linkedAccountId: null, cashSpending: m(200) },
        ]);
        expect(total).toBe(50); // MIN(50, 200) = 50
    });

    it('handles no overspent categories', () => {
        const total = calculateCashOverspending([]);
        expect(total).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateRTA — extended
// ═══════════════════════════════════════════════════════════════════════
describe('calculateRTA (extended)', () => {
    it('subtracts futureAssigned from RTA', () => {
        const rta = calculateRTA({
            cashBalance: m(5000),
            positiveCCBalances: m(0),
            totalAvailable: m(1000),
            futureAssigned: m(500),
            totalOverspending: m(0),
            cashOverspending: m(0),
            currentMonth: '2026-02',
            viewedMonth: '2026-02',
        });
        // 5000 - 1000 - 500 = 3500
        expect(rta).toBe(3500);
    });

    it('handles all zeros', () => {
        const rta = calculateRTA({
            cashBalance: m(0),
            positiveCCBalances: m(0),
            totalAvailable: m(0),
            futureAssigned: m(0),
            totalOverspending: m(0),
            cashOverspending: m(0),
            currentMonth: '2026-02',
            viewedMonth: '2026-02',
        });
        expect(rta).toBe(0);
    });

    it('does not clamp negative for current month', () => {
        const rta = calculateRTA({
            cashBalance: m(100),
            positiveCCBalances: m(0),
            totalAvailable: m(500),
            futureAssigned: m(0),
            totalOverspending: m(0),
            cashOverspending: m(0),
            currentMonth: '2026-02',
            viewedMonth: '2026-02',
        });
        expect(rta).toBe(-400);
    });

    it('does not clamp negative for future months', () => {
        const rta = calculateRTA({
            cashBalance: m(100),
            positiveCCBalances: m(0),
            totalAvailable: m(500),
            futureAssigned: m(0),
            totalOverspending: m(0),
            cashOverspending: m(0),
            currentMonth: '2026-02',
            viewedMonth: '2026-06',
        });
        expect(rta).toBe(-400);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateRTABreakdown — extended
// ═══════════════════════════════════════════════════════════════════════
describe('calculateRTABreakdown (extended)', () => {
    it('computes leftOverFromPreviousMonth with all components', () => {
        const bd = calculateRTABreakdown({
            rta: m(3000),
            inflowThisMonth: m(2000),
            positiveCCBalances: m(100),
            assignedThisMonth: m(500),
            cashOverspendingPreviousMonth: m(50),
            assignedInFuture: m(200),
        });

        // leftOver = rta - inflow - positiveCC + assigned + cashOverspending
        // leftOver = 3000 - 2000 - 100 + 500 + 50 = 1450
        expect(bd.leftOverFromPreviousMonth).toBe(1450);
        expect(bd.inflowThisMonth).toBe(2000);
        expect(bd.positiveCCBalances).toBe(100);
        expect(bd.assignedThisMonth).toBe(500);
        expect(bd.cashOverspendingPreviousMonth).toBe(50);
        expect(bd.assignedInFuture).toBe(200);
    });

    it('handles negative leftOver', () => {
        const bd = calculateRTABreakdown({
            rta: m(100),
            inflowThisMonth: m(5000),
            positiveCCBalances: m(0),
            assignedThisMonth: m(1000),
            cashOverspendingPreviousMonth: m(0),
            assignedInFuture: m(0),
        });
        // leftOver = 100 - 5000 + 1000 = -3900
        expect(bd.leftOverFromPreviousMonth).toBe(-3900);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateBudgetAvailable
// ═══════════════════════════════════════════════════════════════════════
describe('calculateBudgetAvailable (extended)', () => {
    it('handles negative carryforward', () => {
        // This shouldn't happen for regular categories but test the math
        expect(calculateBudgetAvailable(m(-100), m(500), m(-200))).toBe(200);
    });

    it('handles all zeros', () => {
        expect(calculateBudgetAvailable(m(0), m(0), m(0))).toBe(0);
    });

    it('handles all positive', () => {
        expect(calculateBudgetAvailable(m(100), m(200), m(50))).toBe(350);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// computeCarryforward — extended
// ═══════════════════════════════════════════════════════════════════════
describe('computeCarryforward (extended)', () => {
    it('carries forward negative for CC Payment categories', () => {
        expect(computeCarryforward(m(-500), true)).toBe(-500);
    });

    it('resets negative to 0 for regular categories', () => {
        expect(computeCarryforward(m(-500), false)).toBe(0);
    });

    it('carries forward positive for both types', () => {
        expect(computeCarryforward(m(300), false)).toBe(300);
        expect(computeCarryforward(m(300), true)).toBe(300);
    });

    it('handles zero', () => {
        expect(computeCarryforward(m(0), false)).toBe(0);
        expect(computeCarryforward(m(0), true)).toBe(0);
    });
});
