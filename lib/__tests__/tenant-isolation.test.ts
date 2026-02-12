
/**
 * Tenant Isolation Unit Tests — Phase 4.3.1
 *
 * Verifies that repo-level queries scoped by `budgetId` return ONLY
 * data belonging to the specified budget. Two budgets (A and B) are
 * seeded with identical structures in the same PGlite database.
 *
 * This is the unit-level complement to the E2E tenant-isolation.spec.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, seedCompleteMonth, today, currentMonth, mu } from './test-helpers';
import type { createDbFunctions } from '../repos';
import type { DrizzleDB } from '../db/helpers';
import * as schema from '../db/schema';

let db: DrizzleDB;
let fns: ReturnType<typeof createDbFunctions>;

// Budget A: the default budget created by createTestDb
let budgetA: number;

// Budget B: a second budget with its own user
let budgetB: number;

beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;
    fns = testDb.fns;
    budgetA = testDb.defaultBudgetId;

    // Create second user + budget for isolation testing
    const [user2] = await db.insert(schema.users).values({
        name: 'User B',
        email: 'userb@test.com',
        password: 'password',
    }).returning();

    const [budget2] = await db.insert(schema.budgets).values({
        userId: user2.id,
        name: 'Budget B',
    }).returning();
    budgetB = budget2.id;
});

describe('Tenant Isolation — Account Queries', () => {
    it('getAccounts returns only accounts for the specified budget', async () => {
        // Seed accounts for both budgets
        await fns.createAccount({ name: 'A Checking', type: 'checking', budgetId: budgetA });
        await fns.createAccount({ name: 'A Savings', type: 'savings', budgetId: budgetA });
        await fns.createAccount({ name: 'B Checking', type: 'checking', budgetId: budgetB });

        const accountsA = await fns.getAccounts(budgetA);
        const accountsB = await fns.getAccounts(budgetB);

        expect(accountsA).toHaveLength(2);
        expect(accountsA.every((a) => a.budgetId === budgetA)).toBe(true);

        expect(accountsB).toHaveLength(1);
        expect(accountsB[0].name).toBe('B Checking');
        expect(accountsB[0].budgetId).toBe(budgetB);
    });

    it('getAccount with wrong budgetId returns undefined', async () => {
        const acct = await fns.createAccount({ name: 'A Only', type: 'checking', budgetId: budgetA });

        // Same account ID, wrong budget → should return undefined
        const result = await fns.getAccount(budgetB, acct.id);
        expect(result).toBeUndefined();

        // Correct budget → should find it
        const correct = await fns.getAccount(budgetA, acct.id);
        expect(correct).toBeDefined();
        expect(correct.name).toBe('A Only');
    });
});

describe('Tenant Isolation — Category Queries', () => {
    it('getCategories returns only categories for the specified budget', async () => {
        // Budget A categories
        const groupA = await fns.createCategoryGroup('Group A', budgetA);
        await fns.createCategory({ name: 'Cat A1', category_group_id: groupA.id });
        await fns.createCategory({ name: 'Cat A2', category_group_id: groupA.id });

        // Budget B categories
        const groupB = await fns.createCategoryGroup('Group B', budgetB);
        await fns.createCategory({ name: 'Cat B1', category_group_id: groupB.id });

        const catsA = await fns.getCategories(budgetA);
        const catsB = await fns.getCategories(budgetB);

        expect(catsA).toHaveLength(2);
        expect(catsA.every((c) => c.budgetId === budgetA)).toBe(true);

        expect(catsB).toHaveLength(1);
        expect(catsB[0].name).toBe('Cat B1');
    });

    it('getCategoryGroups returns only groups for the specified budget', async () => {
        await fns.createCategoryGroup('GA1', budgetA);
        await fns.createCategoryGroup('GA2', budgetA);
        await fns.createCategoryGroup('GB1', budgetB);

        const groupsA = await fns.getCategoryGroups(budgetA);
        const groupsB = await fns.getCategoryGroups(budgetB);

        expect(groupsA).toHaveLength(2);
        expect(groupsB).toHaveLength(1);
        expect(groupsB[0].name).toBe('GB1');
    });
});

describe('Tenant Isolation — Transaction Queries', () => {
    it('getTransactions returns only transactions for the specified budget', async () => {
        // Create accounts + transactions for both budgets
        const acctA = await fns.createAccount({ name: 'A Acct', type: 'checking', budgetId: budgetA });
        const acctB = await fns.createAccount({ name: 'B Acct', type: 'checking', budgetId: budgetB });

        await fns.createTransaction(budgetA, { accountId: acctA.id, date: today(), payee: 'Store A', outflow: 1000 });
        await fns.createTransaction(budgetA, { accountId: acctA.id, date: today(), payee: 'Store A2', outflow: 2000 });
        await fns.createTransaction(budgetB, { accountId: acctB.id, date: today(), payee: 'Store B', outflow: 500 });

        const txA = await fns.getTransactions({ budgetId: budgetA });
        const txB = await fns.getTransactions({ budgetId: budgetB });

        expect(txA).toHaveLength(2);
        expect(txA.every((t) => t.budgetId === budgetA)).toBe(true);

        expect(txB).toHaveLength(1);
        expect(txB[0].payee).toBe('Store B');
    });

    it('getTransaction with wrong budgetId returns undefined', async () => {
        const acctA = await fns.createAccount({ name: 'A', type: 'checking', budgetId: budgetA });
        const tx = await fns.createTransaction(budgetA, { accountId: acctA.id, date: today(), outflow: 100 });

        const wrongBudget = await fns.getTransaction(budgetB, tx.id);
        expect(wrongBudget).toBeUndefined();

        const correct = await fns.getTransaction(budgetA, tx.id);
        expect(correct).toBeDefined();
    });
});

describe('Tenant Isolation — Payee Queries', () => {
    it('getPayees returns only payees from the specified budget', async () => {
        const acctA = await fns.createAccount({ name: 'A', type: 'checking', budgetId: budgetA });
        const acctB = await fns.createAccount({ name: 'B', type: 'checking', budgetId: budgetB });

        await fns.createTransaction(budgetA, { accountId: acctA.id, date: today(), payee: 'PayeeA', outflow: 100 });
        await fns.createTransaction(budgetB, { accountId: acctB.id, date: today(), payee: 'PayeeB', outflow: 100 });

        const payeesA = await fns.getPayees(budgetA);
        const payeesB = await fns.getPayees(budgetB);

        expect(payeesA).toEqual(['PayeeA']);
        expect(payeesB).toEqual(['PayeeB']);
    });
});

describe('Tenant Isolation — Budget Queries', () => {
    it('getBudgetForMonth returns only categories for the specified budget', async () => {
        const month = currentMonth();

        // Seed budget A with categories + assignments
        const { groupId: gA, categoryIds: catsA } = await seedBasicBudget(fns, {
            budgetId: budgetA, db, categoryCount: 3,
        });
        await seedCompleteMonth(fns, db, month, gA, budgetA);
        await fns.updateBudgetAssignment(budgetA, catsA[0], month, mu(1000));

        // Seed budget B with categories + assignments
        const { groupId: _gB, categoryIds: catsB } = await seedBasicBudget(fns, {
            budgetId: budgetB, db, categoryCount: 2, accountName: 'B Checking',
        });
        await fns.updateBudgetAssignment(budgetB, catsB[0], month, mu(500));

        const budgetDataA = await fns.getBudgetForMonth(budgetA, month);
        const budgetDataB = await fns.getBudgetForMonth(budgetB, month);

        // Budget A should have its 3 categories + the 12 fill categories from seedCompleteMonth
        // Budget B should have its 2 categories only
        const catIdsA = new Set(budgetDataA.map((r) => r.categoryId));
        const catIdsB = new Set(budgetDataB.map((r) => r.categoryId));

        // No overlap between the two budgets' category IDs
        const overlap = [...catIdsA].filter(id => catIdsB.has(id));
        expect(overlap).toHaveLength(0);

        // Verify assignments stayed in their own budget
        const assignedRowA = budgetDataA.find((r) => r.categoryId === catsA[0]);
        expect(assignedRowA?.assigned).toBe(1000);

        const assignedRowB = budgetDataB.find((r) => r.categoryId === catsB[0]);
        expect(assignedRowB?.assigned).toBe(500);
    });

    it('getReadyToAssign is not affected by the other budget', async () => {
        const month = currentMonth();

        // Budget A: $5000 income, $1000 assigned
        const { accountId: acctA, groupId: gA, categoryIds: catsA } = await seedBasicBudget(fns, {
            budgetId: budgetA, db, categoryCount: 2,
        });
        await fns.createTransaction(budgetA, { accountId: acctA, date: today(), inflow: 5000 });
        await fns.updateAccountBalances(budgetA, acctA);
        await seedCompleteMonth(fns, db, month, gA, budgetA);
        await fns.updateBudgetAssignment(budgetA, catsA[0], month, mu(1000));

        // Budget B: $10000 income, $3000 assigned
        const { accountId: acctB, groupId: gB, categoryIds: catsB } = await seedBasicBudget(fns, {
            budgetId: budgetB, db, categoryCount: 2, accountName: 'B Checking',
        });
        await fns.createTransaction(budgetB, { accountId: acctB, date: today(), inflow: 10000 });
        await fns.updateAccountBalances(budgetB, acctB);
        await seedCompleteMonth(fns, db, month, gB, budgetB);
        await fns.updateBudgetAssignment(budgetB, catsB[0], month, mu(3000));

        const rtaA = await fns.getReadyToAssign(budgetA, month);
        const rtaB = await fns.getReadyToAssign(budgetB, month);

        // Each budget's RTA is independent
        expect(rtaA).toBe(4000); // 5000 - 1000
        expect(rtaB).toBe(7000); // 10000 - 3000
    });

    it('account balance updates are scoped to the correct budget', async () => {
        const acctA = await fns.createAccount({ name: 'A', type: 'checking', budgetId: budgetA });
        const acctB = await fns.createAccount({ name: 'B', type: 'checking', budgetId: budgetB });

        await fns.createTransaction(budgetA, { accountId: acctA.id, date: today(), inflow: 5000 });
        await fns.createTransaction(budgetB, { accountId: acctB.id, date: today(), inflow: 10000 });

        await fns.updateAccountBalances(budgetA, acctA.id);
        await fns.updateAccountBalances(budgetB, acctB.id);

        const a = await fns.getAccount(budgetA, acctA.id);
        const b = await fns.getAccount(budgetB, acctB.id);

        expect(a.balance).toBe(5000);
        expect(b.balance).toBe(10000);
    });
});
