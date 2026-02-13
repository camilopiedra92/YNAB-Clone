import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, currentMonth, today, mu, ZERO } from './test-helpers';
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

describe('Overspending Detection', () => {
    it('detects cash overspending (red) from cash account transactions', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Budget $50 for category 1
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(50));

        // Spend $100 from checking (cash account) — $50 overspent
        await fns.createTransaction(budgetId, {
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
        await fns.createTransaction(budgetId, {
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
        await fns.createTransaction(budgetId, {
            accountId: checkingId,
            date: today(),
            categoryId,
            outflow: mu(30),
        });

        // Spend $70 from CC (credit)
        await fns.createTransaction(budgetId, {
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
        await fns.createTransaction(budgetId, {
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
        await fns.createTransaction(budgetId, {
            accountId: checkingId,
            date: today(),
            categoryId,
            outflow: mu(40),
        });

        // Spend $40 from CC
        await fns.createTransaction(budgetId, {
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
            budgetId,
            categoryId: ccCategory.id,
            month,
            assigned: ZERO,
            activity: mu(-500),
            available: mu(-500),
        });

        const types = await fns.getOverspendingTypes(budgetId, month);
        expect(types[ccCategory.id]).toBe('credit');
    });

    it('getCashOverspendingForMonth excludes future-dated cash transactions (MEMORY §4D)', async () => {
        // Reproduces the exact +340K RTA bug:
        // - CC outflow overspends a category
        // - Future-dated cash outflow on the same category
        // - Without the fix, the future cash txn inflates cashOverspending
        const checkResult = await fns.createAccount({ name: 'Checking', type: 'checking', budgetId });
        const checkingId = checkResult.id;

        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccAccountId = ccResult.id;

        const groupResult = await fns.createCategoryGroup('Spending', budgetId);
        const catResult = await fns.createCategory({ name: 'Salario', category_group_id: groupResult.id });
        const categoryId = catResult.id;

        const month = currentMonth();

        // Budget $100
        await fns.updateBudgetAssignment(budgetId, categoryId, month, mu(100));

        // CC outflow of $500 today — $400 credit overspending
        await fns.createTransaction(budgetId, {
            accountId: ccAccountId,
            date: today(),
            categoryId,
            outflow: mu(500),
        });

        // Future-dated cash outflow of $200 (next week)
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const futureDateStr = futureDate.toISOString().slice(0, 10);

        await fns.createTransaction(budgetId, {
            accountId: checkingId,
            date: futureDateStr,
            categoryId,
            outflow: mu(200),
        });

        await fns.updateBudgetActivity(budgetId, categoryId, month);

        // Cash overspending should be 0 — the only cash transaction is future-dated
        const cashOverspending = await fns.getCashOverspendingForMonth(budgetId, month);
        expect(cashOverspending).toBe(0);
    });

    it('getOverspendingTypes classifies as credit when cash spending is only future-dated', async () => {
        const checkResult = await fns.createAccount({ name: 'Checking', type: 'checking', budgetId });
        const checkingId = checkResult.id;

        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccAccountId = ccResult.id;

        const groupResult = await fns.createCategoryGroup('Spending', budgetId);
        const catResult = await fns.createCategory({ name: 'Groceries', category_group_id: groupResult.id });
        const categoryId = catResult.id;

        const month = currentMonth();

        // Budget $50
        await fns.updateBudgetAssignment(budgetId, categoryId, month, mu(50));

        // CC outflow of $200 today — $150 credit overspending
        await fns.createTransaction(budgetId, {
            accountId: ccAccountId,
            date: today(),
            categoryId,
            outflow: mu(200),
        });

        // Future-dated cash outflow — should NOT change classification
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 5);
        const futureDateStr = futureDate.toISOString().slice(0, 10);

        await fns.createTransaction(budgetId, {
            accountId: checkingId,
            date: futureDateStr,
            categoryId,
            outflow: mu(100),
        });

        await fns.updateBudgetActivity(budgetId, categoryId, month);

        // Should be 'credit' (not 'cash') — future cash txn excluded
        const types = await fns.getOverspendingTypes(budgetId, month);
        expect(types[categoryId]).toBe('credit');
    });
});

