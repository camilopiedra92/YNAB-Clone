import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, currentMonth, today } from './test-helpers';
import type { createDbFunctions } from '../db';
import Database from 'better-sqlite3';

let db: Database.Database;
let fns: ReturnType<typeof createDbFunctions>;

beforeEach(() => {
    const testDb = createTestDb();
    db = testDb.db;
    fns = testDb.fns;
});

describe('Budget Assignment', () => {
    it('creates a budget_months entry when assigned > 0', () => {
        const { categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();

        fns.updateBudgetAssignment(categoryIds[0], month, 500);

        const row: any = db.prepare(
            'SELECT * FROM budget_months WHERE category_id = ? AND month = ?'
        ).get(categoryIds[0], month);

        expect(row).toBeDefined();
        expect(row.assigned).toBe(500);
        expect(row.available).toBe(500); // No carryforward
    });

    it('does NOT create a row when assigned = 0 (ghost entry prevention)', () => {
        const { categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();

        fns.updateBudgetAssignment(categoryIds[0], month, 0);

        const row = db.prepare(
            'SELECT * FROM budget_months WHERE category_id = ? AND month = ?'
        ).get(categoryIds[0], month);

        expect(row).toBeUndefined();
    });

    it('deletes ghost entry when assigned set back to 0', () => {
        const { categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();

        // Create a row
        fns.updateBudgetAssignment(categoryIds[0], month, 500);
        expect(db.prepare('SELECT * FROM budget_months WHERE category_id = ? AND month = ?')
            .get(categoryIds[0], month)).toBeDefined();

        // Set back to 0 — should delete
        fns.updateBudgetAssignment(categoryIds[0], month, 0);
        const row = db.prepare('SELECT * FROM budget_months WHERE category_id = ? AND month = ?')
            .get(categoryIds[0], month);
        expect(row).toBeUndefined();
    });

    it('propagates delta to future months', () => {
        const { categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();
        const nextM = (() => {
            const [y, m] = month.split('-').map(Number);
            const d = new Date(y, m);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        })();

        // Assign in current month
        fns.updateBudgetAssignment(categoryIds[0], month, 500);
        // Assign in next month
        fns.updateBudgetAssignment(categoryIds[0], nextM, 200);

        // Next month available = carryforward(500) + assigned(200) = 700
        const nextRow: any = db.prepare(
            'SELECT * FROM budget_months WHERE category_id = ? AND month = ?'
        ).get(categoryIds[0], nextM);
        expect(nextRow.available).toBe(700);

        // Now update current month — delta should propagate
        fns.updateBudgetAssignment(categoryIds[0], month, 800);

        const updatedNextRow: any = db.prepare(
            'SELECT * FROM budget_months WHERE category_id = ? AND month = ?'
        ).get(categoryIds[0], nextM);
        // Next month available should increase by 300 (800 - 500)
        expect(updatedNextRow.available).toBe(1000);
    });

    it('rejects NaN values', () => {
        const { categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();

        fns.updateBudgetAssignment(categoryIds[0], month, NaN);

        const row = db.prepare(
            'SELECT * FROM budget_months WHERE category_id = ? AND month = ?'
        ).get(categoryIds[0], month);
        expect(row).toBeUndefined();
    });

    it('rejects Infinity values', () => {
        const { categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();

        fns.updateBudgetAssignment(categoryIds[0], month, Infinity);

        const row = db.prepare(
            'SELECT * FROM budget_months WHERE category_id = ? AND month = ?'
        ).get(categoryIds[0], month);
        expect(row).toBeUndefined();
    });

    it('clamps extreme values', () => {
        const { categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();

        fns.updateBudgetAssignment(categoryIds[0], month, 999_999_999_999);

        const row: any = db.prepare(
            'SELECT * FROM budget_months WHERE category_id = ? AND month = ?'
        ).get(categoryIds[0], month);
        expect(row.assigned).toBe(100_000_000_000); // Clamped to max
    });

    it('includes carryforward when creating new entry in future month', () => {
        const { categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();
        const nextM = (() => {
            const [y, m] = month.split('-').map(Number);
            const d = new Date(y, m);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        })();

        // Assign in current month — creates available = 500
        fns.updateBudgetAssignment(categoryIds[0], month, 500);

        // Now assign in next month — should include carryforward
        fns.updateBudgetAssignment(categoryIds[0], nextM, 200);

        const row: any = db.prepare(
            'SELECT * FROM budget_months WHERE category_id = ? AND month = ?'
        ).get(categoryIds[0], nextM);
        expect(row.available).toBe(700); // 500 carryforward + 200 assigned
    });
});

describe('Budget Activity', () => {
    it('calculates activity from transactions', () => {
        const { accountId, categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();

        // Assign budget
        fns.updateBudgetAssignment(categoryIds[0], month, 500);

        // Spend against the category
        fns.createTransaction({
            accountId,
            date: today(),
            categoryId: categoryIds[0],
            outflow: 100,
        });

        fns.updateBudgetActivity(categoryIds[0], month);

        const row: any = db.prepare(
            'SELECT * FROM budget_months WHERE category_id = ? AND month = ?'
        ).get(categoryIds[0], month);

        expect(row.activity).toBe(-100); // YNAB convention: spending is negative
        expect(row.available).toBe(400); // 500 assigned - 100 spent
    });

    it('handles inflows to a category (refunds)', () => {
        const { accountId, categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();

        fns.updateBudgetAssignment(categoryIds[0], month, 200);

        // Refund
        fns.createTransaction({
            accountId,
            date: today(),
            categoryId: categoryIds[0],
            inflow: 50,
        });

        fns.updateBudgetActivity(categoryIds[0], month);

        const row: any = db.prepare(
            'SELECT * FROM budget_months WHERE category_id = ? AND month = ?'
        ).get(categoryIds[0], month);

        expect(row.activity).toBe(50);
        expect(row.available).toBe(250); // 200 + 50
    });
});
