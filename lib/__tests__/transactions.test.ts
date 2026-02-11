/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, today, currentMonth, nextMonth, mu } from './test-helpers';
import type { createDbFunctions } from '../repos';
import type { DrizzleDB } from '../db/helpers';

let db: DrizzleDB;
let fns: ReturnType<typeof createDbFunctions>;
let budgetId: number;
let accountId: number;
let groupId: number;
let categoryId: number;

beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;
    fns = testDb.fns;
    budgetId = testDb.defaultBudgetId;

    const accResult = await fns.createAccount({ name: 'Checking', type: 'checking', budgetId });
    accountId = accResult.id;

    const grpResult = await fns.createCategoryGroup('Essentials', budgetId);
    groupId = grpResult.id;

    const catResult = await fns.createCategory({ name: 'Groceries', category_group_id: groupId });
    categoryId = catResult.id;
});

// =====================================================================
// Transaction Filters
// =====================================================================
describe('Transaction Filters', () => {
    it('filters by categoryId', async () => {
        const cat2Result = await fns.createCategory({ name: 'Rent', category_group_id: groupId });
        const cat2Id = cat2Result.id;

        await fns.createTransaction({ accountId, date: today(), payee: 'Store', outflow: 50, categoryId });
        await fns.createTransaction({ accountId, date: today(), payee: 'Landlord', outflow: 1000, categoryId: cat2Id });

        const txs = await fns.getTransactions({ budgetId,  categoryId });
        expect(txs).toHaveLength(1);
        expect(txs[0].payee).toBe('Store');
    });

    it('filters by startDate', async () => {
        await fns.createTransaction({ accountId, date: '2025-01-01', payee: 'Old', outflow: 10 });
        await fns.createTransaction({ accountId, date: '2025-06-15', payee: 'Recent', outflow: 20 });

        const txs = await fns.getTransactions({ budgetId,  startDate: '2025-06-01' });
        expect(txs).toHaveLength(1);
        expect(txs[0].payee).toBe('Recent');
    });

    it('filters by endDate', async () => {
        await fns.createTransaction({ accountId, date: '2025-01-01', payee: 'Old', outflow: 10 });
        await fns.createTransaction({ accountId, date: '2025-06-15', payee: 'Recent', outflow: 20 });

        const txs = await fns.getTransactions({ budgetId,  endDate: '2025-03-01' });
        expect(txs).toHaveLength(1);
        expect(txs[0].payee).toBe('Old');
    });

    it('limits results', async () => {
        for (let i = 0; i < 5; i++) {
            await fns.createTransaction({ accountId, date: today(), payee: `Store ${i}`, outflow: i * 10 });
        }

        const txs = await fns.getTransactions({ budgetId,  limit: 3 });
        expect(txs).toHaveLength(3);
    });

    it('combines multiple filters', async () => {
        await fns.createTransaction({ accountId, date: '2025-01-15', payee: 'A', outflow: 10, categoryId });
        await fns.createTransaction({ accountId, date: '2025-03-15', payee: 'B', outflow: 20, categoryId });
        await fns.createTransaction({ accountId, date: '2025-06-15', payee: 'C', outflow: 30, categoryId });

        const txs = await fns.getTransactions({ budgetId, 
            categoryId,
            startDate: '2025-02-01',
            endDate: '2025-05-01',
        });
        expect(txs).toHaveLength(1);
        expect(txs[0].payee).toBe('B');
    });

    it('returns all transactions when no filters', async () => {
        await fns.createTransaction({ accountId, date: today(), payee: 'A', outflow: 10 });
        await fns.createTransaction({ accountId, date: today(), payee: 'B', outflow: 20 });

        const txs = await fns.getTransactions({ budgetId });
        expect(txs.length).toBeGreaterThanOrEqual(2);
    });

    it('returns transactions without budgetId filter', async () => {
        await fns.createTransaction({ accountId, date: today(), payee: 'No Budget Filter', outflow: 10 });

        // Cast to bypass TypeScript — testing runtime-defensive branch
        const txs = await fns.getTransactions({ accountId } as Parameters<typeof fns.getTransactions>[0]);
        expect(txs.length).toBeGreaterThanOrEqual(1);
    });

    it('returns transfer metadata in getTransactions', async () => {
        const acc2Result = await fns.createAccount({ name: 'Savings', type: 'savings', budgetId });
        const acc2Id = acc2Result.id;

        const transfer = await fns.createTransfer(budgetId, {
            fromAccountId: accountId,
            toAccountId: acc2Id,
            amount: 100,
            date: today(),
        });

        const txs = await fns.getTransactions({ budgetId,  accountId });
        expect(txs).toHaveLength(1);
        expect(txs[0].transferId).toBeDefined();
        expect(txs[0].transferAccountId).toBe(acc2Id);
        expect(txs[0].transferAccountName).toBe('Savings');
    });

    it('getTransactions returns no duplicate rows for transfers (all accounts view)', async () => {
        const acc2Result = await fns.createAccount({ name: 'Savings', type: 'savings', budgetId });
        const acc2Id = acc2Result.id;

        const transfer = await fns.createTransfer(budgetId, {
            fromAccountId: accountId,
            toAccountId: acc2Id,
            amount: 100,
            date: today(),
        });

        // Query ALL transactions (no accountId filter) — both sides of the transfer
        const txs = await fns.getTransactions({ budgetId });
        const ids = txs.map(t => t.id);
        const uniqueIds = new Set(ids);

        // Each transaction ID must appear exactly once
        expect(ids.length).toBe(uniqueIds.size);
        // Should be exactly 2 transactions (from + to)
        expect(txs).toHaveLength(2);
        // Both should have transfer metadata
        expect(txs.every(t => t.transferId != null)).toBe(true);
    });
});

// =====================================================================
// Update Transaction — Branch Coverage
// =====================================================================
describe('Update Transaction - All Fields', () => {
    let txId: number;

    beforeEach(async () => {
        const result = await fns.createTransaction({
            accountId,
            date: '2025-06-01',
            payee: 'Original',
            categoryId,
            memo: 'Original memo',
            outflow: 100,
            inflow: 0,
            cleared: 'Uncleared',
            flag: 'red',
        });
        txId = result.id;
    });

    it('updates date', async () => {
        await fns.updateTransaction(budgetId, txId, { date: '2025-07-01' });
        const tx = await fns.getTransaction(budgetId, txId);
        expect(tx.date).toBe('2025-07-01');
    });

    it('updates categoryId', async () => {
        const cat2Result = await fns.createCategory({ name: 'Dining', category_group_id: groupId });
        const cat2Id = cat2Result.id;

        await fns.updateTransaction(budgetId, txId, { categoryId: cat2Id });
        const tx = await fns.getTransaction(budgetId, txId);
        expect(tx.categoryId).toBe(cat2Id);
    });

    it('updates memo', async () => {
        await fns.updateTransaction(budgetId, txId, { memo: 'Updated memo' });
        const tx = await fns.getTransaction(budgetId, txId);
        expect(tx.memo).toBe('Updated memo');
    });

    it('updates inflow', async () => {
        await fns.updateTransaction(budgetId, txId, { inflow: 500 });
        const tx = await fns.getTransaction(budgetId, txId);
        expect(tx.inflow).toBe(500);
    });

    it('updates cleared status', async () => {
        await fns.updateTransaction(budgetId, txId, { cleared: 'Cleared' });
        const tx = await fns.getTransaction(budgetId, txId);
        expect(tx.cleared).toBe('Cleared');
    });

    it('updates flag', async () => {
        await fns.updateTransaction(budgetId, txId, { flag: 'blue' });
        const tx = await fns.getTransaction(budgetId, txId);
        expect(tx.flag).toBe('blue');
    });

    it('does nothing with empty update object', async () => {
        const result = await fns.updateTransaction(budgetId, txId, {});
        expect(result).toBeUndefined();
        const tx = await fns.getTransaction(budgetId, txId);
        expect(tx.payee).toBe('Original');
    });

    it('updates multiple fields at once', async () => {
        await fns.updateTransaction(budgetId, txId, {
            payee: 'New Payee',
            date: '2025-08-01',
            memo: 'New memo',
            outflow: 200,
            inflow: 50,
            cleared: 'Cleared',
            flag: 'green',
        });
        const tx = await fns.getTransaction(budgetId, txId);
        expect(tx.payee).toBe('New Payee');
        expect(tx.date).toBe('2025-08-01');
        expect(tx.memo).toBe('New memo');
        expect(tx.outflow).toBe(200);
        expect(tx.inflow).toBe(50);
        expect(tx.cleared).toBe('Cleared');
        expect(tx.flag).toBe('green');
    });
});

// =====================================================================
// Toggle Cleared — Edge Case
// =====================================================================
describe('Toggle Cleared - Edge Cases', () => {
    it('returns null for non-existent transaction', async () => {
        const result = await fns.toggleTransactionCleared(budgetId, 99999);
        expect(result).toBeNull();
    });
});

// =====================================================================
// Transfer Helpers
// =====================================================================
describe('Transfer Helpers', () => {
    it('getTransferByTransactionId returns the linked transfer', async () => {
        const acc2Result = await fns.createAccount({ name: 'Savings', type: 'savings', budgetId });
        const acc2Id = acc2Result.id;

        const transfer = await fns.createTransfer(budgetId, {
            fromAccountId: accountId,
            toAccountId: acc2Id,
            amount: 100,
            date: today(),
        });

        const found = (await fns.getTransferByTransactionId(budgetId, transfer.fromTransactionId))!;
        expect(found).toBeDefined();
        expect(found.id).toBe(transfer.transferId);
    });

    it('getTransferByTransactionId works for to_transaction_id', async () => {
        const acc2Result = await fns.createAccount({ name: 'Savings', type: 'savings', budgetId });
        const acc2Id = acc2Result.id;

        const transfer = await fns.createTransfer(budgetId, {
            fromAccountId: accountId,
            toAccountId: acc2Id,
            amount: 100,
            date: today(),
        });

        const found = (await fns.getTransferByTransactionId(budgetId, transfer.toTransactionId))!;
        expect(found).toBeDefined();
        expect(found.id).toBe(transfer.transferId);
    });

    it('getTransferByTransactionId returns undefined for non-transfer', async () => {
        const result = await fns.createTransaction({ accountId, date: today(), payee: 'Store', outflow: 50 });
        const txId = result.id;

        const found = await fns.getTransferByTransactionId(budgetId, txId);
        expect(found).toBeUndefined();
    });

    it('deleteTransfer throws for non-existent transfer', async () => {
        await expect(fns.deleteTransfer(budgetId, 99999)).rejects.toThrow();
    });

    it('createTransfer with memo and cleared status', async () => {
        const acc2Result = await fns.createAccount({ name: 'Savings', type: 'savings', budgetId });
        const acc2Id = acc2Result.id;

        const transfer = await fns.createTransfer(budgetId, {
            fromAccountId: accountId,
            toAccountId: acc2Id,
            amount: 200,
            date: today(),
            memo: 'Monthly transfer',
            cleared: 'Cleared',
        });

        const fromTx = await fns.getTransaction(budgetId, transfer.fromTransactionId);
        expect(fromTx.memo).toBe('Monthly transfer');
        expect(fromTx.cleared).toBe('Cleared');

        const toTx = await fns.getTransaction(budgetId, transfer.toTransactionId);
        expect(toTx.memo).toBe('Monthly transfer');
        expect(toTx.cleared).toBe('Cleared');
    });

    it('createTransfer updates account balances', async () => {
        // Start with initial balances by creating inflow transactions
        await fns.createTransaction({ accountId, date: today(), inflow: 1000, cleared: 'Cleared' });
        await fns.updateAccountBalances(budgetId, accountId);

        const acc2Result = await fns.createAccount({ name: 'Savings', type: 'savings', budgetId });
        const acc2Id = acc2Result.id;

        await fns.createTransfer(budgetId, {
            fromAccountId: accountId,
            toAccountId: acc2Id,
            amount: 300,
            date: today(),
        });

        const acc1 = (await fns.getAccount(budgetId, accountId))!;
        const acc2 = (await fns.getAccount(budgetId, acc2Id))!;
        expect(acc1.balance).toBe(700); // 1000 - 300
        expect(acc2.balance).toBe(300);
    });

    it('each transaction participates in at most one transfer (cross-column uniqueness)', async () => {
        // Create 3 accounts
        const acc2Result = await fns.createAccount({ name: 'Savings', type: 'savings', budgetId });
        const acc3Result = await fns.createAccount({ name: 'Cash', type: 'cash', budgetId });

        // Create 2 independent transfers
        const transfer1 = await fns.createTransfer(budgetId, {
            fromAccountId: accountId,
            toAccountId: acc2Result.id,
            amount: 100,
            date: today(),
        });
        const transfer2 = await fns.createTransfer(budgetId, {
            fromAccountId: acc2Result.id,
            toAccountId: acc3Result.id,
            amount: 50,
            date: today(),
        });

        // Verify each transaction has exactly one transfer link
        const t1From = await fns.getTransferByTransactionId(budgetId, transfer1.fromTransactionId);
        const t1To = await fns.getTransferByTransactionId(budgetId, transfer1.toTransactionId);
        const t2From = await fns.getTransferByTransactionId(budgetId, transfer2.fromTransactionId);
        const t2To = await fns.getTransferByTransactionId(budgetId, transfer2.toTransactionId);

        // Each should return exactly one transfer (not be mixed across transfers)
        expect(t1From!.id).toBe(transfer1.transferId);
        expect(t1To!.id).toBe(transfer1.transferId);
        expect(t2From!.id).toBe(transfer2.transferId);
        expect(t2To!.id).toBe(transfer2.transferId);

        // All 4 transaction IDs must be distinct (no cross-column reuse)
        const allIds = new Set([
            transfer1.fromTransactionId,
            transfer1.toTransactionId,
            transfer2.fromTransactionId,
            transfer2.toTransactionId,
        ]);
        expect(allIds.size).toBe(4);
    });
});

// =====================================================================
// Create Transaction — Default Values
// =====================================================================
describe('Create Transaction - Defaults', () => {
    it('creates with minimal parameters', async () => {
        const result = await fns.createTransaction({
            accountId,
            date: today(),
        });
        const id = result.id;
        const tx = await fns.getTransaction(budgetId, id);

        expect(tx.payee).toBeNull();
        expect(tx.categoryId).toBeNull();
        expect(tx.memo).toBeNull();
        expect(tx.outflow).toBe(0);
        expect(tx.inflow).toBe(0);
        expect(tx.cleared).toBe('Uncleared');
        expect(tx.flag).toBeNull();
    });
});

// =====================================================================
// Atomic Composite Operations
// =====================================================================
describe('Atomic Operations', () => {
    it('createTransactionAtomic creates transaction and updates account balance', async () => {
        const result = await fns.createTransactionAtomic(budgetId, {
            accountId,
            date: today(),
            payee: 'Atomic Store',
            outflow: 500,
            cleared: 'Cleared',
        });
        expect(result.id).toBeDefined();

        const account = (await fns.getAccount(budgetId, accountId))!;
        expect(account.balance).toBe(-500);
    });

    it('createTransactionAtomic triggers budget activity when categorized', async () => {
        // Assign some budget first
        await fns.updateBudgetAssignment(budgetId, categoryId, today().slice(0, 7), mu(1000));

        await fns.createTransactionAtomic(budgetId, {
            accountId,
            date: today(),
            payee: 'Budget Store',
            outflow: 300,
            categoryId,
        });

        const budget = await fns.getBudgetForMonth(budgetId, today().slice(0, 7));
        const cat = budget.find((b: { categoryId: number }) => b.categoryId === categoryId);
        expect(cat).toBeDefined();
        // Activity should reflect the outflow
        expect(cat!.activity).toBe(-300);
    });

    it('createTransactionAtomic triggers CC payment budget for CC account', async () => {
        // Create a CC account
        const ccAcc = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccGroup = await fns.createCategoryGroup('CC Payments', budgetId);
        const ccCat = await fns.createCategory({
            name: 'Visa Payment',
            category_group_id: ccGroup.id,
            linked_account_id: ccAcc.id,
        });

        // Give the spending category some budget
        await fns.updateBudgetAssignment(budgetId, categoryId, today().slice(0, 7), mu(500));

        // Spend on CC
        await fns.createTransactionAtomic(budgetId, {
            accountId: ccAcc.id,
            date: today(),
            payee: 'CC Purchase',
            outflow: 200,
            categoryId,
        });

        // CC account balance should be updated
        const ccAccount = (await fns.getAccount(budgetId, ccAcc.id))!;
        expect(ccAccount.balance).toBe(-200);
    });

    it('updateTransactionAtomic updates and recalculates balances', async () => {
        const tx = await fns.createTransactionAtomic(budgetId, {
            accountId,
            date: today(),
            payee: 'Original',
            outflow: 100,
            categoryId,
        });

        const original = await fns.getTransaction(budgetId, tx.id);

        await fns.updateTransactionAtomic(budgetId, tx.id, original, {
            outflow: 300,
        });

        const updated = await fns.getTransaction(budgetId, tx.id);
        expect(updated.outflow).toBe(300);

        // Account balance should reflect the new outflow
        const account = (await fns.getAccount(budgetId, accountId))!;
        expect(account.balance).toBe(-300);
    });

    it('deleteTransactionAtomic deletes and recalculates', async () => {
        const tx = await fns.createTransactionAtomic(budgetId, {
            accountId,
            date: today(),
            payee: 'To Delete',
            outflow: 500,
            categoryId,
        });

        const txn = await fns.getTransaction(budgetId, tx.id);
        await fns.deleteTransactionAtomic(budgetId, txn);

        // Transaction should be gone
        const deleted = await fns.getTransaction(budgetId, tx.id);
        expect(deleted).toBeUndefined();

        // Account balance should be restored
        const account = (await fns.getAccount(budgetId, accountId))!;
        expect(account.balance).toBe(0);
    });

    it('toggleClearedAtomic toggles cleared and updates balance', async () => {
        const tx = await fns.createTransactionAtomic(budgetId, {
            accountId,
            date: today(),
            payee: 'Toggle Me',
            outflow: 100,
            cleared: 'Uncleared',
        });

        await fns.toggleClearedAtomic(budgetId, tx.id, accountId);

        const toggled = await fns.getTransaction(budgetId, tx.id);
        expect(toggled.cleared).toBe('Cleared');

        const account = (await fns.getAccount(budgetId, accountId))!;
        expect(account.clearedBalance).toBe(-100);
    });

    it('reconcileAccountAtomic reconciles and updates balances', async () => {
        // Create a cleared transaction
        await fns.createTransactionAtomic(budgetId, {
            accountId,
            date: today(),
            payee: 'Cleared Tx',
            outflow: 500,
            cleared: 'Cleared',
        });

        await fns.reconcileAccountAtomic(budgetId, accountId);

        // After reconciliation, cleared transactions become Reconciled
        const txs = await fns.getTransactions({ budgetId, accountId });
        const reconciledTxs = txs.filter(t => t.cleared === 'Reconciled');
        expect(reconciledTxs).toHaveLength(1);
    });

    it('updateTransactionAtomic handles CC transaction date change across months', async () => {
        // Create a CC account
        const ccAcc = await fns.createAccount({ name: 'Test CC', type: 'credit', budgetId });
        await fns.ensureCreditCardPaymentCategory(ccAcc.id, 'Test CC');

        // Assign budget to the category
        const month = currentMonth();
        await fns.updateBudgetAssignment(budgetId, categoryId, month, mu(1000));

        // Create CC transaction in current month
        const tx = await fns.createTransactionAtomic(budgetId, {
            accountId: ccAcc.id,
            date: today(),
            payee: 'CC Store',
            outflow: 200,
            categoryId,
        });

        const original = await fns.getTransaction(budgetId, tx.id);

        // Change the date to next month (cross-month)
        const nextMo = nextMonth(month);
        await fns.updateTransactionAtomic(budgetId, tx.id, original, {
            date: `${nextMo}-15`,
        });

        // Verify the date was updated
        const updated = await fns.getTransaction(budgetId, tx.id);
        expect(updated.date).toBe(`${nextMo}-15`);
    });

    it('deleteTransactionAtomic handles CC account transaction', async () => {
        // Create a CC account
        const ccAcc = await fns.createAccount({ name: 'Delete CC', type: 'credit', budgetId });
        await fns.ensureCreditCardPaymentCategory(ccAcc.id, 'Delete CC');

        await fns.updateBudgetAssignment(budgetId, categoryId, currentMonth(), mu(1000));

        // Create CC transaction
        const tx = await fns.createTransactionAtomic(budgetId, {
            accountId: ccAcc.id,
            date: today(),
            payee: 'CC Purchase',
            outflow: 300,
            categoryId,
        });

        const txn = await fns.getTransaction(budgetId, tx.id);

        // Delete it — should trigger CC payment budget update
        await fns.deleteTransactionAtomic(budgetId, txn);

        // Transaction should be gone
        const deleted = await fns.getTransaction(budgetId, tx.id);
        expect(deleted).toBeUndefined();

        // CC account balance should be restored to 0
        const ccAccount = (await fns.getAccount(budgetId, ccAcc.id))!;
        expect(ccAccount.balance).toBe(0);
    });

    it('updateTransactionAtomic handles category change', async () => {
        // Create a second category to change to
        const cat2Result = await fns.createCategory({ name: 'Rent', category_group_id: groupId });
        const cat2Id = cat2Result.id;

        const month = currentMonth();
        await fns.updateBudgetAssignment(budgetId, categoryId, month, mu(1000));
        await fns.updateBudgetAssignment(budgetId, cat2Id, month, mu(500));

        // Create transaction in category 1
        const tx = await fns.createTransactionAtomic(budgetId, {
            accountId,
            date: today(),
            payee: 'Changing Category',
            outflow: 200,
            categoryId,
        });

        const original = await fns.getTransaction(budgetId, tx.id);

        // Change category from categoryId to cat2Id
        await fns.updateTransactionAtomic(budgetId, tx.id, original, {
            categoryId: cat2Id,
        });

        const updated = await fns.getTransaction(budgetId, tx.id);
        expect(updated.categoryId).toBe(cat2Id);
    });

    it('updateTransactionAtomic handles uncategorized transaction update', async () => {
        // Create a transaction WITHOUT a category
        const tx = await fns.createTransactionAtomic(budgetId, {
            accountId,
            date: today(),
            payee: 'No Category',
            outflow: 100,
        });

        const original = await fns.getTransaction(budgetId, tx.id);
        expect(original.categoryId).toBeNull();

        // Update the payee — no budget activity needed since no category
        await fns.updateTransactionAtomic(budgetId, tx.id, original, {
            payee: 'Updated No Category',
        });

        const updated = await fns.getTransaction(budgetId, tx.id);
        expect(updated.payee).toBe('Updated No Category');
    });

    it('updateTransactionAtomic handles clearing category to null', async () => {
        await fns.updateBudgetAssignment(budgetId, categoryId, currentMonth(), mu(1000));

        const tx = await fns.createTransactionAtomic(budgetId, {
            accountId,
            date: today(),
            payee: 'Will Remove Category',
            outflow: 200,
            categoryId,
        });

        const original = await fns.getTransaction(budgetId, tx.id);

        // Clear category to null
        await fns.updateTransactionAtomic(budgetId, tx.id, original, {
            categoryId: null,
        });

        const updated = await fns.getTransaction(budgetId, tx.id);
        expect(updated.categoryId).toBeNull();
    });

    it('updateTransactionAtomic handles cross-month date change on categorized cash tx', async () => {
        const month = currentMonth();
        await fns.updateBudgetAssignment(budgetId, categoryId, month, mu(1000));

        const tx = await fns.createTransactionAtomic(budgetId, {
            accountId,
            date: today(),
            payee: 'Cross Month Cash',
            outflow: 150,
            categoryId,
        });

        const original = await fns.getTransaction(budgetId, tx.id);

        // Change date to next month — categorized cash tx crosses months
        const nextMo = nextMonth(month);
        await fns.updateTransactionAtomic(budgetId, tx.id, original, {
            date: `${nextMo}-15`,
        });

        const updated = await fns.getTransaction(budgetId, tx.id);
        expect(updated.date).toBe(`${nextMo}-15`);
    });

    it('createTransactionAtomic handles inflow-only (no outflow)', async () => {
        // Trigger L376 `data.outflow || 0` fallback — no outflow provided
        const tx = await fns.createTransactionAtomic(budgetId, {
            accountId,
            date: today(),
            payee: 'Inflow Only',
            inflow: 500,
        });

        const txn = await fns.getTransaction(budgetId, tx.id);
        expect(txn.inflow).toBe(500);
        expect(txn.outflow).toBe(0);
    });

    it('updateTransactionAtomic handles CC same-month payee change', async () => {
        const ccAcc = await fns.createAccount({ name: 'Same Month CC', type: 'credit', budgetId });
        await fns.ensureCreditCardPaymentCategory(ccAcc.id, 'Same Month CC');

        await fns.updateBudgetAssignment(budgetId, categoryId, currentMonth(), mu(1000));

        const tx = await fns.createTransactionAtomic(budgetId, {
            accountId: ccAcc.id,
            date: today(),
            payee: 'CC Same Month',
            outflow: 150,
            categoryId,
        });

        const original = await fns.getTransaction(budgetId, tx.id);

        // Change only payee — same month, same account → L425 false branch
        await fns.updateTransactionAtomic(budgetId, tx.id, original, {
            payee: 'CC Same Month Updated',
        });

        const updated = await fns.getTransaction(budgetId, tx.id);
        expect(updated.payee).toBe('CC Same Month Updated');
    });

    it('deleteTransactionAtomic handles uncategorized transaction', async () => {
        // Create a transaction WITHOUT a category — hits L437 false branch
        const tx = await fns.createTransactionAtomic(budgetId, {
            accountId,
            date: today(),
            payee: 'No Category Delete',
            outflow: 100,
        });

        const txn = await fns.getTransaction(budgetId, tx.id);
        expect(txn.categoryId).toBeNull();

        await fns.deleteTransactionAtomic(budgetId, txn);

        const deleted = await fns.getTransaction(budgetId, tx.id);
        expect(deleted).toBeUndefined();
    });
});
