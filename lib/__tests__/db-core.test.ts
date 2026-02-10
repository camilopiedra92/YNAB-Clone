/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, today } from './test-helpers';
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
// Account CRUD
// =====================================================================
describe('Accounts', () => {
    it('creates and retrieves an account', async () => {
        const result = await fns.createAccount({ name: 'Checking', type: 'checking', budgetId, balance: 1000 });
        const id = result.id;

        const account = (await fns.getAccount(budgetId, id))!;
        expect(account.name).toBe('Checking');
        expect(account.type).toBe('checking');
        expect(account.balance).toBe(1000);
        expect(account.clearedBalance).toBe(1000);
    });

    it('lists all accounts', async () => {
        await fns.createAccount({ name: 'Savings', type: 'savings', budgetId });
        await fns.createAccount({ name: 'Checking', type: 'checking', budgetId });

        const accounts = await fns.getAccounts(budgetId);
        expect(accounts).toHaveLength(2);
        // Ordered by name
        expect(accounts[0].name).toBe('Checking');
        expect(accounts[1].name).toBe('Savings');
    });

    it('updates account name and note', async () => {
        const result = await fns.createAccount({ name: 'Old Name', type: 'checking', budgetId });
        const id = result.id;

        await fns.updateAccount(budgetId, id, { name: 'New Name', note: 'Test note' });
        const account = (await fns.getAccount(budgetId, id))!;
        expect(account.name).toBe('New Name');
        expect(account.note).toBe('Test note');
    });

    it('closes an account', async () => {
        const result = await fns.createAccount({ name: 'Test', type: 'checking', budgetId });
        const id = result.id;

        await fns.updateAccount(budgetId, id, { closed: true });
        const account = (await fns.getAccount(budgetId, id))!;
        expect(account.closed).toBe(true);
    });
});

// =====================================================================
// Category Groups & Categories
// =====================================================================
describe('Categories', () => {
    it('creates a category group', async () => {
        const result = await fns.createCategoryGroup('Essentials', budgetId);
        const id = result.id;

        const groups = await fns.getCategoryGroups(budgetId);
        expect(groups).toHaveLength(1);
        expect(groups[0].name).toBe('Essentials');
        expect(groups[0].id).toBe(id);
    });

    it('creates categories within a group', async () => {
        const groupResult = await fns.createCategoryGroup('Essentials', budgetId);
        const groupId = groupResult.id;

        await fns.createCategory({ name: 'Groceries', category_group_id: groupId });
        await fns.createCategory({ name: 'Rent', category_group_id: groupId });

        const categories = await fns.getCategories(budgetId, groupId);
        expect(categories).toHaveLength(2);
    });

    it('creates a category linked to a CC account', async () => {
        const accResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const accountId = accResult.id;

        const groupResult = await fns.createCategoryGroup('CC Payments', budgetId);
        const groupId = groupResult.id;

        await fns.createCategory({ name: 'Visa', category_group_id: groupId, linked_account_id: accountId });

        const categories = await fns.getCategories(budgetId, groupId);
        expect(categories[0].linkedAccountId).toBe(accountId);
    });

    it('updates category name', async () => {
        const groupResult = await fns.createCategoryGroup('Essentials', budgetId);
        const groupId = groupResult.id;
        const catResult = await fns.createCategory({ name: 'Old', category_group_id: groupId });
        const catId = catResult.id;

        await fns.updateCategoryName(catId, 'New');
        const categories = await fns.getCategories(budgetId, groupId);
        expect(categories[0].name).toBe('New');
    });
});

// =====================================================================
// Transactions
// =====================================================================
describe('Transactions', () => {
    let accountId: number;

    beforeEach(async () => {
        const result = await fns.createAccount({ name: 'Checking', type: 'checking', budgetId });
        accountId = result.id;
    });

    it('creates and retrieves a transaction', async () => {
        const result = await fns.createTransaction({
            accountId,
            date: today(),
            payee: 'Store',
            outflow: 50,
            inflow: 0,
        });
        const id = result.id;

        const tx = (await fns.getTransaction(budgetId, id))!;
        expect(tx.payee).toBe('Store');
        expect(tx.outflow).toBe(50);
        expect(tx.inflow).toBe(0);
        expect(tx.accountName).toBe('Checking');
    });

    it('updates transaction fields', async () => {
        const result = await fns.createTransaction({
            accountId,
            date: today(),
            payee: 'Store',
            outflow: 50,
        });
        const id = result.id;

        await fns.updateTransaction(budgetId, id, { payee: 'Updated Store', outflow: 75 });

        const tx = (await fns.getTransaction(budgetId, id))!;
        expect(tx.payee).toBe('Updated Store');
        expect(tx.outflow).toBe(75);
    });

    it('deletes a transaction', async () => {
        const result = await fns.createTransaction({
            accountId,
            date: today(),
            payee: 'Store',
            outflow: 50,
        });
        const id = result.id;

        await fns.deleteTransaction(budgetId, id);
        const tx = await fns.getTransaction(budgetId, id);
        expect(tx).toBeUndefined();
    });

    it('filters transactions by account', async () => {
        const acc2Result = await fns.createAccount({ name: 'Savings', type: 'savings', budgetId });
        const acc2Id = acc2Result.id;

        await fns.createTransaction({ accountId, date: today(), payee: 'A', outflow: 10 });
        await fns.createTransaction({ accountId: acc2Id, date: today(), payee: 'B', outflow: 20 });

        const txs = await fns.getTransactions({ budgetId,  accountId });
        expect(txs).toHaveLength(1);
        expect(txs[0].payee).toBe('A');
    });

    it('toggles transaction cleared status', async () => {
        const result = await fns.createTransaction({
            accountId,
            date: today(),
            payee: 'Store',
            outflow: 50,
            cleared: 'Uncleared',
        });
        const id = result.id;

        await fns.toggleTransactionCleared(budgetId, id);
        let tx = (await fns.getTransaction(budgetId, id))!;
        expect(tx.cleared).toBe('Cleared');

        await fns.toggleTransactionCleared(budgetId, id);
        tx = await fns.getTransaction(budgetId, id);
        expect(tx.cleared).toBe('Uncleared');
    });

    it('does not toggle reconciled transactions', async () => {
        const result = await fns.createTransaction({
            accountId,
            date: today(),
            payee: 'Store',
            outflow: 50,
            cleared: 'Reconciled',
        });
        const id = result.id;

        const toggleResult = await fns.toggleTransactionCleared(budgetId, id);
        expect(toggleResult).toBeNull();

        const tx = (await fns.getTransaction(budgetId, id))!;
        expect(tx.cleared).toBe('Reconciled');
    });
});

// =====================================================================
// Transfers
// =====================================================================
describe('Transfers', () => {
    it('creates a transfer with two linked transactions', async () => {
        const acc1Result = await fns.createAccount({ name: 'Checking', type: 'checking', budgetId, balance: 1000 });
        const acc1Id = acc1Result.id;

        const acc2Result = await fns.createAccount({ name: 'Savings', type: 'savings', budgetId });
        const acc2Id = acc2Result.id;

        const transfer = await fns.createTransfer(budgetId, {
            fromAccountId: acc1Id,
            toAccountId: acc2Id,
            amount: 500,
            date: today(),
        });

        expect(transfer.fromTransactionId).toBeDefined();
        expect(transfer.toTransactionId).toBeDefined();

        // Check outflow side
        const fromTx = (await fns.getTransaction(budgetId, Number(transfer.fromTransactionId)))!;
        expect(fromTx.outflow).toBe(500);
        expect(fromTx.inflow).toBe(0);
        expect(fromTx.accountId).toBe(acc1Id);

        // Check inflow side
        const toTx = (await fns.getTransaction(budgetId, Number(transfer.toTransactionId)))!;
        expect(toTx.inflow).toBe(500);
        expect(toTx.outflow).toBe(0);
        expect(toTx.accountId).toBe(acc2Id);
    });

    it('deletes a transfer and both transactions', async () => {
        const acc1Result = await fns.createAccount({ name: 'Checking', type: 'checking', budgetId, balance: 1000 });
        const acc1Id = acc1Result.id;

        const acc2Result = await fns.createAccount({ name: 'Savings', type: 'savings', budgetId });
        const acc2Id = acc2Result.id;

        const transfer = await fns.createTransfer(budgetId, {
            fromAccountId: acc1Id,
            toAccountId: acc2Id,
            amount: 500,
            date: today(),
        });

        await fns.deleteTransfer(budgetId, Number(transfer.transferId));

        expect(await fns.getTransaction(budgetId, Number(transfer.fromTransactionId))).toBeUndefined();
        expect(await fns.getTransaction(budgetId, Number(transfer.toTransactionId))).toBeUndefined();
    });

    it('throws when transferring with invalid account', async () => {
        const acc1Result = await fns.createAccount({ name: 'Checking', type: 'checking', budgetId });
        const acc1Id = acc1Result.id;

        await expect(
            fns.createTransfer(budgetId, {
                fromAccountId: acc1Id,
                toAccountId: 9999,
                amount: 100,
                date: today(),
            })
        ).rejects.toThrow();
    });
});

// =====================================================================
// Account Balances
// =====================================================================
describe('Account Balances', () => {
    it('recalculates balance from transactions', async () => {
        const result = await fns.createAccount({ name: 'Checking', type: 'checking', budgetId });
        const accountId = result.id;

        await fns.createTransaction({ accountId, date: today(), inflow: 1000, cleared: 'Cleared' });
        await fns.createTransaction({ accountId, date: today(), outflow: 300, cleared: 'Cleared' });
        await fns.createTransaction({ accountId, date: today(), outflow: 200, cleared: 'Uncleared' });

        await fns.updateAccountBalances(budgetId, accountId);

        const account = (await fns.getAccount(budgetId, accountId))!;
        expect(account.balance).toBe(500);        // 1000 - 300 - 200
        expect(account.clearedBalance).toBe(700); // 1000 - 300
        expect(account.unclearedBalance).toBe(-200);
    });

    it('reconciliation marks cleared as reconciled', async () => {
        const result = await fns.createAccount({ name: 'Checking', type: 'checking', budgetId });
        const accountId = result.id;

        await fns.createTransaction({ accountId, date: today(), inflow: 1000, cleared: 'Cleared' });
        await fns.createTransaction({ accountId, date: today(), outflow: 200, cleared: 'Uncleared' });

        await fns.reconcileAccount(budgetId, accountId);

        const info = await fns.getReconciliationInfo(budgetId, accountId);
        expect(info!.pendingClearedCount).toBe(0);
        expect(info!.reconciledBalance).toBe(1000);
    });
});

// =====================================================================
// Payees
// =====================================================================
describe('Payees', () => {
    it('returns distinct payees', async () => {
        const result = await fns.createAccount({ name: 'Checking', type: 'checking', budgetId });
        const accountId = result.id;

        await fns.createTransaction({ accountId, date: today(), payee: 'Store A', outflow: 10 });
        await fns.createTransaction({ accountId, date: today(), payee: 'Store B', outflow: 20 });
        await fns.createTransaction({ accountId, date: today(), payee: 'Store A', outflow: 30 });

        const payees = await fns.getPayees(budgetId);
        expect(payees).toHaveLength(2);
        expect(payees).toContain('Store A');
        expect(payees).toContain('Store B');
    });
});
