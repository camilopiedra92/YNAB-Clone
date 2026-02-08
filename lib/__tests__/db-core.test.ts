import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, today } from './test-helpers';
import type { createDbFunctions } from '../db';
import Database from 'better-sqlite3';

let db: Database.Database;
let fns: ReturnType<typeof createDbFunctions>;

beforeEach(() => {
    const testDb = createTestDb();
    db = testDb.db;
    fns = testDb.fns;
});

// =====================================================================
// Account CRUD
// =====================================================================
describe('Accounts', () => {
    it('creates and retrieves an account', () => {
        const result = fns.createAccount({ name: 'Checking', type: 'checking', balance: 1000 });
        const id = Number(result.lastInsertRowid);

        const account: any = fns.getAccount(id);
        expect(account.name).toBe('Checking');
        expect(account.type).toBe('checking');
        expect(account.balance).toBe(1000);
        expect(account.cleared_balance).toBe(1000);
    });

    it('lists all accounts', () => {
        fns.createAccount({ name: 'Savings', type: 'savings' });
        fns.createAccount({ name: 'Checking', type: 'checking' });

        const accounts = fns.getAccounts() as any[];
        expect(accounts).toHaveLength(2);
        // Ordered by name
        expect(accounts[0].name).toBe('Checking');
        expect(accounts[1].name).toBe('Savings');
    });

    it('updates account name and note', () => {
        const result = fns.createAccount({ name: 'Old Name', type: 'checking' });
        const id = Number(result.lastInsertRowid);

        fns.updateAccount(id, { name: 'New Name', note: 'Test note' });
        const account: any = fns.getAccount(id);
        expect(account.name).toBe('New Name');
        expect(account.note).toBe('Test note');
    });

    it('closes an account', () => {
        const result = fns.createAccount({ name: 'Test', type: 'checking' });
        const id = Number(result.lastInsertRowid);

        fns.updateAccount(id, { closed: true });
        const account: any = fns.getAccount(id);
        expect(account.closed).toBe(1);
    });
});

// =====================================================================
// Category Groups & Categories
// =====================================================================
describe('Categories', () => {
    it('creates a category group', () => {
        const result = fns.createCategoryGroup('Essentials');
        const id = Number(result.lastInsertRowid);

        const groups = fns.getCategoryGroups() as any[];
        expect(groups).toHaveLength(1);
        expect(groups[0].name).toBe('Essentials');
        expect(groups[0].id).toBe(id);
    });

    it('creates categories within a group', () => {
        const groupResult = fns.createCategoryGroup('Essentials');
        const groupId = Number(groupResult.lastInsertRowid);

        fns.createCategory({ name: 'Groceries', category_group_id: groupId });
        fns.createCategory({ name: 'Rent', category_group_id: groupId });

        const categories = fns.getCategories(groupId) as any[];
        expect(categories).toHaveLength(2);
    });

    it('creates a category linked to a CC account', () => {
        const accResult = fns.createAccount({ name: 'Visa', type: 'credit' });
        const accountId = Number(accResult.lastInsertRowid);

        const groupResult = fns.createCategoryGroup('CC Payments');
        const groupId = Number(groupResult.lastInsertRowid);

        fns.createCategory({ name: 'Visa', category_group_id: groupId, linked_account_id: accountId });

        const categories = fns.getCategories(groupId) as any[];
        expect(categories[0].linked_account_id).toBe(accountId);
    });

    it('updates category name', () => {
        const groupResult = fns.createCategoryGroup('Essentials');
        const groupId = Number(groupResult.lastInsertRowid);
        const catResult = fns.createCategory({ name: 'Old', category_group_id: groupId });
        const catId = Number(catResult.lastInsertRowid);

        fns.updateCategoryName(catId, 'New');
        const categories = fns.getCategories(groupId) as any[];
        expect(categories[0].name).toBe('New');
    });
});

// =====================================================================
// Transactions
// =====================================================================
describe('Transactions', () => {
    let accountId: number;

    beforeEach(() => {
        const result = fns.createAccount({ name: 'Checking', type: 'checking' });
        accountId = Number(result.lastInsertRowid);
    });

    it('creates and retrieves a transaction', () => {
        const result = fns.createTransaction({
            accountId,
            date: today(),
            payee: 'Store',
            outflow: 50,
            inflow: 0,
        });
        const id = Number(result.lastInsertRowid);

        const tx: any = fns.getTransaction(id);
        expect(tx.payee).toBe('Store');
        expect(tx.outflow).toBe(50);
        expect(tx.inflow).toBe(0);
        expect(tx.account_name).toBe('Checking');
    });

    it('updates transaction fields', () => {
        const result = fns.createTransaction({
            accountId,
            date: today(),
            payee: 'Store',
            outflow: 50,
        });
        const id = Number(result.lastInsertRowid);

        fns.updateTransaction(id, { payee: 'Updated Store', outflow: 75 });

        const tx: any = fns.getTransaction(id);
        expect(tx.payee).toBe('Updated Store');
        expect(tx.outflow).toBe(75);
    });

    it('deletes a transaction', () => {
        const result = fns.createTransaction({
            accountId,
            date: today(),
            payee: 'Store',
            outflow: 50,
        });
        const id = Number(result.lastInsertRowid);

        fns.deleteTransaction(id);
        const tx = fns.getTransaction(id);
        expect(tx).toBeUndefined();
    });

    it('filters transactions by account', () => {
        const acc2Result = fns.createAccount({ name: 'Savings', type: 'savings' });
        const acc2Id = Number(acc2Result.lastInsertRowid);

        fns.createTransaction({ accountId, date: today(), payee: 'A', outflow: 10 });
        fns.createTransaction({ accountId: acc2Id, date: today(), payee: 'B', outflow: 20 });

        const txs = fns.getTransactions({ accountId }) as any[];
        expect(txs).toHaveLength(1);
        expect(txs[0].payee).toBe('A');
    });

    it('toggles transaction cleared status', () => {
        const result = fns.createTransaction({
            accountId,
            date: today(),
            payee: 'Store',
            outflow: 50,
            cleared: 'Uncleared',
        });
        const id = Number(result.lastInsertRowid);

        fns.toggleTransactionCleared(id);
        let tx: any = fns.getTransaction(id);
        expect(tx.cleared).toBe('Cleared');

        fns.toggleTransactionCleared(id);
        tx = fns.getTransaction(id);
        expect(tx.cleared).toBe('Uncleared');
    });

    it('does not toggle reconciled transactions', () => {
        const result = fns.createTransaction({
            accountId,
            date: today(),
            payee: 'Store',
            outflow: 50,
            cleared: 'Reconciled',
        });
        const id = Number(result.lastInsertRowid);

        const toggleResult = fns.toggleTransactionCleared(id);
        expect(toggleResult).toBeNull();

        const tx: any = fns.getTransaction(id);
        expect(tx.cleared).toBe('Reconciled');
    });
});

// =====================================================================
// Transfers
// =====================================================================
describe('Transfers', () => {
    it('creates a transfer with two linked transactions', () => {
        const acc1Result = fns.createAccount({ name: 'Checking', type: 'checking', balance: 1000 });
        const acc1Id = Number(acc1Result.lastInsertRowid);

        const acc2Result = fns.createAccount({ name: 'Savings', type: 'savings' });
        const acc2Id = Number(acc2Result.lastInsertRowid);

        const transfer = fns.createTransfer({
            fromAccountId: acc1Id,
            toAccountId: acc2Id,
            amount: 500,
            date: today(),
        });

        expect(transfer.fromTransactionId).toBeDefined();
        expect(transfer.toTransactionId).toBeDefined();

        // Check outflow side
        const fromTx: any = fns.getTransaction(Number(transfer.fromTransactionId));
        expect(fromTx.outflow).toBe(500);
        expect(fromTx.inflow).toBe(0);
        expect(fromTx.account_id).toBe(acc1Id);

        // Check inflow side
        const toTx: any = fns.getTransaction(Number(transfer.toTransactionId));
        expect(toTx.inflow).toBe(500);
        expect(toTx.outflow).toBe(0);
        expect(toTx.account_id).toBe(acc2Id);
    });

    it('deletes a transfer and both transactions', () => {
        const acc1Result = fns.createAccount({ name: 'Checking', type: 'checking', balance: 1000 });
        const acc1Id = Number(acc1Result.lastInsertRowid);

        const acc2Result = fns.createAccount({ name: 'Savings', type: 'savings' });
        const acc2Id = Number(acc2Result.lastInsertRowid);

        const transfer = fns.createTransfer({
            fromAccountId: acc1Id,
            toAccountId: acc2Id,
            amount: 500,
            date: today(),
        });

        fns.deleteTransfer(Number(transfer.transferId));

        expect(fns.getTransaction(Number(transfer.fromTransactionId))).toBeUndefined();
        expect(fns.getTransaction(Number(transfer.toTransactionId))).toBeUndefined();
    });

    it('throws when transferring with invalid account', () => {
        const acc1Result = fns.createAccount({ name: 'Checking', type: 'checking' });
        const acc1Id = Number(acc1Result.lastInsertRowid);

        expect(() => {
            fns.createTransfer({
                fromAccountId: acc1Id,
                toAccountId: 9999,
                amount: 100,
                date: today(),
            });
        }).toThrow('Account not found');
    });
});

// =====================================================================
// Account Balances
// =====================================================================
describe('Account Balances', () => {
    it('recalculates balance from transactions', () => {
        const result = fns.createAccount({ name: 'Checking', type: 'checking' });
        const accountId = Number(result.lastInsertRowid);

        fns.createTransaction({ accountId, date: today(), inflow: 1000, cleared: 'Cleared' });
        fns.createTransaction({ accountId, date: today(), outflow: 300, cleared: 'Cleared' });
        fns.createTransaction({ accountId, date: today(), outflow: 200, cleared: 'Uncleared' });

        fns.updateAccountBalances(accountId);

        const account: any = fns.getAccount(accountId);
        expect(account.balance).toBe(500);        // 1000 - 300 - 200
        expect(account.cleared_balance).toBe(700); // 1000 - 300
        expect(account.uncleared_balance).toBe(-200);
    });

    it('reconciliation marks cleared as reconciled', () => {
        const result = fns.createAccount({ name: 'Checking', type: 'checking' });
        const accountId = Number(result.lastInsertRowid);

        fns.createTransaction({ accountId, date: today(), inflow: 1000, cleared: 'Cleared' });
        fns.createTransaction({ accountId, date: today(), outflow: 200, cleared: 'Uncleared' });

        fns.reconcileAccount(accountId);

        const info = fns.getReconciliationInfo(accountId);
        expect(info.pending_cleared_count).toBe(0);
        expect(info.reconciled_balance).toBe(1000);
    });
});

// =====================================================================
// Payees
// =====================================================================
describe('Payees', () => {
    it('returns distinct payees', () => {
        const result = fns.createAccount({ name: 'Checking', type: 'checking' });
        const accountId = Number(result.lastInsertRowid);

        fns.createTransaction({ accountId, date: today(), payee: 'Store A', outflow: 10 });
        fns.createTransaction({ accountId, date: today(), payee: 'Store B', outflow: 20 });
        fns.createTransaction({ accountId, date: today(), payee: 'Store A', outflow: 30 });

        const payees = fns.getPayees();
        expect(payees).toHaveLength(2);
        expect(payees).toContain('Store A');
        expect(payees).toContain('Store B');
    });
});
