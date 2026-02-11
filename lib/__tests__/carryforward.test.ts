/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, currentMonth, prevMonth, nextMonth, mu, ZERO } from './test-helpers';
import type { createDbFunctions } from '../repos';
import type { DrizzleDB } from '../db/helpers';
import { budgetMonths } from '../db/schema';

let db: DrizzleDB;
let fns: ReturnType<typeof createDbFunctions>;
let budgetId: number;

beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;
    fns = testDb.fns;
    budgetId = testDb.defaultBudgetId;
});

describe('Carryforward Logic', () => {
    it('carries forward positive available to the next month', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const next = nextMonth(month);

        // Assign $500 in current month
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));

        // Carryforward to next month should be 500
        const carryforward = await fns.computeCarryforward(budgetId, categoryIds[0], next);
        expect(carryforward).toBe(500);
    });

    it('resets negative available to 0 for regular categories', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const next = nextMonth(month);

        // Create overspent category (negative available)
        await db.insert(budgetMonths).values({
            categoryId: categoryIds[0],
            month,
            assigned: mu(100),
            activity: mu(-200),
            available: mu(-100),
        });

        // Carryforward should be 0 (not -100)
        const carryforward = await fns.computeCarryforward(budgetId, categoryIds[0], next);
        expect(carryforward).toBe(0);
    });

    it('carries forward negative available for CC Payment categories (debt)', async () => {
        // Create a CC account and its CC Payment category
        const accResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccAccountId = accResult.id;

        const ccCategory = (await fns.ensureCreditCardPaymentCategory(ccAccountId, 'Visa'))!;
        const ccCatId = ccCategory.id;

        const month = currentMonth();
        const next = nextMonth(month);

        // Insert negative available (CC debt)
        await db.insert(budgetMonths).values({
            categoryId: ccCatId,
            month,
            assigned: ZERO,
            activity: mu(-500),
            available: mu(-500),
        });

        // CC Payment should carry forward the debt
        const carryforward = await fns.computeCarryforward(budgetId, ccCatId, next);
        expect(carryforward).toBe(-500);
    });

    it('handles multi-month gaps correctly', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Create budget in current month
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(300));

        // Skip two months ahead
        const twoMonthsLater = nextMonth(nextMonth(month));
        const carryforward = await fns.computeCarryforward(budgetId, categoryIds[0], twoMonthsLater);
        expect(carryforward).toBe(300);
    });

    it('returns 0 when no previous month data exists', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        const carryforward = await fns.computeCarryforward(budgetId, categoryIds[0], month);
        expect(carryforward).toBe(0);
    });

    it('returns 0 when previous available is exactly 0', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const next = nextMonth(month);

        await db.insert(budgetMonths).values({
            categoryId: categoryIds[0],
            month,
            assigned: mu(100),
            activity: mu(-100),
            available: ZERO,
        });

        const carryforward = await fns.computeCarryforward(budgetId, categoryIds[0], next);
        expect(carryforward).toBe(0);
    });
});
