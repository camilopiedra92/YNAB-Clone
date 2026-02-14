/**
 * Integration tests for moveMoney — uses PGlite in-process database.
 *
 * Tests the full orchestration: query → engine → write → refresh.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, currentMonth, mu } from './test-helpers';
import type { DrizzleDB } from '../db/helpers';
import { budgetMonths } from '../db/schema';
import { and, eq } from 'drizzle-orm';

type TestFns = Awaited<ReturnType<typeof createTestDb>>['fns'];

/** Read assigned and available for a category in a given month */
async function getBudgetRow(db: DrizzleDB, categoryId: number, month: string) {
    const rows = await db.select({
        assigned: budgetMonths.assigned,
        available: budgetMonths.available,
    })
        .from(budgetMonths)
        .where(and(eq(budgetMonths.categoryId, categoryId), eq(budgetMonths.month, month)));
    return rows[0] ?? null;
}

describe('moveMoney', () => {
    let db: DrizzleDB;
    let fns: TestFns;
    let budgetId: number;
    let categoryIds: number[];
    const month = currentMonth();

    beforeEach(async () => {
        const testDb = await createTestDb();
        db = testDb.db;
        fns = testDb.fns;
        budgetId = testDb.defaultBudgetId;

        const seed = await seedBasicBudget(fns, {
            db,
            budgetId,
            categoryCount: 3,
            accountType: 'checking',
        });
        categoryIds = seed.categoryIds;

        // Setup initial assignments: Cat1 = 1000, Cat2 = 500, Cat3 = 0
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(1000));
        await fns.updateBudgetAssignment(budgetId, categoryIds[1], month, mu(500));
    });

    it('moves money: source assigned/available decreases, target increases', async () => {
        await fns.moveMoney(budgetId, categoryIds[0], categoryIds[1], month, mu(300));

        const source = await getBudgetRow(db, categoryIds[0], month);
        const target = await getBudgetRow(db, categoryIds[1], month);

        expect(Number(source!.assigned)).toBe(700);   // 1000 - 300
        expect(Number(source!.available)).toBe(700);   // no activity, so available = assigned
        expect(Number(target!.assigned)).toBe(800);    // 500 + 300
        expect(Number(target!.available)).toBe(800);
    });

    it('moves full available from source (source goes to 0)', async () => {
        await fns.moveMoney(budgetId, categoryIds[0], categoryIds[1], month, mu(1000));

        const source = await getBudgetRow(db, categoryIds[0], month);
        const target = await getBudgetRow(db, categoryIds[1], month);

        // source should be deleted (ghost entry prevention: assigned=0, activity=0, available=0)
        expect(source).toBeNull();
        expect(Number(target!.assigned)).toBe(1500);   // 500 + 1000
        expect(Number(target!.available)).toBe(1500);
    });

    it('moves to a category with no existing budget_months row', async () => {
        // categoryIds[2] has no assignment yet
        await fns.moveMoney(budgetId, categoryIds[0], categoryIds[2], month, mu(400));

        const source = await getBudgetRow(db, categoryIds[0], month);
        const target = await getBudgetRow(db, categoryIds[2], month);

        expect(Number(source!.assigned)).toBe(600);    // 1000 - 400
        expect(Number(target!.assigned)).toBe(400);    // 0 + 400 (new row created)
        expect(Number(target!.available)).toBe(400);
    });

    it('allows overspending the source (amount > source available)', async () => {
        // Move more than source has — YNAB allows this
        await fns.moveMoney(budgetId, categoryIds[0], categoryIds[1], month, mu(1500));

        const source = await getBudgetRow(db, categoryIds[0], month);
        const target = await getBudgetRow(db, categoryIds[1], month);

        expect(Number(source!.assigned)).toBe(-500);   // 1000 - 1500
        expect(Number(source!.available)).toBe(-500);
        expect(Number(target!.assigned)).toBe(2000);   // 500 + 1500
        expect(Number(target!.available)).toBe(2000);
    });

    it('preserves total assigned across categories (RTA invariant)', async () => {
        // Total before = 1000 + 500 = 1500
        await fns.moveMoney(budgetId, categoryIds[0], categoryIds[1], month, mu(300));

        const source = await getBudgetRow(db, categoryIds[0], month);
        const target = await getBudgetRow(db, categoryIds[1], month);

        const totalAfter = Number(source!.assigned) + Number(target!.assigned);
        expect(totalAfter).toBe(1500);  // invariant: total assigned unchanged
    });

    it('propagates delta to future months for both categories', async () => {
        // Create future month entries for both categories
        const futureMonth = (() => {
            const [y, m] = month.split('-').map(Number);
            const d = new Date(y, m);  // next month
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        })();

        await fns.updateBudgetAssignment(budgetId, categoryIds[0], futureMonth, mu(200));
        await fns.updateBudgetAssignment(budgetId, categoryIds[1], futureMonth, mu(100));

        // Before: future Cat1 available = carryforward(1000) + 200 = 1200
        // Before: future Cat2 available = carryforward(500) + 100 = 600

        await fns.moveMoney(budgetId, categoryIds[0], categoryIds[1], month, mu(300));

        const futureSource = await getBudgetRow(db, categoryIds[0], futureMonth);
        const futureTarget = await getBudgetRow(db, categoryIds[1], futureMonth);

        // Future Cat1 available should decrease by 300 (the delta propagated)
        expect(Number(futureSource!.available)).toBe(900);  // 1200 - 300
        // Future Cat2 available should increase by 300
        expect(Number(futureTarget!.available)).toBe(900);   // 600 + 300
    });
});
