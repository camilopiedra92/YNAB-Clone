/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, currentMonth, nextMonth, today, mu, ZERO } from './test-helpers';
import type { createDbFunctions } from '../repos';
import type { DrizzleDB } from '../repos/client';
import { budgetMonths, categories } from '../db/schema';
import { eq, and } from 'drizzle-orm';

let db: DrizzleDB;
let fns: ReturnType<typeof createDbFunctions>;

beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db;
    fns = testDb.fns;
});

describe('Credit Card Payment Budget', () => {
    /**
     * Helper: set up a CC account + checking account + CC Payment category
     * Returns { checkingId, ccAccountId, ccCategoryId, groupId, categoryIds }
     */
    async function setupCCScenario() {
        // Checking account
        const checkResult = await fns.createAccount({ name: 'Checking', type: 'checking' });
        const checkingId = checkResult.id;

        // Credit card account
        const ccResult = await fns.createAccount({ name: 'Visa', type: 'credit' });
        const ccAccountId = ccResult.id;

        // Create CC Payment category
        const ccCategory = (await fns.ensureCreditCardPaymentCategory(ccAccountId, 'Visa'))!;

        // Create spending categories
        const groupResult = await fns.createCategoryGroup('Spending');
        const groupId = groupResult.id;

        const cat1Result = await fns.createCategory({ name: 'Groceries', category_group_id: groupId });
        const cat2Result = await fns.createCategory({ name: 'Dining', category_group_id: groupId });

        return {
            checkingId,
            ccAccountId,
            ccCategoryId: ccCategory.id,
            groupId,
            categoryIds: [cat1Result.id, cat2Result.id],
        };
    }

    it('fully funded spending moves full amount to CC Payment', async () => {
        const { ccAccountId, categoryIds } = await setupCCScenario();
        const month = currentMonth();

        // Budget $200 for Groceries
        await fns.updateBudgetAssignment(categoryIds[0], month, mu(200));

        // Spend $150 on CC (fully funded: 150 <= 200)
        await fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId: categoryIds[0],
            outflow: mu(150),
        });

        // Update activity for the spending category first (to set available correctly)
        await fns.updateBudgetActivity(categoryIds[0], month);
        // Then update CC Payment
        await fns.updateCreditCardPaymentBudget(ccAccountId, month);

        // Query CC Payment budget row via Drizzle
        const ccPaymentRows = await db.select()
            .from(budgetMonths)
            .innerJoin(categories, eq(budgetMonths.categoryId, categories.id))
            .where(and(
                eq(categories.linkedAccountId, ccAccountId),
                eq(budgetMonths.month, month)
            ));

        const ccPaymentRow: any = ccPaymentRows[0]?.budget_months;

        // CC Payment should show the full $150 funded amount as activity
        expect(ccPaymentRow).toBeDefined();
        expect(ccPaymentRow.activity).toBe(150);
        expect(ccPaymentRow.available).toBe(150);
    });

    it('partially funded spending only moves funded portion', async () => {
        const { ccAccountId, categoryIds } = await setupCCScenario();
        const month = currentMonth();

        // Budget only $80 for Groceries
        await fns.updateBudgetAssignment(categoryIds[0], month, mu(80));

        // Spend $100 on CC (partially funded: only $80 budgeted)
        await fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId: categoryIds[0],
            outflow: mu(100),
        });

        await fns.updateBudgetActivity(categoryIds[0], month);
        await fns.updateCreditCardPaymentBudget(ccAccountId, month);

        // Query CC Payment budget row via Drizzle
        const ccPaymentRows = await db.select()
            .from(budgetMonths)
            .innerJoin(categories, eq(budgetMonths.categoryId, categories.id))
            .where(and(
                eq(categories.linkedAccountId, ccAccountId),
                eq(budgetMonths.month, month)
            ));

        const ccPaymentRow: any = ccPaymentRows[0]?.budget_months;

        // Only the funded portion ($80) should move to CC Payment
        expect(ccPaymentRow.activity).toBe(80);
        expect(ccPaymentRow.available).toBe(80);

        // The spending category should show -$20 (credit overspending)
        const spendingRows = await db.select()
            .from(budgetMonths)
            .where(and(
                eq(budgetMonths.categoryId, categoryIds[0]),
                eq(budgetMonths.month, month)
            ));
        const spendingRow: any = spendingRows[0];
        expect(spendingRow.available).toBe(-20); // 80 assigned - 100 spent = -20
    });

    it('refund on CC reduces CC Payment available', async () => {
        const { ccAccountId, categoryIds } = await setupCCScenario();
        const month = currentMonth();

        // Budget and spend
        await fns.updateBudgetAssignment(categoryIds[0], month, mu(200));

        await fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId: categoryIds[0],
            outflow: mu(100),
        });

        // Now a refund
        await fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId: categoryIds[0],
            inflow: mu(30),
        });

        await fns.updateBudgetActivity(categoryIds[0], month);
        await fns.updateCreditCardPaymentBudget(ccAccountId, month);

        const ccPaymentRows = await db.select()
            .from(budgetMonths)
            .innerJoin(categories, eq(budgetMonths.categoryId, categories.id))
            .where(and(
                eq(categories.linkedAccountId, ccAccountId),
                eq(budgetMonths.month, month)
            ));

        const ccPaymentRow: any = ccPaymentRows[0]?.budget_months;

        // Net spending = 100 - 30 = 70, fully funded (200 > 70)
        expect(ccPaymentRow.activity).toBe(70);
        expect(ccPaymentRow.available).toBe(70);
    });

    it('CC payments (transfers) reduce CC Payment available', async () => {
        const { checkingId, ccAccountId, categoryIds } = await setupCCScenario();
        const month = currentMonth();

        // Budget and spend on CC
        await fns.updateBudgetAssignment(categoryIds[0], month, mu(500));

        await fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId: categoryIds[0],
            outflow: mu(300),
        });

        // Make a CC payment (transfer: checking → CC, appears as inflow with no category)
        await fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            inflow: mu(300),
            // category_id is NULL for payments
        });

        await fns.updateBudgetActivity(categoryIds[0], month);
        await fns.updateCreditCardPaymentBudget(ccAccountId, month);

        const ccPaymentRows = await db.select()
            .from(budgetMonths)
            .innerJoin(categories, eq(budgetMonths.categoryId, categories.id))
            .where(and(
                eq(categories.linkedAccountId, ccAccountId),
                eq(budgetMonths.month, month)
            ));

        // When activity = funded(300) - payment(300) = 0, no row is created (ghost entry prevention)
        expect(ccPaymentRows).toHaveLength(0);
    });

    it('does NOT create ghost entry when no CC activity', async () => {
        const { ccAccountId } = await setupCCScenario();
        const month = currentMonth();

        // No transactions on CC this month
        await fns.updateCreditCardPaymentBudget(ccAccountId, month);

        const ccPaymentRows = await db.select()
            .from(budgetMonths)
            .innerJoin(categories, eq(budgetMonths.categoryId, categories.id))
            .where(and(
                eq(categories.linkedAccountId, ccAccountId),
                eq(budgetMonths.month, month)
            ));

        expect(ccPaymentRows).toHaveLength(0);
    });

    it('CC Payment carryforward: debt carries across months', async () => {
        const { ccAccountId, ccCategoryId } = await setupCCScenario();
        const month = currentMonth();
        const next = nextMonth(month);

        // Create CC debt in current month
        await db.insert(budgetMonths).values({
            categoryId: ccCategoryId,
            month,
            assigned: ZERO,
            activity: mu(-500),
            available: mu(-500),
        });

        // CC Payment should carry forward debt
        const carryforward = await fns.computeCarryforward(ccCategoryId, next);
        expect(carryforward).toBe(-500);
    });

    it('ensureCreditCardPaymentCategory creates category and group if needed', async () => {
        const ccResult = await fns.createAccount({ name: 'Amex', type: 'credit' });
        const ccAccountId = ccResult.id;

        const category = (await fns.ensureCreditCardPaymentCategory(ccAccountId, 'Amex'))!;

        expect(category).toBeDefined();
        expect(category.name).toBe('Amex');
        expect(category.linkedAccountId).toBe(ccAccountId);

        // Verify group was created
        const groups = await fns.getCategoryGroups();
        const ccGroup = groups.find((g: any) => g.name === 'Credit Card Payments');
        expect(ccGroup).toBeDefined();
    });

    it('ensureCreditCardPaymentCategory returns existing category on second call', async () => {
        const ccResult = await fns.createAccount({ name: 'Amex', type: 'credit' });
        const ccAccountId = ccResult.id;

        const cat1 = (await fns.ensureCreditCardPaymentCategory(ccAccountId, 'Amex'))!;
        const cat2 = (await fns.ensureCreditCardPaymentCategory(ccAccountId, 'Amex'))!;

        expect(cat1.id).toBe(cat2.id);
    });
});
