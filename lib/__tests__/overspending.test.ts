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

describe('Overspending Detection', () => {
    it('detects cash overspending (red) from cash account transactions', () => {
        const { accountId, categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();

        // Budget $50 for category 1
        fns.updateBudgetAssignment(categoryIds[0], month, 50);

        // Spend $100 from checking (cash account) — $50 overspent
        fns.createTransaction({
            accountId,
            date: today(),
            categoryId: categoryIds[0],
            outflow: 100,
        });
        fns.updateBudgetActivity(categoryIds[0], month);

        const types = fns.getOverspendingTypes(month);
        expect(types[categoryIds[0]]).toBe('cash');
    });

    it('detects credit overspending (yellow) from CC transactions', () => {
        // Create CC account
        const ccResult = fns.createAccount({ name: 'Visa', type: 'credit' });
        const ccAccountId = Number(ccResult.lastInsertRowid);

        const groupResult = fns.createCategoryGroup('Spending');
        const groupId = Number(groupResult.lastInsertRowid);
        const catResult = fns.createCategory({ name: 'Groceries', category_group_id: groupId });
        const categoryId = Number(catResult.lastInsertRowid);

        const month = currentMonth();

        // Budget $50
        fns.updateBudgetAssignment(categoryId, month, 50);

        // Spend $100 on CC — $50 credit overspending
        fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId,
            outflow: 100,
        });
        fns.updateBudgetActivity(categoryId, month);

        const types = fns.getOverspendingTypes(month);
        expect(types[categoryId]).toBe('credit');
    });

    it('getCashOverspendingForMonth returns only cash portion', () => {
        // Create both cash and CC accounts
        const checkResult = fns.createAccount({ name: 'Checking', type: 'checking' });
        const checkingId = Number(checkResult.lastInsertRowid);

        const ccResult = fns.createAccount({ name: 'Visa', type: 'credit' });
        const ccAccountId = Number(ccResult.lastInsertRowid);

        const groupResult = fns.createCategoryGroup('Spending');
        const groupId = Number(groupResult.lastInsertRowid);
        const catResult = fns.createCategory({ name: 'Groceries', category_group_id: groupId });
        const categoryId = Number(catResult.lastInsertRowid);

        const month = currentMonth();

        // Budget $50
        fns.updateBudgetAssignment(categoryId, month, 50);

        // Spend $30 from checking (cash)
        fns.createTransaction({
            accountId: checkingId,
            date: today(),
            categoryId,
            outflow: 30,
        });

        // Spend $70 from CC (credit)
        fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId,
            outflow: 70,
        });

        fns.updateBudgetActivity(categoryId, month);

        // Total overspending = $50 (available = 50 - 30 - 70 = -50)
        const cashOverspending = fns.getCashOverspendingForMonth(month);
        // Cash spending = $30, total overspent = $50
        // Cash overspending = min(50, 30) = $30
        expect(cashOverspending).toBe(30);
    });

    it('returns empty record when no categories are overspent', () => {
        const { accountId, categoryIds } = seedBasicBudget(fns);
        const month = currentMonth();

        // Budget $200
        fns.updateBudgetAssignment(categoryIds[0], month, 200);

        // Spend only $50 (well under budget)
        fns.createTransaction({
            accountId,
            date: today(),
            categoryId: categoryIds[0],
            outflow: 50,
        });
        fns.updateBudgetActivity(categoryIds[0], month);

        const types = fns.getOverspendingTypes(month);
        expect(Object.keys(types)).toHaveLength(0);
    });

    it('cash overspending takes priority in mixed scenarios', () => {
        // Both cash and CC spending cause overspending
        const checkResult = fns.createAccount({ name: 'Checking', type: 'checking' });
        const checkingId = Number(checkResult.lastInsertRowid);

        const ccResult = fns.createAccount({ name: 'Visa', type: 'credit' });
        const ccAccountId = Number(ccResult.lastInsertRowid);

        const groupResult = fns.createCategoryGroup('Spending');
        const groupId = Number(groupResult.lastInsertRowid);
        const catResult = fns.createCategory({ name: 'Groceries', category_group_id: groupId });
        const categoryId = Number(catResult.lastInsertRowid);

        const month = currentMonth();

        // Budget $50
        fns.updateBudgetAssignment(categoryId, month, 50);

        // Spend $40 from checking
        fns.createTransaction({
            accountId: checkingId,
            date: today(),
            categoryId,
            outflow: 40,
        });

        // Spend $40 from CC
        fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId,
            outflow: 40,
        });

        fns.updateBudgetActivity(categoryId, month);

        // Total overspent = 30 (50 - 80)
        // Cash spending = 40, cash overspending = min(30, 40) = 30
        // Credit overspending = 30 - 30 = 0
        // Mixed → cash takes priority
        const types = fns.getOverspendingTypes(month);
        expect(types[categoryId]).toBe('cash');
    });

    it('CC Payment category overspending always shows as credit', () => {
        const ccResult = fns.createAccount({ name: 'Visa', type: 'credit' });
        const ccAccountId = Number(ccResult.lastInsertRowid);

        const ccCategory = fns.ensureCreditCardPaymentCategory(ccAccountId, 'Visa');
        const month = currentMonth();

        // Create negative CC Payment available (underfunded debt)
        db.prepare(`
      INSERT INTO budget_months (category_id, month, assigned, activity, available)
      VALUES (?, ?, 0, -500, -500)
    `).run(ccCategory.id, month);

        const types = fns.getOverspendingTypes(month);
        expect(types[ccCategory.id]).toBe('credit');
    });
});
