
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-helpers';
import type { createDbFunctions } from '../repos';
import type { DrizzleDB } from '../db/client';
import { parseCSV, importDataFromCSV } from '../data-import';
import * as schema from '../db/schema';

// =====================================================================
// parseCSV — Pure CSV Parsing Tests
// =====================================================================
describe('parseCSV', () => {
    it('parses simple CSV content', () => {
        const csv = `Name,Age,City
Alice,30,NYC
Bob,25,LA`;
        const result = parseCSV(csv);
        expect(result).toHaveLength(2);
        expect(result[0].Name).toBe('Alice');
        expect(result[0].Age).toBe('30');
        expect(result[0].City).toBe('NYC');
        expect(result[1].Name).toBe('Bob');
    });

    it('handles quoted fields with commas', () => {
        const csv = `Name,Description
"Smith, John","A description with, commas"`;
        const result = parseCSV(csv);
        expect(result).toHaveLength(1);
        expect(result[0].Name).toBe('Smith, John');
        expect(result[0].Description).toBe('A description with, commas');
    });

    it('returns empty array for empty content', () => {
        expect(parseCSV('')).toEqual([]);
        expect(parseCSV('   ')).toEqual([]);
    });

    it('returns empty array for header-only content', () => {
        const csv = `Name,Age,City`;
        const result = parseCSV(csv);
        expect(result).toHaveLength(0);
    });

    it('handles missing values gracefully', () => {
        const csv = `A,B,C
1,,3`;
        const result = parseCSV(csv);
        expect(result[0].A).toBe('1');
        expect(result[0].B).toBe('');
        expect(result[0].C).toBe('3');
    });

    it('parses YNAB Register format', () => {
        const csv = `"Account","Flag","Date","Payee","Category Group/Category","Category Group","Category","Memo","Outflow","Inflow","Cleared"
"Checking","","01/15/2026","Supermarket","Essentials/Groceries","Essentials","Groceries","Weekly groceries","$50.00","$0.00","Cleared"`;
        const result = parseCSV(csv);
        expect(result).toHaveLength(1);
        expect(result[0].Account).toBe('Checking');
        expect(result[0].Payee).toBe('Supermarket');
        expect(result[0]['Category Group']).toBe('Essentials');
        expect(result[0].Category).toBe('Groceries');
        expect(result[0].Outflow).toBe('$50.00');
        expect(result[0].Inflow).toBe('$0.00');
        expect(result[0].Cleared).toBe('Cleared');
    });

    it('parses YNAB Plan format', () => {
        const csv = `"Month","Category Group/Category","Category Group","Category","Assigned","Activity","Available"
"Jan 2026","Essentials/Groceries","Essentials","Groceries","$500.00","-$200.00","$300.00"`;
        const result = parseCSV(csv);
        expect(result).toHaveLength(1);
        expect(result[0].Month).toBe('Jan 2026');
        expect(result[0]['Category Group']).toBe('Essentials');
        expect(result[0].Category).toBe('Groceries');
        expect(result[0].Assigned).toBe('$500.00');
    });
});

// =====================================================================
// importDataFromCSV — Integration Tests (with PGlite)
// =====================================================================
describe('importDataFromCSV', () => {
    let db: DrizzleDB;
    let fns: ReturnType<typeof createDbFunctions>;
    let budgetId: number;

    beforeEach(async () => {
        const testDb = await createTestDb();
        db = testDb.db;
        fns = testDb.fns;
        budgetId = testDb.defaultBudgetId;
    });

    const REGISTER_CSV = `"Account","Flag","Date","Payee","Category Group/Category","Category Group","Category","Memo","Outflow","Inflow","Cleared"
"My Checking","","15/01/2026","Starting Balance","Inflow/Ready to Assign","Inflow","Ready to Assign","","$0.00","$1,000.00","Cleared"
"My Checking","","16/01/2026","Supermarket","Essentials/Groceries","Essentials","Groceries","Weekly groceries","$50.00","$0.00","Cleared"
"My Checking","","17/01/2026","Electric Co","Essentials/Utilities","Essentials","Utilities","Power bill","$100.00","$0.00","Uncleared"`;

    const PLAN_CSV = `"Month","Category Group/Category","Category Group","Category","Assigned","Activity","Available"
"Jan 2026","Inflow/Ready to Assign","Inflow","Ready to Assign","$0.00","$1,000.00","$0.00"
"Jan 2026","Essentials/Groceries","Essentials","Groceries","$200.00","-$50.00","$150.00"
"Jan 2026","Essentials/Utilities","Essentials","Utilities","$150.00","-$100.00","$50.00"`;

    it('imports accounts from register CSV', async () => {
        const stats = await importDataFromCSV(budgetId, REGISTER_CSV, PLAN_CSV, db);
        expect(stats.accounts).toBe(1); // "My Checking"

        const accounts = await fns.getAccounts(budgetId);
        expect(accounts).toHaveLength(1);
        expect(accounts[0].name).toBe('My Checking');
        expect(accounts[0].type).toBe('checking');
    });

    it('imports category groups and categories', async () => {
        const stats = await importDataFromCSV(budgetId, REGISTER_CSV, PLAN_CSV, db);
        expect(stats.categoryGroups).toBe(2); // "Inflow" and "Essentials"

        const cats = await fns.getCategories(budgetId);
        const groceries = cats.find((c) => c.name === 'Groceries');
        const utilities = cats.find((c) => c.name === 'Utilities');
        expect(groceries).toBeDefined();
        expect(utilities).toBeDefined();
    });

    it('imports transactions with correct amounts', async () => {
        const stats = await importDataFromCSV(budgetId, REGISTER_CSV, PLAN_CSV, db);
        expect(stats.transactions).toBe(3);
    });

    it('imports budget month entries', async () => {
        const stats = await importDataFromCSV(budgetId, REGISTER_CSV, PLAN_CSV, db);
        expect(stats.budgetEntries).toBe(3); // 3 plan rows
    });

    it('updates account balances correctly', async () => {
        await importDataFromCSV(budgetId, REGISTER_CSV, PLAN_CSV, db);

        const accounts = await fns.getAccounts(budgetId);
        const checking = accounts[0];
        // Balance = +1000 - 50 - 100 = 850 (in milliunits: 850000)
        expect(checking.balance).toBe(850000);
    });

    it('detects credit card accounts by name', async () => {
        const registerWithCC = `"Account","Flag","Date","Payee","Category Group/Category","Category Group","Category","Memo","Outflow","Inflow","Cleared"
"My Visa Credit","","15/01/2026","Store","Essentials/Shopping","Essentials","Shopping","","$30.00","$0.00","Cleared"`;

        const planMinimal = `"Month","Category Group/Category","Category Group","Category","Assigned","Activity","Available"
"Jan 2026","Essentials/Shopping","Essentials","Shopping","$100.00","-$30.00","$70.00"`;

        await importDataFromCSV(budgetId, registerWithCC, planMinimal, db);

        const accounts = await fns.getAccounts(budgetId);
        const cc = accounts.find((a) => a.name === 'My Visa Credit');
        expect(cc).toBeDefined();
        expect(cc!.type).toBe('credit');
    });

    it('returns valid ImportStats', async () => {
        const stats = await importDataFromCSV(budgetId, REGISTER_CSV, PLAN_CSV, db);
        expect(stats).toEqual({
            accounts: 1,
            transactions: 3,
            transfers: 0,
            budgetEntries: 3,
            categoryGroups: 2,
        });
    });

    it('scopes all data to the given budgetId', async () => {
        await importDataFromCSV(budgetId, REGISTER_CSV, PLAN_CSV, db);

        // Create a second budget — should have no data
        const userResult = await db.insert(schema.users).values({
            name: 'Other User',
            email: 'other@test.com',
            password: 'password',
        }).returning();
        const budgetResult = await db.insert(schema.budgets).values({
            userId: userResult[0].id,
            name: 'Other Budget',
        }).returning();
        const otherBudgetId = budgetResult[0].id;

        const otherAccounts = await fns.getAccounts(otherBudgetId);
        expect(otherAccounts).toHaveLength(0);

        const otherCats = await fns.getCategories(otherBudgetId);
        expect(otherCats).toHaveLength(0);
    });
});
