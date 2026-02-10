/**
 * Integration tests for the Drizzle custom `money` type (schema.ts).
 *
 * Verifies that Milliunit values round-trip correctly through the
 * custom BIGINT column type's fromDriver/toDriver functions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-helpers';
import type { createDbFunctions } from '../repos';

let fns: ReturnType<typeof createDbFunctions>;
let accountId: number;
let budgetId: number;

beforeEach(async () => {
    const result = await createTestDb();
    fns = result.fns;
    budgetId = result.defaultBudgetId;

    const account = await fns.createAccount({
        name: 'Test Checking',
        type: 'checking',
        budgetId,
    });
    accountId = account.id;
});

describe('Money column type round-trip', () => {
    it('stores and retrieves positive outflow correctly', async () => {
        const tx = await fns.createTransaction({
            accountId,
            date: '2025-06-01',
            payee: 'Store',
            outflow: 150000,
            inflow: 0,
        });

        const retrieved = await fns.getTransaction(budgetId, tx.id);
        expect(retrieved.outflow).toBe(150000);
        expect(retrieved.inflow).toBe(0);
    });

    it('stores and retrieves positive inflow correctly', async () => {
        const tx = await fns.createTransaction({
            accountId,
            date: '2025-06-01',
            payee: 'Salary',
            outflow: 0,
            inflow: 5000000,
        });

        const retrieved = await fns.getTransaction(budgetId, tx.id);
        expect(retrieved.inflow).toBe(5000000);
    });

    it('handles zero values correctly', async () => {
        const tx = await fns.createTransaction({
            accountId,
            date: '2025-06-01',
            payee: 'Memo Only',
            outflow: 0,
            inflow: 0,
        });

        const retrieved = await fns.getTransaction(budgetId, tx.id);
        expect(retrieved.outflow).toBe(0);
        expect(retrieved.inflow).toBe(0);
    });

    it('stores account balances as money type', async () => {
        // Create a transaction that will affect balance
        await fns.createTransaction({
            accountId,
            date: new Date().toISOString().slice(0, 10),
            payee: 'Deposit',
            outflow: 0,
            inflow: 1000000,
            cleared: 'Cleared',
        });

        await fns.updateAccountBalances(budgetId, accountId);

        const account = await fns.getAccount(budgetId, accountId);
        expect(account).toBeDefined();
        expect(account!.balance).toBe(1000000);
    });
});
