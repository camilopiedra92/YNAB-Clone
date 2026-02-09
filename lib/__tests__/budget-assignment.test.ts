/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, currentMonth, today, mu } from './test-helpers';
import type { createDbFunctions } from '../repos';
import type { DrizzleDB } from '../repos/client';
import { budgetMonths } from '../db/schema';
import { eq, and } from 'drizzle-orm';

let db: DrizzleDB;
let fns: ReturnType<typeof createDbFunctions>;

beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;
    fns = testDb.fns;
});

describe('Budget Assignment', () => {
    it('creates a budget_months entry when assigned > 0', async () => {
        const { categoryIds } = await seedBasicBudget(fns);
        const month = currentMonth();

        await fns.updateBudgetAssignment(categoryIds[0], month, mu(500));

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));

        expect(rows).toHaveLength(1);
        expect(rows[0].assigned).toBe(500);
        expect(rows[0].available).toBe(500); // No carryforward
    });

    it('does NOT create a row when assigned = 0 (ghost entry prevention)', async () => {
        const { categoryIds } = await seedBasicBudget(fns);
        const month = currentMonth();

        await fns.updateBudgetAssignment(categoryIds[0], month, mu(0));

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));

        expect(rows).toHaveLength(0);
    });

    it('deletes ghost entry when assigned set back to 0', async () => {
        const { categoryIds } = await seedBasicBudget(fns);
        const month = currentMonth();

        // Create a row
        await fns.updateBudgetAssignment(categoryIds[0], month, mu(500));
        let rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));
        expect(rows).toHaveLength(1);

        // Set back to 0 — should delete
        await fns.updateBudgetAssignment(categoryIds[0], month, mu(0));
        rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));
        expect(rows).toHaveLength(0);
    });

    it('propagates delta to future months', async () => {
        const { categoryIds } = await seedBasicBudget(fns);
        const month = currentMonth();
        const nextM = (() => {
            const [y, m] = month.split('-').map(Number);
            const d = new Date(y, m);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        })();

        // Assign in current month
        await fns.updateBudgetAssignment(categoryIds[0], month, mu(500));
        // Assign in next month
        await fns.updateBudgetAssignment(categoryIds[0], nextM, mu(200));

        // Next month available = carryforward(500) + assigned(200) = 700
        let nextRows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, nextM)
            ));
        expect(nextRows[0].available).toBe(700);

        // Now update current month — delta should propagate
        await fns.updateBudgetAssignment(categoryIds[0], month, mu(800));

        nextRows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, nextM)
            ));
        // Next month available should increase by 300 (800 - 500)
        expect(nextRows[0].available).toBe(1000);
    });

    it('rejects NaN values', async () => {
        const { categoryIds } = await seedBasicBudget(fns);
        const month = currentMonth();

        await fns.updateBudgetAssignment(categoryIds[0], month, NaN as any);

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));
        expect(rows).toHaveLength(0);
    });

    it('rejects Infinity values', async () => {
        const { categoryIds } = await seedBasicBudget(fns);
        const month = currentMonth();

        await fns.updateBudgetAssignment(categoryIds[0], month, Infinity as any);

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));
        expect(rows).toHaveLength(0);
    });

    it('clamps extreme values', async () => {
        const { categoryIds } = await seedBasicBudget(fns);
        const month = currentMonth();

        await fns.updateBudgetAssignment(categoryIds[0], month, mu(999_999_999_999_999));

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));
        expect(rows[0].assigned).toBe(100_000_000_000_000); // Clamped to MAX_ASSIGNED_VALUE (milliunits)
    });

    it('includes carryforward when creating new entry in future month', async () => {
        const { categoryIds } = await seedBasicBudget(fns);
        const month = currentMonth();
        const nextM = (() => {
            const [y, m] = month.split('-').map(Number);
            const d = new Date(y, m);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        })();

        // Assign in current month — creates available = 500
        await fns.updateBudgetAssignment(categoryIds[0], month, mu(500));

        // Now assign in next month — should include carryforward
        await fns.updateBudgetAssignment(categoryIds[0], nextM, mu(200));

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, nextM)
            ));
        expect(rows[0].available).toBe(700); // 500 carryforward + 200 assigned
    });
});

describe('Budget Activity', () => {
    it('calculates activity from transactions', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns);
        const month = currentMonth();

        // Assign budget
        await fns.updateBudgetAssignment(categoryIds[0], month, mu(500));

        // Spend against the category
        await fns.createTransaction({
            accountId,
            date: today(),
            categoryId: categoryIds[0],
            outflow: mu(100),
        });

        await fns.updateBudgetActivity(categoryIds[0], month);

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));

        expect(rows[0].activity).toBe(-100); // YNAB convention: spending is negative
        expect(rows[0].available).toBe(400); // 500 assigned - 100 spent
    });

    it('handles inflows to a category (refunds)', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns);
        const month = currentMonth();

        await fns.updateBudgetAssignment(categoryIds[0], month, mu(200));

        // Refund
        await fns.createTransaction({
            accountId,
            date: today(),
            categoryId: categoryIds[0],
            inflow: mu(50),
        });

        await fns.updateBudgetActivity(categoryIds[0], month);

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));

        expect(rows[0].activity).toBe(50);
        expect(rows[0].available).toBe(250); // 200 + 50
    });
});
