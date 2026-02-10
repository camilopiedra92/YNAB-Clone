import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, currentMonth, today, mu, ZERO } from './test-helpers';
import type { createDbFunctions } from '../repos';
import type { DrizzleDB } from '../repos/client';
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

describe('Overspending Detection', () => {
    it('detects cash overspending (red) from cash account transactions', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Budget $50 for category 1
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(50));

        // Spend $100 from checking (cash account) — $50 overspent
        await fns.createTransaction({
            accountId,
            date: today(),
            categoryId: categoryIds[0],
            outflow: mu(100),
        });
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        const types = await fns.getOverspendingTypes(budgetId, month);
        expect(types[categoryIds[0]]).toBe('cash');
    });

    it('detects credit overspending (yellow) from CC transactions', async () => {
        // Create CC account
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccAccountId = ccResult.id;

        const groupResult = await fns.createCategoryGroup('Spending', budgetId);
        const groupId = groupResult.id;
        const catResult = await fns.createCategory({ name: 'Groceries', category_group_id: groupId });
        const categoryId = catResult.id;

        const month = currentMonth();

        // Budget $50
        await fns.updateBudgetAssignment(budgetId, categoryId, month, mu(50));

        // Spend $100 on CC — $50 credit overspending
        await fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId,
            outflow: mu(100),
        });
        await fns.updateBudgetActivity(budgetId, categoryId, month);

        const types = await fns.getOverspendingTypes(budgetId, month);
        expect(types[categoryId]).toBe('credit');
    });

    it('getCashOverspendingForMonth returns only cash portion', async () => {
        // Create both cash and CC accounts
        const checkResult = await fns.createAccount({ name: 'Checking', type: 'checking', budgetId });
        const checkingId = checkResult.id;

        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccAccountId = ccResult.id;

        const groupResult = await fns.createCategoryGroup('Spending', budgetId);
        const groupId = groupResult.id;
        const catResult = await fns.createCategory({ name: 'Groceries', category_group_id: groupId });
        const categoryId = catResult.id;

        const month = currentMonth();

        // Budget $50
        await fns.updateBudgetAssignment(budgetId, categoryId, month, mu(50));

        // Spend $30 from checking (cash)
        await fns.createTransaction({
            accountId: checkingId,
            date: today(),
            categoryId,
            outflow: mu(30),
        });

        // Spend $70 from CC (credit)
        await fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId,
            outflow: mu(70),
        });

        await fns.updateBudgetActivity(budgetId, categoryId, month);

        // Total overspending = $50 (available = 50 - 30 - 70 = -50)
        const cashOverspending = await fns.getCashOverspendingForMonth(budgetId, month);
        // Cash spending = $30, total overspent = $50
        // Cash overspending = min(50, 30) = $30
        expect(cashOverspending).toBe(30);
    });

    it('returns empty record when no categories are overspent', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Budget $200
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(200));

        // Spend only $50 (well under budget)
        await fns.createTransaction({
            accountId,
            date: today(),
            categoryId: categoryIds[0],
            outflow: mu(50),
        });
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        const types = await fns.getOverspendingTypes(budgetId, month);
        expect(Object.keys(types)).toHaveLength(0);
    });

    it('cash overspending takes priority in mixed scenarios', async () => {
        // Both cash and CC spending cause overspending
        const checkResult = await fns.createAccount({ name: 'Checking', type: 'checking', budgetId });
        const checkingId = checkResult.id;

        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccAccountId = ccResult.id;

        const groupResult = await fns.createCategoryGroup('Spending', budgetId);
        const groupId = groupResult.id;
        const catResult = await fns.createCategory({ name: 'Groceries', category_group_id: groupId });
        const categoryId = catResult.id;

        const month = currentMonth();

        // Budget $50
        await fns.updateBudgetAssignment(budgetId, categoryId, month, mu(50));

        // Spend $40 from checking
        await fns.createTransaction({
            accountId: checkingId,
            date: today(),
            categoryId,
            outflow: mu(40),
        });

        // Spend $40 from CC
        await fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId,
            outflow: mu(40),
        });

        await fns.updateBudgetActivity(budgetId, categoryId, month);

        // Total overspent = 30 (50 - 80)
        // Cash spending = 40, cash overspending = min(30, 40) = 30
        // Credit overspending = 30 - 30 = 0
        // Mixed → cash takes priority
        const types = await fns.getOverspendingTypes(budgetId, month);
        expect(types[categoryId]).toBe('cash');
    });

    it('CC Payment category overspending always shows as credit', async () => {
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccAccountId = ccResult.id;

        const ccCategory = (await fns.ensureCreditCardPaymentCategory(ccAccountId, 'Visa'))!;
        const month = currentMonth();

        // Create negative CC Payment available (underfunded debt)
        await db.insert(budgetMonths).values({
            categoryId: ccCategory.id,
            month,
            assigned: ZERO,
            activity: mu(-500),
            available: mu(-500),
        });

        const types = await fns.getOverspendingTypes(budgetId, month);
        expect(types[ccCategory.id]).toBe('credit');
    });
});
