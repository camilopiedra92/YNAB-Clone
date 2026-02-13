
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, seedCompleteMonth, today, currentMonth, prevMonth, nextMonth, mu, ZERO } from './test-helpers';
import type { createDbFunctions } from '../repos';
import type { DrizzleDB } from '../db/helpers';
import { budgetMonths, categoryGroups } from '../db/schema';
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
// getBudgetForMonth
// =====================================================================
describe('getBudgetForMonth', () => {
    it('returns all non-income categories for a month', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Assign to first category
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));

        const rows = await fns.getBudgetForMonth(budgetId, month);
        expect(rows.length).toBeGreaterThanOrEqual(3);

        const assignedRow = rows.find(r => r.categoryId === categoryIds[0]);
        expect(assignedRow!.assigned).toBe(500);
    });

    it('computes carryforward for categories without budget_months row', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const next = nextMonth(month);

        // Assign in current month but don't assign in next month
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(300));

        const rows = await fns.getBudgetForMonth(budgetId, next);
        const cat = rows.find(r => r.categoryId === categoryIds[0]);

        // Should carry forward the available from the previous month
        expect(cat!.available).toBe(300);
    });

    it('handles categories with zero available from budget_months row', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Create a budget_months row with 0
        await db.insert(budgetMonths).values({
            budgetId,
            categoryId: categoryIds[0],
            month,
            assigned: ZERO,
            activity: ZERO,
            available: ZERO,
        });

        const rows = await fns.getBudgetForMonth(budgetId, month);
        const cat = rows.find(r => r.categoryId === categoryIds[0]);
        expect(cat!.available).toBe(0);
    });

    it('includes category and group metadata', async () => {
        const { groupId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        const rows = await fns.getBudgetForMonth(budgetId, month);
        const cat = rows.find(r => r.categoryId === categoryIds[0]);

        expect(cat!.categoryName).toBe('Category 1');
        expect(cat!.groupName).toBe('Essentials');
        expect(cat!.categoryGroupId).toBe(groupId);
        expect(cat!.month).toBe(month);
    });

    it('excludes income category groups', async () => {
        await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Create an income group using Drizzle
        await db.insert(categoryGroups).values({
            name: 'Income',
            sortOrder: 99,
            isIncome: true,
            budgetId,
        });

        const rows = await fns.getBudgetForMonth(budgetId, month);
        const incomeRows = rows.filter(r => r.groupName === 'Income');
        expect(incomeRows).toHaveLength(0);
    });
});

// =====================================================================
// getReadyToAssignBreakdown
// =====================================================================
describe('getReadyToAssignBreakdown', () => {
    it('returns breakdown with all fields', async () => {
        const { accountId, groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();

        // Create income group and category
        const incomeGroupResult = await db.insert(categoryGroups).values({
            name: 'Income',
            sortOrder: 99,
            isIncome: true,
            budgetId,
        }).returning({ id: categoryGroups.id });
        const incomeGroupId = incomeGroupResult[0].id;
        const incomeCatResult = await fns.createCategory({ name: 'Salary', category_group_id: incomeGroupId });
        const incomeCatId = incomeCatResult.id;

        // Add income transaction
        await fns.createTransaction(budgetId, {
            accountId,
            date: today(),
            payee: 'Employer',
            categoryId: incomeCatId,
            inflow: 5000,
        });

        // Seed complete month
        await seedCompleteMonth(fns, db, month, groupId, budgetId);

        // Assign to category
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(1000));

        const breakdown = await fns.getReadyToAssignBreakdown(budgetId, month);
        expect(breakdown).toHaveProperty('readyToAssign');
        expect(breakdown).toHaveProperty('inflowThisMonth');
        expect(breakdown).toHaveProperty('positiveCCBalances');
        expect(breakdown).toHaveProperty('assignedThisMonth');
        expect(breakdown).toHaveProperty('assignedInFuture');
        expect(breakdown).toHaveProperty('cashOverspendingPreviousMonth');
        expect(breakdown).toHaveProperty('leftOverFromPreviousMonth');

        expect(breakdown.inflowThisMonth).toBe(5000);
        expect(breakdown.assignedThisMonth).toBe(1000);
    });

    it('reports assigned in future months', async () => {
        const { groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();
        const future = nextMonth(month);

        // Seed complete month
        await seedCompleteMonth(fns, db, month, groupId, budgetId);

        // Assign in current month
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(1000));

        // Assign in future month
        await fns.updateBudgetAssignment(budgetId, categoryIds[1], future, mu(500));

        const breakdown = await fns.getReadyToAssignBreakdown(budgetId, month);
        expect(breakdown.assignedInFuture).toBe(500);
    });

    it('reports cash overspending from previous month', async () => {
        const { accountId, groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();
        const prev = prevMonth(month);

        // Seed complete month for previous month
        await seedCompleteMonth(fns, db, prev, groupId, budgetId);

        // Create overspending in previous month:
        // Assign 50 to category but spend 100 on cash
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], prev, mu(50));
        await fns.createTransaction(budgetId, {
            accountId,
            date: `${prev}-15`,
            payee: 'Overspent Store',
            categoryId: categoryIds[0],
            outflow: 100,
        });
        await fns.updateBudgetActivity(budgetId, categoryIds[0], prev);

        // Ensure we have a complete month for current
        await seedCompleteMonth(fns, db, month, groupId, budgetId);

        const breakdown = await fns.getReadyToAssignBreakdown(budgetId, month);
        expect(breakdown.cashOverspendingPreviousMonth).toBe(50); // 100 spent - 50 available = 50 overspent
    });
});

// =====================================================================
// updateBudgetActivity
// =====================================================================
describe('updateBudgetActivity', () => {
    it('creates a new budget_months row if none exists', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Create a transaction for the category
        await fns.createTransaction(budgetId, {
            accountId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 100,
        });

        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));

        expect(rows).toHaveLength(1);
        expect(rows[0].activity).toBe(-100); // outflow = negative activity
        expect(rows[0].assigned).toBe(0);
    });

    it('updates an existing budget_months row', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Assign first
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));

        // Create a transaction
        await fns.createTransaction(budgetId, {
            accountId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 100,
        });

        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));

        expect(rows[0].assigned).toBe(500);
        expect(rows[0].activity).toBe(-100);
        expect(rows[0].available).toBe(400); // carryforward(0) + 500 + (-100) = 400
    });

    it('handles inflow activity', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        await fns.createTransaction(budgetId, {
            accountId,
            date: today(),
            payee: 'Refund',
            categoryId: categoryIds[0],
            inflow: 200,
        });

        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));

        expect(rows[0].activity).toBe(200); // positive activity from inflow
    });
});

// =====================================================================
// refreshAllBudgetActivity
// =====================================================================
describe('refreshAllBudgetActivity', () => {
    it('recalculates all categories with transactions', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Assign budgets
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));
        await fns.updateBudgetAssignment(budgetId, categoryIds[1], month, mu(300));

        // Create transactions
        await fns.createTransaction(budgetId, {
            accountId,
            date: today(),
            payee: 'Store A',
            categoryId: categoryIds[0],
            outflow: 100,
        });
        await fns.createTransaction(budgetId, {
            accountId,
            date: today(),
            payee: 'Store B',
            categoryId: categoryIds[1],
            outflow: 50,
        });

        await fns.refreshAllBudgetActivity(budgetId, month);

        const rows0 = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));
        const rows1 = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[1]),
                eq(budgetMonths.month, month)
            ));

        expect(rows0[0].activity).toBe(-100);
        expect(rows0[0].available).toBe(400);
        expect(rows1[0].activity).toBe(-50);
        expect(rows1[0].available).toBe(250);
    });

    it('recalculates CC payment categories', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Create a CC account
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;

        // Ensure CC payment category exists
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');

        // Assign some budget to a category
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));

        // Create a CC transaction
        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: today(),
            payee: 'CC Store',
            categoryId: categoryIds[0],
            outflow: 200,
        });

        // First update regular activity so available is correct
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        // Then refresh all
        await fns.refreshAllBudgetActivity(budgetId, month);

        const ccCategory = await fns.getCreditCardPaymentCategory(ccId);
        if (ccCategory) {
            const ccRows = await db.select()
                .from(budgetMonths)
                .where(and(
                    eq(budgetMonths.categoryId, ccCategory.id),
                    eq(budgetMonths.month, month)
                ));

            // CC payment should have activity from funded spending
            expect(ccRows).toHaveLength(1);
        }
    });

    it('carries forward available across multiple months', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const next = nextMonth(month);

        // Set up prior month with assigned budget
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));

        // Create a transaction in the prior month to generate activity
        await fns.createTransaction(budgetId, {
            accountId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 100,
        });

        // Refresh the current month so budget_months rows exist with available values
        await fns.refreshAllBudgetActivity(budgetId, month);

        // Now refresh the NEXT month — this forces the prevRows loop to execute
        // because budget_months rows exist for the prior month
        await fns.refreshAllBudgetActivity(budgetId, next);

        // Category 0 should carry forward: available = carryforward(400) + assigned(0) + activity(0) = 400
        const rows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, next)
            ));

        expect(rows).toHaveLength(1);
        expect(rows[0].available).toBe(400); // 500 assigned - 100 spent = 400 carried forward
    });

    it('resets negative available for regular categories at month rollover', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const next = nextMonth(month);

        // Assign 50 but spend 100 → available = -50 (cash overspending)
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(50));
        await fns.createTransaction(budgetId, {
            accountId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 100,
        });
        await fns.refreshAllBudgetActivity(budgetId, month);

        // Verify current month has negative available
        const currentRows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));
        expect(currentRows[0].available).toBe(-50);

        // Refresh next month — carryforward should reset negative to 0
        await fns.refreshAllBudgetActivity(budgetId, next);

        // Regular category: negative available MUST reset to 0 at month rollover
        const nextRows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, next)
            ));
        // Should NOT exist (available=0, assigned=0, activity=0 → ghost cleanup deletes it)
        expect(nextRows).toHaveLength(0);
    });

    it('resets credit card overspending at month rollover (does not carry into next month)', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const next = nextMonth(month);

        // Create CC account
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');

        // Assign 50 to category, then spend 100 on CC → credit overspending of 50
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(50));
        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: today(),
            payee: 'CC Store',
            categoryId: categoryIds[0],
            outflow: 100,
        });
        await fns.refreshAllBudgetActivity(budgetId, month);

        // Verify current month: available = 50 - 100 = -50 (credit overspending)
        const currentRows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));
        expect(currentRows[0].available).toBe(-50);

        // Refresh next month
        await fns.refreshAllBudgetActivity(budgetId, next);

        // Next month: credit overspending MUST reset to 0 — it should NOT carry forward
        const nextRows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, next)
            ));
        // Ghost cleanup deletes the row since available=0, assigned=0, activity=0
        expect(nextRows).toHaveLength(0);
    });

    it('preserves negative available for CC payment categories at month rollover', async () => {
        const month = currentMonth();
        const next = nextMonth(month);

        // Create CC account and linked payment category
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');
        const ccCat = (await fns.getCreditCardPaymentCategory(ccId))!;

        // Manually set negative available (representing CC debt)
        await db.insert(budgetMonths).values({
            budgetId,
            categoryId: ccCat.id,
            month,
            assigned: ZERO,
            activity: mu(-500),
            available: mu(-500),
        });

        // Read next month via getBudgetForMonth — CC debt should carry forward
        const rows = await fns.getBudgetForMonth(budgetId, next);
        const ccRow = rows.find(r => r.categoryId === ccCat.id);
        expect(ccRow).toBeDefined();
        expect(ccRow!.available).toBe(-500); // CC Payment debt carries forward
    });
});

// =====================================================================
// CC Payment Category Management
// =====================================================================
describe('Credit Card Payment Category', () => {
    it('getCreditCardPaymentCategory returns null when not exists', async () => {
        const result = await fns.getCreditCardPaymentCategory(99999);
        expect(result).toBeUndefined();
    });

    it('ensureCreditCardPaymentCategory creates new category and group', async () => {
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;

        const category = (await fns.ensureCreditCardPaymentCategory(ccId, 'Visa'))!;

        expect(category).toBeDefined();
        expect(category.name).toBe('Visa');
        expect(category.linkedAccountId).toBe(ccId);

        // Verify the group was created
        const groups = await fns.getCategoryGroups(budgetId, );
        const ccGroup = groups.find(g => g.name === 'Credit Card Payments');
        expect(ccGroup).toBeDefined();
    });

    it('ensureCreditCardPaymentCategory returns existing category', async () => {
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;

        const cat1 = (await fns.ensureCreditCardPaymentCategory(ccId, 'Visa'))!;
        const cat2 = (await fns.ensureCreditCardPaymentCategory(ccId, 'Visa'))!;

        expect(cat1.id).toBe(cat2.id); // Same category
    });

    it('ensureCreditCardPaymentCategory reuses existing CC Payments group', async () => {
        const cc1Result = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const cc2Result = await fns.createAccount({ name: 'Mastercard', type: 'credit', budgetId });
        const cc1Id = cc1Result.id;
        const cc2Id = cc2Result.id;

        await fns.ensureCreditCardPaymentCategory(cc1Id, 'Visa');
        await fns.ensureCreditCardPaymentCategory(cc2Id, 'Mastercard');

        // Only one "Credit Card Payments" group should exist
        const groups = await fns.getCategoryGroups(budgetId, );
        const ccGroups = groups.filter(g => g.name === 'Credit Card Payments');
        expect(ccGroups).toHaveLength(1);
    });
});

// =====================================================================
// updateCreditCardPaymentBudget
// =====================================================================
describe('updateCreditCardPaymentBudget', () => {
    it('does nothing if no CC payment category exists', async () => {
        // No CC account or category
        await fns.updateCreditCardPaymentBudget(budgetId, 99999, currentMonth());
        // Should not throw
    });

    it('computes funded spending for CC transactions', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Create CC account
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');

        // Budget 500 for category
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));

        // Spend 200 on CC
        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 200,
        });

        // Update regular budget activity first
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        // Now update CC payment
        await fns.updateCreditCardPaymentBudget(budgetId, ccId, month);

        const ccCategory = (await fns.getCreditCardPaymentCategory(ccId))!;
        const ccRows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, ccCategory.id),
                eq(budgetMonths.month, month)
            ));

        expect(ccRows).toHaveLength(1);
        // Funded amount should be 200 (fully funded since category had 500)
        expect(ccRows[0].activity).toBe(200);
    });

    it('handles CC payments (transfers) by subtracting from activity', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Create CC account
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');

        // Budget 500 for category
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));

        // Spend 200 on CC
        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 200,
        });

        // Pay CC (transfer inflow with no category)
        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: today(),
            payee: 'Transfer',
            inflow: 100,
        });

        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);
        await fns.updateCreditCardPaymentBudget(budgetId, ccId, month);

        const ccCategory = (await fns.getCreditCardPaymentCategory(ccId))!;
        const ccRows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, ccCategory.id),
                eq(budgetMonths.month, month)
            ));

        // activity = funded_spending(200) - payments(100) = 100
        expect(ccRows[0].activity).toBe(100);
    });

    it('creates new row when no existing budget for CC category', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');

        // Budget and spend
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));
        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 100,
        });
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);
        await fns.updateCreditCardPaymentBudget(budgetId, ccId, month);

        const ccCategory = (await fns.getCreditCardPaymentCategory(ccId))!;
        const ccRows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, ccCategory.id),
                eq(budgetMonths.month, month)
            ));

        expect(ccRows).toHaveLength(1);
        expect(ccRows[0].assigned).toBe(0);
    });

    it('skips insert when activity is 0 and no existing row (ghost prevention)', async () => {
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');

        const month = currentMonth();

        // No transactions → activity = 0
        await fns.updateCreditCardPaymentBudget(budgetId, ccId, month);

        const ccCategory = (await fns.getCreditCardPaymentCategory(ccId))!;
        const ccRows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, ccCategory.id),
                eq(budgetMonths.month, month)
            ));

        // Should NOT create a ghost entry
        expect(ccRows).toHaveLength(0);
    });

    it('updates existing row for CC category', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');
        const ccCategory = (await fns.getCreditCardPaymentCategory(ccId))!;

        // Pre-create an existing budget row with manual assignment
        await db.insert(budgetMonths).values({
            budgetId,
            categoryId: ccCategory.id,
            month,
            assigned: mu(100),
            activity: ZERO,
            available: mu(100),
        });

        // Budget and spend on CC
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));
        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 200,
        });
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);
        await fns.updateCreditCardPaymentBudget(budgetId, ccId, month);

        const ccRows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, ccCategory.id),
                eq(budgetMonths.month, month)
            ));

        expect(ccRows[0].assigned).toBe(100); // unchanged
        expect(ccRows[0].activity).toBe(200); // funded spending
        // available = carryforward(0) + assigned(100) + activity(200) = 300
        expect(ccRows[0].available).toBe(300);
    });
});

// =====================================================================
// getCashOverspendingForMonth
// =====================================================================
describe('getCashOverspendingForMonth', () => {
    it('returns 0 when no overspending', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));

        const overspending = await fns.getCashOverspendingForMonth(budgetId, month);
        expect(overspending).toBe(0);
    });

    it('detects cash overspending', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Assign 50 but spend 100 from cash
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(50));
        await fns.createTransaction(budgetId, {
            accountId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 100,
        });
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        const overspending = await fns.getCashOverspendingForMonth(budgetId, month);
        expect(overspending).toBe(50); // overspent by 50
    });

    it('returns 0 for credit-only overspending', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Create CC account
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;

        // Assign 50 but spend 100 on CC
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(50));
        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 100,
        });
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        const overspending = await fns.getCashOverspendingForMonth(budgetId, month);
        // CC overspending doesn't count as cash overspending
        expect(overspending).toBe(0);
    });
});

// =====================================================================
// getOverspendingTypes
// =====================================================================
describe('getOverspendingTypes', () => {
    it('returns empty object when no overspending', async () => {
        await seedBasicBudget(fns, { db });
        const result = await fns.getOverspendingTypes(budgetId, currentMonth());
        expect(result).toEqual({});
    });

    it('classifies cash overspending as cash', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(50));
        await fns.createTransaction(budgetId, {
            accountId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 100,
        });
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        const result = await fns.getOverspendingTypes(budgetId, month);
        expect(result[categoryIds[0]]).toBe('cash');
    });

    it('classifies credit overspending as credit', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;

        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(50));
        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 100,
        });
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        const result = await fns.getOverspendingTypes(budgetId, month);
        expect(result[categoryIds[0]]).toBe('credit');
    });

    it('classifies CC payment category overspending as credit', async () => {
        const month = currentMonth();

        // Create CC account and linked category
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');
        const ccCat = (await fns.getCreditCardPaymentCategory(ccId))!;

        // Manually set negative available for CC Payment category
        await db.insert(budgetMonths).values({
            budgetId,
            categoryId: ccCat.id,
            month,
            assigned: ZERO,
            activity: mu(-200),
            available: mu(-200),
        });

        const result = await fns.getOverspendingTypes(budgetId, month);
        expect(result[ccCat.id]).toBe('credit');
    });
});

// =====================================================================
// getBudgetInspectorData
// =====================================================================
describe('getBudgetInspectorData', () => {
    it('returns complete inspector data structure', async () => {
        const { accountId, groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();

        // Create income group using Drizzle
        const incomeGroupResult = await db.insert(categoryGroups).values({
            name: 'Income',
            sortOrder: 99,
            isIncome: true,
            budgetId,
        }).returning({ id: categoryGroups.id });
        const incomeGroupId = incomeGroupResult[0].id;
        const incomeCatResult = await fns.createCategory({ name: 'Salary', category_group_id: incomeGroupId });
        const incomeCatId = incomeCatResult.id;

        // Add income
        await fns.createTransaction(budgetId, {
            accountId,
            date: today(),
            payee: 'Employer',
            categoryId: incomeCatId,
            inflow: 5000,
        });

        // Seed complete month
        await seedCompleteMonth(fns, db, month, groupId, budgetId);

        // Assign budgets
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(1000));
        await fns.updateBudgetAssignment(budgetId, categoryIds[1], month, mu(500));

        // Create spending
        await fns.createTransaction(budgetId, {
            accountId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 200,
        });
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        const data = await fns.getBudgetInspectorData(budgetId, month);

        // Summary
        expect(data.summary).toHaveProperty('leftOverFromLastMonth');
        expect(data.summary).toHaveProperty('assignedThisMonth');
        expect(data.summary).toHaveProperty('activity');
        expect(data.summary).toHaveProperty('available');
        expect(data.summary.assignedThisMonth).toBe(1500);

        // Cost to Be Me
        expect(data.costToBeMe).toHaveProperty('targets');
        expect(data.costToBeMe).toHaveProperty('expectedIncome');
        expect(data.costToBeMe.targets).toBe(1500);

        // Auto-Assign
        expect(data.autoAssign).toHaveProperty('underfunded');
        expect(data.autoAssign).toHaveProperty('assignedLastMonth');
        expect(data.autoAssign).toHaveProperty('spentLastMonth');
        expect(data.autoAssign).toHaveProperty('averageAssigned');
        expect(data.autoAssign).toHaveProperty('averageSpent');
        expect(data.autoAssign).toHaveProperty('reduceOverfunding');
        expect(data.autoAssign).toHaveProperty('resetAvailableAmounts');
        expect(data.autoAssign).toHaveProperty('resetAssignedAmounts');

        // Future Assignments
        expect(data.futureAssignments).toHaveProperty('total');
        expect(data.futureAssignments).toHaveProperty('months');
        expect(Array.isArray(data.futureAssignments.months)).toBe(true);
    });

    it('reports future month assignments', async () => {
        const { groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();
        const future = nextMonth(month);

        // Seed complete months
        await seedCompleteMonth(fns, db, month, groupId, budgetId);

        // Assign in current and future
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));
        await fns.updateBudgetAssignment(budgetId, categoryIds[1], future, mu(300));

        const data = await fns.getBudgetInspectorData(budgetId, month);

        expect(data.futureAssignments.total).toBe(300);
        expect(data.futureAssignments.months).toHaveLength(1);
        expect(data.futureAssignments.months[0].month).toBe(future);
        expect(data.futureAssignments.months[0].amount).toBe(300);
    });

    it('computes underfunded totals', async () => {
        const { accountId, groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();

        // Seed complete month
        await seedCompleteMonth(fns, db, month, groupId, budgetId);

        // Create overspending by spending without enough budget
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(50));
        await fns.createTransaction(budgetId, {
            accountId,
            date: today(),
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 100,
        });
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        const data = await fns.getBudgetInspectorData(budgetId, month);
        expect(data.autoAssign.underfunded).toBeGreaterThan(0);
    });

    it('computes reduce overfunding', async () => {
        const { groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();
        const prev = prevMonth(month);

        // Create carryover: assign 500 in previous month with no spending
        await seedCompleteMonth(fns, db, prev, groupId, budgetId);
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], prev, mu(500));

        // In current month, assign 200 (but available carries forward 500 + 200 = 700)
        await seedCompleteMonth(fns, db, month, groupId, budgetId);
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(200));

        const data = await fns.getBudgetInspectorData(budgetId, month);

        // available(700) > assigned(200) and assigned > 0 and activity >= 0 → overfunding of 500
        expect(data.autoAssign.reduceOverfunding).toBe(500);
    });

    it('computes reset available amounts', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();

        // Create a budget_months row that has carried-over available but no new assignment or activity
        await db.insert(budgetMonths).values({
            budgetId,
            categoryId: categoryIds[0],
            month,
            assigned: ZERO,
            activity: ZERO,
            available: mu(300),
        });

        const data = await fns.getBudgetInspectorData(budgetId, month);
        // available(300) > 0 and assigned(0) == 0 and activity(0) == 0
        expect(data.autoAssign.resetAvailableAmounts).toBe(300);
    });

    it('reports assigned and spent from last month', async () => {
        const { accountId, groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();
        const prev = prevMonth(month);

        await seedCompleteMonth(fns, db, prev, groupId, budgetId);
        await seedCompleteMonth(fns, db, month, groupId, budgetId);

        // Assign and spend in previous month
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], prev, mu(400));
        await fns.createTransaction(budgetId, {
            accountId,
            date: `${prev}-15`,
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 150,
        });
        await fns.updateBudgetActivity(budgetId, categoryIds[0], prev);

        const data = await fns.getBudgetInspectorData(budgetId, month);
        expect(data.autoAssign.assignedLastMonth).toBe(400);
        expect(data.autoAssign.spentLastMonth).toBe(150);
    });

    it('handles categories with zero available and zero activity in summary', async () => {
        const { groupId } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();

        // Create an EMPTY category group (no categories) — produces a row
        // with category_id=null in getBudgetForMonth, hitting the false branch
        // of `if (row.categoryId !== null)` at line 569
        await fns.createCategoryGroup('Empty Group', budgetId);

        // Seed complete month — all categories will have available=0, activity=0
        await seedCompleteMonth(fns, db, month, groupId, budgetId);

        const data = await fns.getBudgetInspectorData(budgetId, month);

        // Summary should have 0 available and 0 activity
        // (the null category_id row is skipped in the totals)
        expect(data.summary.available).toBe(0);
        expect(data.summary.activity).toBe(0);
    });
});

// =====================================================================
// refreshAllBudgetActivity — ghost entry cleanup (L479)
// =====================================================================
describe('refreshAllBudgetActivity — ghost cleanup', () => {
    it('deletes ghost budget_months rows where assigned=0, activity=0, available=0', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();

        // Create a budget_months row that will become a ghost after refresh
        // (no transactions, no assignment → activity=0, available=0)
        await db.insert(budgetMonths).values({
            budgetId,
            categoryId: categoryIds[2],
            month,
            assigned: ZERO,
            activity: ZERO,
            available: ZERO,
        });

        // Verify the row exists before refresh
        const before = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[2]), eq(budgetMonths.month, month)));
        expect(before).toHaveLength(1);

        await fns.refreshAllBudgetActivity(budgetId, month);

        // Ghost row should be deleted
        const after = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[2]), eq(budgetMonths.month, month)));
        expect(after).toHaveLength(0);
    });
});

// =====================================================================
// ensureCreditCardPaymentCategory — nonexistent account (L527-528)
// =====================================================================
describe('ensureCreditCardPaymentCategory — edge cases', () => {
    it('returns undefined for nonexistent account', async () => {
        const result = await fns.ensureCreditCardPaymentCategory(999999, 'Ghost Card');
        expect(result).toBeUndefined();
    });
});
