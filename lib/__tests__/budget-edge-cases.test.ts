/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Budget edge case tests — targets specific uncovered branches in budget.ts.
 *
 * Uncovered lines targeted:
 * - Line 80: row.available ?? 0 (budget_months row exists with NULL available)
 * - Line 252: existing.available || 0 (existing row with zero/null available in updateBudgetAssignment)
 * - Lines 273-285: Ghost entry cleanup path (shouldDelete=true → DB check + DELETE)
 * - Line 420: catBudget?.available || 0 (no budget_months row for CC spending category)
 * - Lines 544-568: getOverspendingTypes where classifyOverspending returns null
 * - Per-month RTA behavior (viewed month affects futureAssigned subtraction)
 * - Assignment propagation to subsequent months
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, seedCompleteMonth, today, currentMonth, prevMonth, nextMonth, mu, ZERO } from './test-helpers';
import type { createDbFunctions } from '../repos';
import type { DrizzleDB } from '../repos/client';
import { budgetMonths } from '../db/schema';
import { eq, and } from 'drizzle-orm';

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
// getBudgetForMonth — NULL available in budget_months row (line 80)
// =====================================================================
describe('getBudgetForMonth — edge cases', () => {
    it('returns available=0 when budget_months row has available=0', async () => {
        const { groupId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Insert a budget_months row with 0 available (activity but no budget)
        await db.insert(budgetMonths).values({
            categoryId: categoryIds[0],
            month,
            assigned: ZERO,
            activity: mu(-100),
            available: ZERO,
        });

        const rows = await fns.getBudgetForMonth(budgetId, month);
        const cat = rows.find(r => r.categoryId === categoryIds[0]);

        // available is 0 (from the row, not from carryforward)
        expect(cat!.available).toBe(0);
        expect(cat!.activity).toBe(-100);
    });

    it('includes null category rows (category group with no categories)', async () => {
        const month = currentMonth();

        // Create a group with no categories
        await fns.createCategoryGroup('Empty Group', budgetId);

        const rows = await fns.getBudgetForMonth(budgetId, month);
        // Should include the group row with null category_id
        const emptyGroupRow = rows.find(r => r.groupName === 'Empty Group');
        expect(emptyGroupRow).toBeDefined();
        expect(emptyGroupRow!.categoryId).toBeNull();
    });
});

// =====================================================================
// updateBudgetAssignment — ghost entry cleanup (lines 273-285)
// =====================================================================
describe('updateBudgetAssignment — ghost entry cleanup', () => {
    it('deletes ghost entries when assignment set to 0 (shouldDelete=true path)', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // 1. Assign 500 → creates a budget_months row
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));

        let rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));
        expect(rows).toHaveLength(1);
        expect(rows[0].assigned).toBe(500);

        // 2. Set back to 0 → should trigger ghost entry deletion
        //    (assigned=0, activity=0, available=0 → DELETE)
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(0));

        rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));

        // Row should be deleted (ghost entry prevention)
        expect(rows).toHaveLength(0);
    });

    it('does NOT delete when there is activity (shouldDelete=false)', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // 1. Assign 500
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));

        // 2. Add transaction → creates activity
        await fns.createTransaction({
            accountId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: mu(100),
        });
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        // 3. Set assigned back to 0 → but activity != 0 so it should NOT delete
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(0));

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));

        expect(rows).toHaveLength(1);
        expect(rows[0].assigned).toBe(0);
        expect(rows[0].activity).toBe(-100);
    });

    it('propagates delta to subsequent months and cleans ghosts', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const next = nextMonth(month);

        // Assign in current month
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));

        // Create a row in the next month (simulating a subsequent assignment)
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], next, mu(200));

        // Next month's available should include carryforward
        let nextRows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, next)
            ));
        expect(nextRows[0].available).toBe(700); // carry(500) + assigned(200)

        // Now change current month's assignment → delta should propagate
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(300));

        nextRows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, next)
            ));
        // available was 700, delta is -200, so 700 + (-200) = 500
        expect(nextRows[0].available).toBe(500);
    });

    it('does NOT delete ghost when DB re-check finds non-zero activity', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Create a budget_months row where the DB 'activity' column is non-zero
        // but the engine's computed activity is 0:
        await db.insert(budgetMonths).values({
            categoryId: categoryIds[0],
            month,
            assigned: mu(100),
            activity: mu(-50),
            available: mu(100),
        });

        // Engine computes: activity = available(100) - assigned(100) - carry(0) = 0 → shouldDelete=true
        // After UPDATE: assigned=0, available=0. But DB activity=-50 (from the INSERT above).
        // Re-check: assigned=0, activity=-50, available=0 → activity != 0 → do NOT delete
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(0));

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));

        // Row should NOT be deleted because activity is non-zero in the DB
        expect(rows).toHaveLength(1);
        expect(rows[0].assigned).toBe(0);
        expect(rows[0].activity).toBe(-50);
    });

    it('propagation cleans up ghost entries in future months', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const next = nextMonth(month);

        // Create a future row that will become a ghost
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], next, mu(100));

        // Now set it back to 0 → should be deleted
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], next, mu(0));

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, next)
            ));
        expect(rows).toHaveLength(0);
    });
});

// =====================================================================
// updateBudgetAssignment — existing row with zero/null available (line 252)
// =====================================================================
describe('updateBudgetAssignment — zero available edge cases', () => {
    it('handles existing row with available=0 correctly', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Insert a row with available=0 explicitly
        await db.insert(budgetMonths).values({
            categoryId: categoryIds[0],
            month,
            assigned: ZERO,
            activity: mu(-100),
            available: ZERO,
        });

        // Now assign 200 to this category
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(200));

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));

        expect(rows[0].assigned).toBe(200);
        // available = old_available(0) + delta(200) = 200
        expect(rows[0].available).toBe(200);
    });

    it('handles updating assignment on existing row with zero available', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Insert a row with available=0 and assigned=50 (e.g., activity consumed it)
        await db.insert(budgetMonths).values({
            categoryId: categoryIds[0],
            month,
            assigned: mu(50),
            activity: mu(-50),
            available: ZERO,
        });

        // Assign 100 → delta = 100 - 50 = 50
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(100));

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));

        expect(rows[0].assigned).toBe(100);
        // available = old_available(0) + delta(50) = 50
        expect(rows[0].available).toBe(50);
    });

    it('skips delta propagation when reassigning the same value (delta=0)', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const next = nextMonth(month);

        // Assign 500 in current month
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));

        // Create a future row to verify it's NOT affected
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], next, mu(200));

        let nextRows = await db.select({ available: budgetMonths.available })
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, next)
            ));
        const availBefore = nextRows[0].available; // 700 (carry 500 + assigned 200)

        // Reassign the SAME value → delta = 0 → no propagation (line 286 false branch)
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));

        nextRows = await db.select({ available: budgetMonths.available })
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, next)
            ));

        // Future month available should be unchanged
        expect(nextRows[0].available).toBe(availBefore);
    });
});

// =====================================================================
// updateCreditCardPaymentBudget — no budget row for spending category (line 420)
// =====================================================================
describe('updateCreditCardPaymentBudget — missing budget for spending category', () => {
    it('handles CC spending in category without budget_months row', async () => {
        const { accountId, groupId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Create CC account
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');

        // Spend on CC in a category that has NO budget_months row
        // (no assignment, no activity update yet → catBudget is null on line 420)
        await fns.createTransaction({
            accountId: ccId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: mu(100),
        });

        // Don't update budget activity first → category has no budget row
        // This hits the catBudget?.available || 0 fallback
        await fns.updateCreditCardPaymentBudget(budgetId, ccId, month);

        const ccCategory = (await fns.getCreditCardPaymentCategory(ccId))!;
        const ccRows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, ccCategory.id),
                eq(budgetMonths.month, month)
            ));

        expect(ccRows).toHaveLength(1);
        // With zero available, funded = MIN(MAX(0, 0+100), 100) = MIN(100, 100) = 100
        expect(ccRows[0].activity).toBe(100);
    });
});

// =====================================================================
// getOverspendingTypes — classifyOverspending returns null (lines 544-546)
// =====================================================================
describe('getOverspendingTypes — null classification edge case', () => {
    it('skips categories where classifyOverspending returns null', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Set category to exactly 0 (not overspent)
        await db.insert(budgetMonths).values({
            categoryId: categoryIds[0],
            month,
            assigned: ZERO,
            activity: ZERO,
            available: ZERO,
        });

        const result = await fns.getOverspendingTypes(budgetId, month);
        expect(result[categoryIds[0]]).toBeUndefined();
    });

    it('handles mixed CC and cash spending correctly', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Create CC account
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;

        // Assign some budget
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(50));

        // Spend on both cash AND CC in the same category
        await fns.createTransaction({
            accountId,
            date: today(),
            payee: 'Cash Store',
            categoryId: categoryIds[0],
            outflow: mu(30),
        });
        await fns.createTransaction({
            accountId: ccId,
            date: today(),
            payee: 'CC Store',
            categoryId: categoryIds[0],
            outflow: mu(80),
        });
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        const result = await fns.getOverspendingTypes(budgetId, month);
        // available = 50 - 30 - 80 = -60, has cash spending → 'cash' takes priority
        expect(result[categoryIds[0]]).toBe('cash');
    });
});

// =====================================================================
// getReadyToAssign — per-month behavior
// =====================================================================
describe('getReadyToAssign — per-month RTA', () => {
    it('returns cash balance when no budget data exists', async () => {
        const { accountId } = await seedBasicBudget(fns, { db });

        // Add income transaction
        await fns.createTransaction({
            accountId,
            date: today(),
            inflow: 5000,
        });
        await fns.updateAccountBalances(budgetId, accountId);

        const rta = await fns.getReadyToAssign(budgetId, currentMonth());
        // No budget months with >= 10 categories → latestMonth is null
        // RTA = cashBalance + positiveCCBalances = 5000 + 0 = 5000
        expect(rta).toBe(5000);
    });

    it('subtracts assignments from RTA for the viewed month', async () => {
        const { accountId, groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();

        // Add income
        await fns.createTransaction({
            accountId,
            date: today(),
            inflow: 5000,
        });

        // Seed complete month
        await seedCompleteMonth(fns, db, month, groupId);

        // Assign
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(2000));

        const rta = await fns.getReadyToAssign(budgetId, month);
        expect(rta).toBeLessThan(5000);
    });

    it('does not subtract future month assignments beyond viewed month', async () => {
        const { accountId, groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();
        const future = nextMonth(month);
        const farFuture = nextMonth(future);

        // Add income
        await fns.createTransaction({
            accountId,
            date: today(),
            inflow: 10000,
        });

        // Seed complete month
        await seedCompleteMonth(fns, db, month, groupId);

        // Assign in current month
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(1000));

        // Assign in far future (beyond viewed month)
        await fns.updateBudgetAssignment(budgetId, categoryIds[1], farFuture, mu(3000));

        // When viewing current month, farFuture assignment should NOT be subtracted
        const rtaCurrent = await fns.getReadyToAssign(budgetId, month);

        // When viewing farFuture, it SHOULD be subtracted
        const rtaFarFuture = await fns.getReadyToAssign(budgetId, farFuture);

        expect(rtaCurrent).toBeGreaterThan(rtaFarFuture);
        expect(rtaCurrent - rtaFarFuture).toBe(3000);
    });
});

// =====================================================================
// deleteTransfer — account balance update (transactions.ts lines 283-284)
// =====================================================================
describe('deleteTransfer — balance updates', () => {
    it('updates both account balances after deleting transfer', async () => {
        const { accountId } = await seedBasicBudget(fns, { db });

        // Add initial funds
        await fns.createTransaction({ accountId, date: today(), inflow: 1000, cleared: 'Cleared' });
        await fns.updateAccountBalances(budgetId, accountId);

        const acc2Result = await fns.createAccount({ name: 'Savings', type: 'savings', budgetId });
        const acc2Id = acc2Result.id;

        // Create transfer
        const transfer = await fns.createTransfer(budgetId, {
            fromAccountId: accountId,
            toAccountId: acc2Id,
            amount: 300,
            date: today(),
        });

        // Verify balances after transfer
        let acc1: any = await fns.getAccount(budgetId, accountId);
        let acc2: any = await fns.getAccount(budgetId, acc2Id);
        expect(acc1.balance).toBe(700);
        expect(acc2.balance).toBe(300);

        // Delete transfer → should update both balances
        const result = await fns.deleteTransfer(budgetId, Number(transfer.transferId));

        acc1 = await fns.getAccount(budgetId, accountId);
        acc2 = await fns.getAccount(budgetId, acc2Id);
        expect(acc1.balance).toBe(1000);
        expect(acc2.balance).toBe(0);
        expect(result.fromAccountId).toBe(accountId);
        expect(result.toAccountId).toBe(acc2Id);
    });
});

// =====================================================================
// updateBudgetAssignment — skips when assigning 0 on non-existing row
// =====================================================================
describe('updateBudgetAssignment — skip insertion for zero', () => {
    it('does not create a budget_months row when assigning 0 to category with no row', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Assign 0 → should skip (no row created)
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(0));

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));

        expect(rows).toHaveLength(0);
    });
});

// =====================================================================
// getReadyToAssign — includes positive CC balances
// =====================================================================
describe('getReadyToAssign — positive CC balances', () => {
    it('adds positive CC balance to RTA', async () => {
        const { groupId, accountId } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();

        // Create a CC account with positive balance (cashback)
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;

        // Add income to cash account
        await fns.createTransaction({
            accountId,
            date: today(),
            inflow: 5000,
        });

        // Add cashback to CC (inflow > outflow → positive balance)
        await fns.createTransaction({
            accountId: ccId,
            date: today(),
            inflow: 100,
        });

        // Seed complete month
        await seedCompleteMonth(fns, db, month, groupId);

        const rta = await fns.getReadyToAssign(budgetId, month);
        // Should include the 100 positive CC balance
        expect(rta).toBe(5100);
    });
});

// =====================================================================
// Credit overspending correction in RTA
// =====================================================================
describe('getReadyToAssign — overspending correction', () => {
    it('credit overspending does not reduce RTA', async () => {
        const { accountId, groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();

        // Create CC
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;

        // Income
        await fns.createTransaction({ accountId, date: today(), inflow: 5000 });

        // Seed complete month
        await seedCompleteMonth(fns, db, month, groupId);

        // Assign 100 but spend 200 on CC → credit overspending of 100
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(100));
        await fns.createTransaction({
            accountId: ccId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: mu(200),
        });
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        const rta = await fns.getReadyToAssign(budgetId, month);
        // The credit overspending correction ensures RTA isn't falsely inflated
        expect(rta).toBeGreaterThan(0);
    });
});

// =====================================================================
// computeCarryforward (repo layer) — chain across multiple months
// =====================================================================
describe('computeCarryforward — multi-month chain', () => {
    it('carries forward available across multiple months', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month1 = '2025-01';
        const month2 = '2025-02';
        const month3 = '2025-03';

        // Assign in month 1
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month1, mu(500));

        // Month 2 should get carryforward of 500
        const rows2 = await fns.getBudgetForMonth(budgetId, month2);
        const cat2 = rows2.find(r => r.categoryId === categoryIds[0]);
        expect(cat2!.available).toBe(500);

        // Month 3 should also get 500 (chain)
        const rows3 = await fns.getBudgetForMonth(budgetId, month3);
        const cat3 = rows3.find(r => r.categoryId === categoryIds[0]);
        expect(cat3!.available).toBe(500);
    });
});
