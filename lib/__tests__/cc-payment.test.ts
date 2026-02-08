import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, currentMonth, nextMonth, today } from './test-helpers';
import type { createDbFunctions } from '../db';
import Database from 'better-sqlite3';

let db: Database.Database;
let fns: ReturnType<typeof createDbFunctions>;

beforeEach(() => {
    const testDb = createTestDb();
    db = testDb.db;
    fns = testDb.fns;
});

describe('Credit Card Payment Budget', () => {
    /**
     * Helper: set up a CC account + checking account + CC Payment category
     * Returns { checkingId, ccAccountId, ccCategoryId, groupId, categoryIds }
     */
    function setupCCScenario() {
        // Checking account
        const checkResult = fns.createAccount({ name: 'Checking', type: 'checking' });
        const checkingId = Number(checkResult.lastInsertRowid);

        // Credit card account
        const ccResult = fns.createAccount({ name: 'Visa', type: 'credit' });
        const ccAccountId = Number(ccResult.lastInsertRowid);

        // Create CC Payment category
        const ccCategory = fns.ensureCreditCardPaymentCategory(ccAccountId, 'Visa');

        // Create spending categories
        const groupResult = fns.createCategoryGroup('Spending');
        const groupId = Number(groupResult.lastInsertRowid);

        const cat1Result = fns.createCategory({ name: 'Groceries', category_group_id: groupId });
        const cat2Result = fns.createCategory({ name: 'Dining', category_group_id: groupId });

        return {
            checkingId,
            ccAccountId,
            ccCategoryId: ccCategory.id,
            groupId,
            categoryIds: [Number(cat1Result.lastInsertRowid), Number(cat2Result.lastInsertRowid)],
        };
    }

    it('fully funded spending moves full amount to CC Payment', () => {
        const { ccAccountId, categoryIds } = setupCCScenario();
        const month = currentMonth();

        // Budget $200 for Groceries
        fns.updateBudgetAssignment(categoryIds[0], month, 200);

        // Spend $150 on CC (fully funded: 150 <= 200)
        fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId: categoryIds[0],
            outflow: 150,
        });

        // Update activity for the spending category first (to set available correctly)
        fns.updateBudgetActivity(categoryIds[0], month);
        // Then update CC Payment
        fns.updateCreditCardPaymentBudget(ccAccountId, month);

        const ccPaymentRow: any = db.prepare(`
      SELECT * FROM budget_months bm
      JOIN categories c ON bm.category_id = c.id
      WHERE c.linked_account_id = ? AND bm.month = ?
    `).get(ccAccountId, month);

        // CC Payment should show the full $150 funded amount as activity
        expect(ccPaymentRow).toBeDefined();
        expect(ccPaymentRow.activity).toBe(150);
        expect(ccPaymentRow.available).toBe(150);
    });

    it('partially funded spending only moves funded portion', () => {
        const { ccAccountId, categoryIds } = setupCCScenario();
        const month = currentMonth();

        // Budget only $80 for Groceries
        fns.updateBudgetAssignment(categoryIds[0], month, 80);

        // Spend $100 on CC (partially funded: only $80 budgeted)
        fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId: categoryIds[0],
            outflow: 100,
        });

        fns.updateBudgetActivity(categoryIds[0], month);
        fns.updateCreditCardPaymentBudget(ccAccountId, month);

        const ccPaymentRow: any = db.prepare(`
      SELECT * FROM budget_months bm
      JOIN categories c ON bm.category_id = c.id
      WHERE c.linked_account_id = ? AND bm.month = ?
    `).get(ccAccountId, month);

        // Only the funded portion ($80) should move to CC Payment
        expect(ccPaymentRow.activity).toBe(80);
        expect(ccPaymentRow.available).toBe(80);

        // The spending category should show -$20 (credit overspending)
        const spendingRow: any = db.prepare(
            'SELECT * FROM budget_months WHERE category_id = ? AND month = ?'
        ).get(categoryIds[0], month);
        expect(spendingRow.available).toBe(-20); // 80 assigned - 100 spent = -20
    });

    it('refund on CC reduces CC Payment available', () => {
        const { ccAccountId, categoryIds } = setupCCScenario();
        const month = currentMonth();

        // Budget and spend
        fns.updateBudgetAssignment(categoryIds[0], month, 200);

        fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId: categoryIds[0],
            outflow: 100,
        });

        // Now a refund
        fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId: categoryIds[0],
            inflow: 30,
        });

        fns.updateBudgetActivity(categoryIds[0], month);
        fns.updateCreditCardPaymentBudget(ccAccountId, month);

        const ccPaymentRow: any = db.prepare(`
      SELECT * FROM budget_months bm
      JOIN categories c ON bm.category_id = c.id
      WHERE c.linked_account_id = ? AND bm.month = ?
    `).get(ccAccountId, month);

        // Net spending = 100 - 30 = 70, fully funded (200 > 70)
        expect(ccPaymentRow.activity).toBe(70);
        expect(ccPaymentRow.available).toBe(70);
    });

    it('CC payments (transfers) reduce CC Payment available', () => {
        const { checkingId, ccAccountId, categoryIds } = setupCCScenario();
        const month = currentMonth();

        // Budget and spend on CC
        fns.updateBudgetAssignment(categoryIds[0], month, 500);

        fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            categoryId: categoryIds[0],
            outflow: 300,
        });

        // Make a CC payment (transfer: checking → CC, appears as inflow with no category)
        fns.createTransaction({
            accountId: ccAccountId,
            date: today(),
            inflow: 300,
            // category_id is NULL for payments
        });

        fns.updateBudgetActivity(categoryIds[0], month);
        fns.updateCreditCardPaymentBudget(ccAccountId, month);

        const ccPaymentRow = db.prepare(`
      SELECT * FROM budget_months bm
      JOIN categories c ON bm.category_id = c.id
      WHERE c.linked_account_id = ? AND bm.month = ?
    `).get(ccAccountId, month);

        // When activity = funded(300) - payment(300) = 0, no row is created (ghost entry prevention)
        expect(ccPaymentRow).toBeUndefined();
    });

    it('does NOT create ghost entry when no CC activity', () => {
        const { ccAccountId } = setupCCScenario();
        const month = currentMonth();

        // No transactions on CC this month
        fns.updateCreditCardPaymentBudget(ccAccountId, month);

        const ccPaymentRow = db.prepare(`
      SELECT * FROM budget_months bm
      JOIN categories c ON bm.category_id = c.id
      WHERE c.linked_account_id = ? AND bm.month = ?
    `).get(ccAccountId, month);

        expect(ccPaymentRow).toBeUndefined();
    });

    it('CC Payment carryforward: debt carries across months', () => {
        const { ccAccountId, ccCategoryId, categoryIds } = setupCCScenario();
        const month = currentMonth();
        const next = nextMonth(month);

        // Create CC debt in current month
        db.prepare(`
      INSERT INTO budget_months (category_id, month, assigned, activity, available)
      VALUES (?, ?, 0, -500, -500)
    `).run(ccCategoryId, month);

        // CC Payment should carry forward debt
        const carryforward = fns.computeCarryforward(ccCategoryId, next);
        expect(carryforward).toBe(-500);
    });

    it('ensureCreditCardPaymentCategory creates category and group if needed', () => {
        const ccResult = fns.createAccount({ name: 'Amex', type: 'credit' });
        const ccAccountId = Number(ccResult.lastInsertRowid);

        const category = fns.ensureCreditCardPaymentCategory(ccAccountId, 'Amex');

        expect(category).toBeDefined();
        expect(category.name).toBe('Amex');
        expect(category.linked_account_id).toBe(ccAccountId);

        // Verify group was created
        const groups = fns.getCategoryGroups() as any[];
        const ccGroup = groups.find((g: any) => g.name === 'Credit Card Payments');
        expect(ccGroup).toBeDefined();
    });

    it('ensureCreditCardPaymentCategory returns existing category on second call', () => {
        const ccResult = fns.createAccount({ name: 'Amex', type: 'credit' });
        const ccAccountId = Number(ccResult.lastInsertRowid);

        const cat1 = fns.ensureCreditCardPaymentCategory(ccAccountId, 'Amex');
        const cat2 = fns.ensureCreditCardPaymentCategory(ccAccountId, 'Amex');

        expect(cat1.id).toBe(cat2.id);
    });
});
