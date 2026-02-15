
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, today, currentMonth, prevMonth, nextMonth, mu, ZERO } from './test-helpers';
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
        const { accountId, groupId: _groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
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
        const { groupId: _groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();
        const future = nextMonth(month);



        // Assign in current month
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(1000));

        // Assign in future month
        await fns.updateBudgetAssignment(budgetId, categoryIds[1], future, mu(500));

        const breakdown = await fns.getReadyToAssignBreakdown(budgetId, month);
        expect(breakdown.assignedInFuture).toBe(500);
    });

    it('reports cash overspending from previous month', async () => {
        const { accountId, groupId: _groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();
        const prev = prevMonth(month);



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
        const { accountId, groupId: _groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
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
        const { groupId: _groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();
        const future = nextMonth(month);



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
        const { accountId, groupId: _groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();



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
        const { groupId: _groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();
        const prev = prevMonth(month);

        // Create carryover: assign 500 in previous month with no spending
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], prev, mu(500));

        // In current month, assign 200 (but available carries forward 500 + 200 = 700)
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
        const { accountId, groupId: _groupId, categoryIds } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();
        const prev = prevMonth(month);

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
        const { groupId: _groupId } = await seedBasicBudget(fns, { accountBalance: 0, db });
        const month = currentMonth();



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

// =====================================================================
// Carryforward Propagation — Regression Tests
// Bug: activity changes in month M didn't propagate to pre-existing
// budget_months rows in subsequent months (M+1, M+2, …), leaving stale
// available values. E.g., CC overspending → Feb available = -49.9M,
// but March still showed 80K instead of 0.
// =====================================================================
describe('carryforward propagation to subsequent months', () => {

    it('propagates CC overspending reset to pre-existing next month row (refreshAllBudgetActivity)', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const next = nextMonth(month);

        // Create CC account
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');

        // Assign 80 to category in month M
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(80));

        // Pre-create a next month row (simulates YNAB import with stale carryforward)
        // This row carries the old available=80 from before the CC spending
        await db.insert(budgetMonths).values({
            budgetId,
            categoryId: categoryIds[0],
            month: next,
            assigned: ZERO,
            activity: ZERO,
            available: mu(80), // stale value — should become 0 after propagation
        });

        // CC overspend: spend 500 on CC with only 80 budgeted → available = 80 - 500 = -420
        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: `${month}-15`,
            payee: 'Big Purchase',
            categoryId: categoryIds[0],
            outflow: 500,
        });

        // Refresh month M — this should recalculate Feb available AND propagate to next month
        await fns.refreshAllBudgetActivity(budgetId, month);

        // Verify month M: available = 80 - 500 = -420 (credit overspending)
        const currentRows = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[0]), eq(budgetMonths.month, month)));
        expect(currentRows[0].available).toBe(-420);

        // CRITICAL: Next month should NOT have stale 80. Carryforward = max(0, -420) = 0.
        // Since assigned=0, activity=0, available=0 → ghost row should be deleted.
        const nextRows = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[0]), eq(budgetMonths.month, next)));
        expect(nextRows).toHaveLength(0); // ghost entry deleted
    });

    it('propagates CC overspending reset to pre-existing next month row (updateBudgetActivity)', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const next = nextMonth(month);

        // Create CC account
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;

        // Assign 80 to category in month M
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(80));

        // Pre-create next month row with stale carryforward
        await db.insert(budgetMonths).values({
            budgetId,
            categoryId: categoryIds[0],
            month: next,
            assigned: ZERO,
            activity: ZERO,
            available: mu(80),
        });

        // CC overspend
        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: `${month}-15`,
            payee: 'Big Purchase',
            categoryId: categoryIds[0],
            outflow: 500,
        });

        // Per-category update — should also propagate
        await fns.updateBudgetActivity(budgetId, categoryIds[0], month);

        // Next month row should be deleted (ghost: available=0, assigned=0, activity=0)
        const nextRows = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[0]), eq(budgetMonths.month, next)));
        expect(nextRows).toHaveLength(0);
    });

    it('propagates positive carryforward reduction through multi-month chain', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const month2 = nextMonth(month);
        const month3 = nextMonth(month2);

        // Assign 1000 in month M → available = 1000
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(1000));

        // Pre-create rows for M+1 and M+2 with stale carryforward of 1000
        await db.insert(budgetMonths).values([
            { budgetId, categoryId: categoryIds[0], month: month2, assigned: mu(200), activity: ZERO, available: mu(1200) },
            { budgetId, categoryId: categoryIds[0], month: month3, assigned: ZERO, activity: ZERO, available: mu(1200) },
        ]);

        // Cash spending of 800 in month M → available = 1000 - 800 = 200
        await fns.createTransaction(budgetId, {
            accountId,
            date: `${month}-15`,
            payee: 'Big Store',
            categoryId: categoryIds[0],
            outflow: 800,
        });

        await fns.refreshAllBudgetActivity(budgetId, month);

        // Month M: available = 1000 - 800 = 200
        const m1Rows = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[0]), eq(budgetMonths.month, month)));
        expect(m1Rows[0].available).toBe(200);

        // Month M+1: carryforward = 200, assigned = 200 → available = 400
        const m2Rows = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[0]), eq(budgetMonths.month, month2)));
        expect(m2Rows[0].available).toBe(400);

        // Month M+2: carryforward = 400, assigned = 0 → available = 400
        const m3Rows = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[0]), eq(budgetMonths.month, month3)));
        expect(m3Rows[0].available).toBe(400);
    });

    it('propagates cash overspending reset (max(0, negative)) to subsequent months', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const next = nextMonth(month);

        // Assign 50 in month M
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(50));

        // Pre-create next month row with assignment of 300 and stale available = 350
        // (350 = old carryforward(50) + assigned(300))
        await db.insert(budgetMonths).values({
            budgetId,
            categoryId: categoryIds[0],
            month: next,
            assigned: mu(300),
            activity: ZERO,
            available: mu(350), // stale: should be 300 after overspending reset
        });

        // Cash overspend: spend 100 with only 50 → available = -50
        await fns.createTransaction(budgetId, {
            accountId,
            date: `${month}-15`,
            payee: 'Too Expensive',
            categoryId: categoryIds[0],
            outflow: 100,
        });

        await fns.refreshAllBudgetActivity(budgetId, month);

        // Next month: carryforward = max(0, -50) = 0, assigned = 300 → available = 300
        const nextRows = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[0]), eq(budgetMonths.month, next)));
        expect(nextRows[0].available).toBe(300);
    });

    it('does not affect categories without changes', async () => {
        const { accountId, categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const next = nextMonth(month);

        // Assign to two categories
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));
        await fns.updateBudgetAssignment(budgetId, categoryIds[1], month, mu(200));

        // Pre-create next month rows
        await db.insert(budgetMonths).values([
            { budgetId, categoryId: categoryIds[0], month: next, assigned: ZERO, activity: ZERO, available: mu(500) },
            { budgetId, categoryId: categoryIds[1], month: next, assigned: ZERO, activity: ZERO, available: mu(200) },
        ]);

        // Only spend on category 0
        await fns.createTransaction(budgetId, {
            accountId,
            date: `${month}-15`,
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 100,
        });

        await fns.refreshAllBudgetActivity(budgetId, month);

        // Category 0: M available = 400, next = carryforward(400) = 400
        const cat0 = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[0]), eq(budgetMonths.month, next)));
        expect(cat0[0].available).toBe(400);

        // Category 1: unchanged — still 200
        const cat1 = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[1]), eq(budgetMonths.month, next)));
        expect(cat1[0].available).toBe(200);
    });

    it('propagates CC payment category available changes to subsequent months', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db });
        const month = currentMonth();
        const next = nextMonth(month);

        // Create CC account and payment category
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');
        const ccCat = (await fns.getCreditCardPaymentCategory(ccId))!;

        // Pre-create CC Payment category row for next month (simulates YNAB import)
        await db.insert(budgetMonths).values({
            budgetId,
            categoryId: ccCat.id,
            month: next,
            assigned: ZERO,
            activity: ZERO,
            available: ZERO, // stale — will need to carry forward Feb's value
        });

        // Budget 500 for a category, then spend 200 on CC → 200 funded spending moves to CC Payment
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));
        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: `${month}-15`,
            payee: 'CC Store',
            categoryId: categoryIds[0],
            outflow: 200,
        });

        // Refresh — this recalculates regular categories + CC payments + propagation
        await fns.refreshAllBudgetActivity(budgetId, month);

        // CC Payment in month M should now have activity=200 (funded spending)
        const ccCurrentRows = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, ccCat.id), eq(budgetMonths.month, month)));
        expect(ccCurrentRows[0].activity).toBe(200);
        expect(ccCurrentRows[0].available).toBe(200);

        // CRITICAL: CC Payment in next month should carry forward 200
        // (CC Payment categories carry forward everything including debt)
        const ccNextRows = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, ccCat.id), eq(budgetMonths.month, next)));
        expect(ccNextRows[0].available).toBe(200); // was 0 (stale), should carry forward 200
    });
});

// =====================================================================
// End-to-End Carryforward + RTA Regression Suite
// Verifies that the FULL pipeline (transaction → activity → propagation → RTA)
// produces correct results. These tests exercise the exact production bug:
// CC overspending + stale CC Payment → inflated RTA.
// =====================================================================
describe('E2E carryforward + RTA correctness', () => {

    it('RTA remains 0 after CC overspending resets category to 0 in next month', async () => {
        const { categoryIds, accountId, groupId: _groupId } = await seedBasicBudget(fns, {
            db,
            accountBalance: 0,
        });
        const month = currentMonth();
        const next = nextMonth(month);

        // Create income category and add real cash via transaction
        const incomeGroupResult = await db.insert(categoryGroups).values({
            name: 'Income', sortOrder: 99, isIncome: true, budgetId,
        }).returning({ id: categoryGroups.id });
        const incomeCatResult = await fns.createCategory({ name: 'Salary', category_group_id: incomeGroupResult[0].id });
        await fns.createTransaction(budgetId, {
            accountId, date: `${month}-01`, payee: 'Employer',
            categoryId: incomeCatResult.id, inflow: 1000,
        });

        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');

        // Assign all 1000 to a category
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(1000));

        // CC overspend: spend 5000 on CC with only 1000 budgeted
        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: `${month}-15`,
            payee: 'Big Purchase',
            categoryId: categoryIds[0],
            outflow: 5000,
        });
        await fns.refreshAllBudgetActivity(budgetId, month);



        // RTA in month M should be 0 (credit overspending correction)
        const rta2 = await fns.getReadyToAssign(budgetId, month);
        expect(rta2.rta).toBe(0);

        // RTA in next month: category CF=max(0,-4000)=0, CC Payment CF=1000
        // Total available = 0+1000=1000, cash=1000 → RTA=0
        const rta3 = await fns.getReadyToAssign(budgetId, next);
        expect(rta3.rta).toBe(0);
    });

    it('RTA remains 0 when pre-existing stale CC Payment rows are in next month', async () => {
        const { categoryIds, accountId, groupId: _groupId } = await seedBasicBudget(fns, {
            db,
            accountBalance: 0,
        });
        const month = currentMonth();
        const next = nextMonth(month);

        // Create income category and add real cash via transaction
        const incomeGroupResult = await db.insert(categoryGroups).values({
            name: 'Income', sortOrder: 99, isIncome: true, budgetId,
        }).returning({ id: categoryGroups.id });
        const incomeCatResult = await fns.createCategory({ name: 'Salary', category_group_id: incomeGroupResult[0].id });
        await fns.createTransaction(budgetId, {
            accountId, date: `${month}-01`, payee: 'Employer',
            categoryId: incomeCatResult.id, inflow: 500,
        });

        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');
        const ccCat = (await fns.getCreditCardPaymentCategory(ccId))!;

        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));

        // Pre-create STALE next month rows
        await db.insert(budgetMonths).values([
            { budgetId, categoryId: categoryIds[0], month: next, assigned: ZERO, activity: ZERO, available: mu(500) },
            { budgetId, categoryId: ccCat.id, month: next, assigned: ZERO, activity: ZERO, available: ZERO },
        ]);

        // CC overspend 2000 with only 500 budgeted
        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: `${month}-15`,
            payee: 'Expensive Item',
            categoryId: categoryIds[0],
            outflow: 2000,
        });
        await fns.refreshAllBudgetActivity(budgetId, month);



        // Category M: 500-2000 = -1500
        const catM = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[0]), eq(budgetMonths.month, month)));
        expect(catM[0].available).toBe(-1500);

        // CC Payment M: funded=500
        const ccM = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, ccCat.id), eq(budgetMonths.month, month)));
        expect(ccM[0].available).toBe(500);

        // Next month: category ghost deleted, CC Payment carries forward 500
        const catNext = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[0]), eq(budgetMonths.month, next)));
        expect(catNext).toHaveLength(0);

        const ccNext = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, ccCat.id), eq(budgetMonths.month, next)));
        expect(ccNext[0].available).toBe(500);

        // RTA should be 0 in both months
        const rtaCurrent = await fns.getReadyToAssign(budgetId, month);
        expect(rtaCurrent.rta).toBe(0);
        const rtaNext = await fns.getReadyToAssign(budgetId, next);
        expect(rtaNext.rta).toBe(0);
    });

    it('CC Payment carryforward accumulates correctly across months', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db, accountBalance: 500 });
        const month = currentMonth();
        const month2 = nextMonth(month);
        const month3 = nextMonth(month2);

        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');
        const ccCat = (await fns.getCreditCardPaymentCategory(ccId))!;

        // Assign 200 and spend 200 on CC (fully funded)
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(200));

        // Pre-create CC Payment rows with assigned (debt payoff)
        await db.insert(budgetMonths).values([
            { budgetId, categoryId: ccCat.id, month: month2, assigned: mu(100), activity: ZERO, available: ZERO },
            { budgetId, categoryId: ccCat.id, month: month3, assigned: mu(50), activity: ZERO, available: ZERO },
        ]);

        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: `${month}-15`,
            payee: 'Funded Purchase',
            categoryId: categoryIds[0],
            outflow: 200,
        });
        await fns.refreshAllBudgetActivity(budgetId, month);

        // Month M: funded=200
        const ccM = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, ccCat.id), eq(budgetMonths.month, month)));
        expect(ccM[0].available).toBe(200);

        // Month 2: CF=200 + assigned=100 → 300
        const ccM2 = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, ccCat.id), eq(budgetMonths.month, month2)));
        expect(ccM2[0].available).toBe(300);

        // Month 3: CF=300 + assigned=50 → 350
        const ccM3 = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, ccCat.id), eq(budgetMonths.month, month3)));
        expect(ccM3[0].available).toBe(350);
    });

    it('assignment change propagates through multi-month chain via updateBudgetAssignment', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db, accountBalance: 2000 });
        const month = currentMonth();
        const month2 = nextMonth(month);
        const month3 = nextMonth(month2);

        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(500));

        await db.insert(budgetMonths).values([
            { budgetId, categoryId: categoryIds[0], month: month2, assigned: mu(100), activity: ZERO, available: mu(600) },
            { budgetId, categoryId: categoryIds[0], month: month3, assigned: mu(50), activity: ZERO, available: mu(650) },
        ]);

        // Change assignment from 500→200
        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(200));

        const m1Rows = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[0]), eq(budgetMonths.month, month)));
        expect(m1Rows[0].available).toBe(200);

        const m2Rows = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[0]), eq(budgetMonths.month, month2)));
        expect(m2Rows[0].available).toBe(300); // CF=200 + 100

        const m3Rows = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[0]), eq(budgetMonths.month, month3)));
        expect(m3Rows[0].available).toBe(350); // CF=300 + 50
    });

    it('RTA consistent when multiple categories with cash spending have stale carryforward', async () => {
        const { categoryIds, accountId, groupId: _groupId } = await seedBasicBudget(fns, {
            db,
            accountBalance: 1000,
            categoryCount: 3,
        });
        const month = currentMonth();
        const next = nextMonth(month);



        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(400));
        await fns.updateBudgetAssignment(budgetId, categoryIds[1], month, mu(300));
        await fns.updateBudgetAssignment(budgetId, categoryIds[2], month, mu(300));

        await db.insert(budgetMonths).values([
            { budgetId, categoryId: categoryIds[0], month: next, assigned: ZERO, activity: ZERO, available: mu(400) },
            { budgetId, categoryId: categoryIds[1], month: next, assigned: ZERO, activity: ZERO, available: mu(300) },
            { budgetId, categoryId: categoryIds[2], month: next, assigned: ZERO, activity: ZERO, available: mu(300) },
        ]);

        await fns.createTransaction(budgetId, {
            accountId, date: `${month}-15`, payee: 'Store 1',
            categoryId: categoryIds[0], outflow: 150,
        });
        await fns.createTransaction(budgetId, {
            accountId, date: `${month}-15`, payee: 'Store 2',
            categoryId: categoryIds[1], outflow: 100,
        });

        await fns.refreshAllBudgetActivity(budgetId, month);

        // Carryforward propagated correctly to next month
        const cat0Next = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[0]), eq(budgetMonths.month, next)));
        expect(cat0Next[0].available).toBe(250);

        const cat1Next = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[1]), eq(budgetMonths.month, next)));
        expect(cat1Next[0].available).toBe(200);

        const cat2Next = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryIds[2]), eq(budgetMonths.month, next)));
        expect(cat2Next[0].available).toBe(300);

        // RTA should be consistent between months (propagation doesn't inflate/deflate)
        const rtaMonth = await fns.getReadyToAssign(budgetId, month);
        const rtaNext = await fns.getReadyToAssign(budgetId, next);
        expect(rtaMonth.rta).toBe(rtaNext.rta);
    });



    it('refreshAllBudgetActivity propagates CC Payment category changes to next month', async () => {
        const { categoryIds } = await seedBasicBudget(fns, { db, accountBalance: 800 });
        const month = currentMonth();
        const next = nextMonth(month);

        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit', budgetId });
        const ccId = ccResult.id;
        await fns.ensureCreditCardPaymentCategory(ccId, 'Visa');
        const ccCat = (await fns.getCreditCardPaymentCategory(ccId))!;

        await fns.updateBudgetAssignment(budgetId, categoryIds[0], month, mu(300));

        // Pre-create stale CC Payment next-month row
        await db.insert(budgetMonths).values({
            budgetId, categoryId: ccCat.id, month: next,
            assigned: ZERO, activity: ZERO, available: mu(50),
        });

        await fns.createTransaction(budgetId, {
            accountId: ccId,
            date: `${month}-15`,
            payee: 'Store',
            categoryId: categoryIds[0],
            outflow: 200,
        });

        await fns.refreshAllBudgetActivity(budgetId, month);

        // CC Payment M: funded=200
        const ccM = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, ccCat.id), eq(budgetMonths.month, month)));
        expect(ccM[0].available).toBe(200);

        // CC Payment next: CF=200 (was 50 stale) — MUST be updated
        const ccNext = await db.select().from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, ccCat.id), eq(budgetMonths.month, next)));
        expect(ccNext[0].available).toBe(200);
    });
});

