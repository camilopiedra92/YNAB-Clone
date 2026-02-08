import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, currentMonth, prevMonth, nextMonth } from './test-helpers';
import type { createDbFunctions } from '../db';
import Database from 'better-sqlite3';

let db: Database.Database;
let fns: ReturnType<typeof createDbFunctions>;

beforeEach(() => {
    const testDb = createTestDb();
    db = testDb.db;
    fns = testDb.fns;
});

describe('Carryforward Logic', () => {
    it('carries forward positive available to the next month', () => {
        const { categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();
        const next = nextMonth(month);

        // Assign $500 in current month
        fns.updateBudgetAssignment(categoryIds[0], month, 500);

        // Carryforward to next month should be 500
        const carryforward = fns.computeCarryforward(categoryIds[0], next);
        expect(carryforward).toBe(500);
    });

    it('resets negative available to 0 for regular categories', () => {
        const { categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();
        const next = nextMonth(month);

        // Create overspent category (negative available)
        db.prepare(`
      INSERT INTO budget_months (category_id, month, assigned, activity, available)
      VALUES (?, ?, 100, -200, -100)
    `).run(categoryIds[0], month);

        // Carryforward should be 0 (not -100)
        const carryforward = fns.computeCarryforward(categoryIds[0], next);
        expect(carryforward).toBe(0);
    });

    it('carries forward negative available for CC Payment categories (debt)', () => {
        // Create a CC account and its CC Payment category
        const accResult = fns.createAccount({ name: 'Visa', type: 'credit' });
        const ccAccountId = Number(accResult.lastInsertRowid);

        const ccCategory = fns.ensureCreditCardPaymentCategory(ccAccountId, 'Visa');
        const ccCatId = ccCategory.id;

        const month = currentMonth();
        const next = nextMonth(month);

        // Insert negative available (CC debt)
        db.prepare(`
      INSERT INTO budget_months (category_id, month, assigned, activity, available)
      VALUES (?, ?, 0, -500, -500)
    `).run(ccCatId, month);

        // CC Payment should carry forward the debt
        const carryforward = fns.computeCarryforward(ccCatId, next);
        expect(carryforward).toBe(-500);
    });

    it('handles multi-month gaps correctly', () => {
        const { categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();

        // Create budget in current month
        fns.updateBudgetAssignment(categoryIds[0], month, 300);

        // Skip two months ahead
        const twoMonthsLater = nextMonth(nextMonth(month));
        const carryforward = fns.computeCarryforward(categoryIds[0], twoMonthsLater);
        expect(carryforward).toBe(300);
    });

    it('returns 0 when no previous month data exists', () => {
        const { categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();

        const carryforward = fns.computeCarryforward(categoryIds[0], month);
        expect(carryforward).toBe(0);
    });

    it('returns 0 when previous available is exactly 0', () => {
        const { categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();
        const next = nextMonth(month);

        db.prepare(`
      INSERT INTO budget_months (category_id, month, assigned, activity, available)
      VALUES (?, ?, 100, -100, 0)
    `).run(categoryIds[0], month);

        const carryforward = fns.computeCarryforward(categoryIds[0], next);
        expect(carryforward).toBe(0);
    });
});
