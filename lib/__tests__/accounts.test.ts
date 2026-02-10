/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, today } from './test-helpers';
import type { createDbFunctions } from '../repos';
import type { DrizzleDB } from '../db/client';

let db: DrizzleDB;
let fns: ReturnType<typeof createDbFunctions>;
let budgetId: number;

beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;
    fns = testDb.fns;
    budgetId = testDb.defaultBudgetId;
});

// =====================================================================
// Account Type Helpers
// =====================================================================
describe('Account Type', () => {
    it('getAccountType returns correct type', async () => {
        const r1 = await fns.createAccount({ name: 'Checking', type: 'checking', budgetId });
        const r2 = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });

        expect(await fns.getAccountType(r1.id)).toBe('checking');
        expect(await fns.getAccountType(r2.id)).toBe('credit');
    });

    it('getAccountType returns null for non-existent account', async () => {
        const result = await fns.getAccountType(99999);
        expect(result).toBeNull();
    });

    it('isCreditCardAccount returns true for credit accounts', async () => {
        const result = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const id = result.id;
        expect(await fns.isCreditCardAccount(id)).toBe(true);
    });

    it('isCreditCardAccount returns false for checking accounts', async () => {
        const result = await fns.createAccount({ name: 'Checking', type: 'checking', budgetId });
        const id = result.id;
        expect(await fns.isCreditCardAccount(id)).toBe(false);
    });

    it('isCreditCardAccount returns false for non-existent account', async () => {
        expect(await fns.isCreditCardAccount(99999)).toBe(false);
    });
});

// =====================================================================
// Update Account — Edge Cases
// =====================================================================
describe('Update Account - Edge Cases', () => {
    it('does nothing with empty updates object', async () => {
        const result = await fns.createAccount({ name: 'Test', type: 'checking', budgetId });
        const id = result.id;

        const updateResult = await fns.updateAccount(budgetId, id, {});
        expect(updateResult).toBeUndefined();

        const account = await fns.getAccount(budgetId, id);
        expect(account?.name).toBe('Test');
    });

    it('updates only name when other fields are undefined', async () => {
        const result = await fns.createAccount({ name: 'Old', type: 'checking', budgetId });
        const id = result.id;

        await fns.updateAccount(budgetId, id, { name: 'New' });
        const account = await fns.getAccount(budgetId, id);
        expect(account?.name).toBe('New');
        expect(account?.note).toBe(''); // default
    });

    it('updates only note', async () => {
        const result = await fns.createAccount({ name: 'Test', type: 'checking', budgetId });
        const id = result.id;

        await fns.updateAccount(budgetId, id, { note: 'Some note' });
        const account = await fns.getAccount(budgetId, id);
        expect(account?.name).toBe('Test');
        expect(account?.note).toBe('Some note');
    });

    it('opens a closed account', async () => {
        const result = await fns.createAccount({ name: 'Test', type: 'checking', budgetId });
        const id = result.id;

        await fns.updateAccount(budgetId, id, { closed: true });
        let account = await fns.getAccount(budgetId, id);
        expect(account?.closed).toBe(true);

        await fns.updateAccount(budgetId, id, { closed: false });
        account = await fns.getAccount(budgetId, id);
        expect(account?.closed).toBe(false);
    });

    it('updates all fields at once', async () => {
        const result = await fns.createAccount({ name: 'Old', type: 'checking', budgetId });
        const id = result.id;

        await fns.updateAccount(budgetId, id, { name: 'New Name', note: 'New Note', closed: true });
        const account = await fns.getAccount(budgetId, id);
        expect(account?.name).toBe('New Name');
        expect(account?.note).toBe('New Note');
        expect(account?.closed).toBe(true);
    });
});

// =====================================================================
// Create Account — Default Balance
// =====================================================================
describe('Create Account - Defaults', () => {
    it('creates with zero balance when not specified', async () => {
        const result = await fns.createAccount({ name: 'Test', type: 'checking', budgetId });
        const id = result.id;
        const account = await fns.getAccount(budgetId, id);
        expect(account?.balance).toBe(0);
        expect(account?.clearedBalance).toBe(0);
        expect(account?.unclearedBalance).toBe(0);
    });
});

// =====================================================================
// Reconciliation
// =====================================================================
describe('Reconciliation', () => {
    it('returns reconciliation info with no transactions', async () => {
        const result = await fns.createAccount({ name: 'Test', type: 'checking', budgetId });
        const id = result.id;

        const info = await fns.getReconciliationInfo(budgetId, id);
        expect(info!.clearedBalance).toBe(0);
        expect(info!.reconciledBalance).toBe(0);
        expect(info!.pendingClearedBalance).toBe(0);
        expect(info!.pendingClearedCount).toBe(0);
    });

    it('separates cleared and pending properly', async () => {
        const result = await fns.createAccount({ name: 'Test', type: 'checking', budgetId });
        const id = result.id;

        await fns.createTransaction({ accountId: id, date: today(), inflow: 1000, cleared: 'Reconciled' });
        await fns.createTransaction({ accountId: id, date: today(), inflow: 500, cleared: 'Cleared' });
        await fns.createTransaction({ accountId: id, date: today(), inflow: 200, cleared: 'Uncleared' });

        const info = await fns.getReconciliationInfo(budgetId, id);
        expect(info!.reconciledBalance).toBe(1000);
        expect(info!.pendingClearedBalance).toBe(500);
        expect(info!.pendingClearedCount).toBe(1);
        expect(info!.clearedBalance).toBe(1500); // reconciled + cleared
    });

    it('reconcileAccount only affects currently cleared transactions', async () => {
        const result = await fns.createAccount({ name: 'Test', type: 'checking', budgetId });
        const id = result.id;

        const tx1 = await fns.createTransaction({ accountId: id, date: today(), inflow: 1000, cleared: 'Cleared' });
        const tx2 = await fns.createTransaction({ accountId: id, date: today(), inflow: 500, cleared: 'Uncleared' });

        await fns.reconcileAccount(budgetId, id);

        const reconciled = await fns.getTransaction(budgetId, tx1.id);
        expect(reconciled?.cleared).toBe('Reconciled');

        const uncleared = await fns.getTransaction(budgetId, tx2.id);
        expect(uncleared?.cleared).toBe('Uncleared');
    });
});

// =====================================================================
// Payees — Edge Cases
// =====================================================================
describe('Payees', () => {
    it('excludes empty and null payees', async () => {
        const result = await fns.createAccount({ name: 'Test', type: 'checking', budgetId });
        const id = result.id;

        await fns.createTransaction({ accountId: id, date: today(), payee: 'Store', outflow: 10 });
        await fns.createTransaction({ accountId: id, date: today(), outflow: 20 }); // no payee
        await fns.createTransaction({ accountId: id, date: today(), payee: '', outflow: 30 }); // empty payee

        const payees = await fns.getPayees(budgetId);
        expect(payees).toHaveLength(1);
        expect(payees[0]).toBe('Store');
    });

    it('returns empty array when no transactions', async () => {
        const payees = await fns.getPayees(budgetId);
        expect(payees).toHaveLength(0);
    });
});
