/**
 * Budget CC Repository — Credit card payments, overspending detection.
 *
 * Extracted from budget.ts for domain cohesion.
 * Pure orchestration: queries → engine → writes.
 *
 * Cross-repo dependencies are injected via `deps`:
 * - `createCategory` from categories repo (for ensureCreditCardPaymentCategory)
 */
import { eq, and, sql, max, type InferSelectModel } from 'drizzle-orm';
import { accounts, categories, categoryGroups, budgetMonths, transactions } from '../db/schema';
import { yearMonth, notFutureDate } from '../db/sql-helpers';
import type { DrizzleDB } from '../db/helpers';
import { queryRows } from '../db/helpers';
import * as Sentry from '@sentry/nextjs';
import {
  calculateCCPaymentAvailable,
  calculateCashOverspending,
  classifyOverspending,
  maxMilliunits,
  ZERO,
  type Milliunit,
} from '../engine';

/** Cast a DB value to Milliunit (values are already integers from BIGINT columns). */
const m = (v: unknown): Milliunit => (Number(v) || 0) as Milliunit;

export interface BudgetCCDeps {
  createCategory: (category: { name: string; category_group_id: number; linked_account_id?: number }) => Promise<{ id: number }> | { id: number };
}

export function createBudgetCCFunctions(
  database: DrizzleDB,
  deps: BudgetCCDeps,
) {

  // ====== Credit Card Payment Functions ======

  async function getCreditCardPaymentCategory(accountId: number): Promise<InferSelectModel<typeof categories> | undefined> {
    const rows = await database.select().from(categories)
      .where(eq(categories.linkedAccountId, accountId));
    return rows[0];
  }

  async function ensureCreditCardPaymentCategory(accountId: number, accountName: string): Promise<InferSelectModel<typeof categories> | undefined> {
    const category = await getCreditCardPaymentCategory(accountId);
    if (category) return category;

    // Get budgetId from account
    const accRows = await database.select({ budgetId: accounts.budgetId })
      .from(accounts)
      .where(eq(accounts.id, accountId));
    const budgetId = accRows[0]?.budgetId;
    if (!budgetId) {
      console.error(`ensureCreditCardPaymentCategory: account ${accountId} not found or has no budgetId`);
      return undefined;
    }

    // Check/create CC group BEFORE deps call to avoid PGlite deadlock
    const ccGroupRows = await database.select({ id: categoryGroups.id })
      .from(categoryGroups)
      .where(and(
        eq(categoryGroups.name, 'Credit Card Payments'),
        eq(categoryGroups.budgetId, budgetId)
      ));
    let ccGroup = ccGroupRows[0];

    if (!ccGroup) {
      const maxOrderResult = await database.select({ maxOrder: max(categoryGroups.sortOrder) })
        .from(categoryGroups)
        .where(eq(categoryGroups.budgetId, budgetId));
      const newOrder = (maxOrderResult[0]?.maxOrder ?? 0) + 1;
      const ccGroupResult = await database.insert(categoryGroups)
        .values({ 
          name: 'Credit Card Payments', 
          sortOrder: newOrder, 
          hidden: false, 
          isIncome: false,
          budgetId,
        })
        .returning({ id: categoryGroups.id });
      ccGroup = { id: ccGroupResult[0].id };
    }

    const result = await deps.createCategory({
      name: accountName,
      category_group_id: ccGroup.id,
      linked_account_id: accountId,
    });

    const rows = await database.select().from(categories)
      .where(eq(categories.id, result.id));
    return rows[0];
  }

  async function updateCreditCardPaymentBudget(budgetId: number, accountId: number, month: string) {
    return Sentry.startSpan({ op: 'db.query', name: 'updateCreditCardPaymentBudget', attributes: { budgetId, accountId, month } }, async () => {
    const ccCategory = await getCreditCardPaymentCategory(accountId);
    if (!ccCategory) return;

    // ── Query phase ──

    // 1. Per-category spending on this CC
    const categorySpending = await queryRows<{
      categoryId: number;
      catOutflow: number;
      catInflow: number;
    }>(database, sql`
      SELECT 
        ${transactions.categoryId} as "categoryId",
        COALESCE(SUM(${transactions.outflow}), 0) as "catOutflow",
        COALESCE(SUM(${transactions.inflow}), 0) as "catInflow"
      FROM ${transactions}
      JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
      WHERE ${transactions.accountId} = ${accountId}
        AND ${yearMonth(transactions.date)} = ${month}
        AND ${notFutureDate(transactions.date)}
        AND ${transactions.categoryId} IS NOT NULL
        AND ${transactions.categoryId} != ${ccCategory.id}
        AND ${accounts.budgetId} = ${budgetId}
      GROUP BY ${transactions.categoryId}
    `);

    // 2. Get current available for each affected category
    const categoryAvailables = new Map<number, Milliunit>();
    for (const catSpend of categorySpending) {
      const catBudgetRows = await database.select({ available: budgetMonths.available })
        .from(budgetMonths)
        .innerJoin(categories, eq(budgetMonths.categoryId, categories.id))
        .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
        .where(and(
          eq(budgetMonths.categoryId, catSpend.categoryId),
          eq(budgetMonths.month, month),
          eq(categoryGroups.budgetId, budgetId)
        ));
      categoryAvailables.set(catSpend.categoryId, m(catBudgetRows[0]?.available));
    }

    // 3. CC payments (transfers to this CC)
    const paymentRows = await queryRows<{ totalPayments: number }>(database, sql`
      SELECT COALESCE(SUM(${transactions.inflow}), 0) as "totalPayments"
      FROM ${transactions}
      JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
      WHERE ${transactions.accountId} = ${accountId}
        AND ${yearMonth(transactions.date)} = ${month}
        AND ${notFutureDate(transactions.date)}
        AND ${transactions.categoryId} IS NULL
        AND ${transactions.inflow} > 0
        AND ${accounts.budgetId} = ${budgetId}
    `);

    // 4. Previous month carryforward
    const [yr, mo] = month.split('-').map(Number);
    const prevDate = new Date(yr, mo - 2);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const prevCCBudgetRows = await database.select({ available: budgetMonths.available })
      .from(budgetMonths)
      .where(and(eq(budgetMonths.categoryId, ccCategory.id), eq(budgetMonths.month, prevMonthStr)));

    // 5. Current assigned
    const existingRows = await database.select({ assigned: budgetMonths.assigned })
      .from(budgetMonths)
      .where(and(eq(budgetMonths.categoryId, ccCategory.id), eq(budgetMonths.month, month)));
    const existing = existingRows[0];

    // ── Compute phase: delegate to engine ──
    const ccResult = calculateCCPaymentAvailable({
      spending: categorySpending.map((cs: { categoryId: number; catOutflow: number; catInflow: number }) => ({
        categoryId: cs.categoryId,
        outflow: m(cs.catOutflow),
        inflow: m(cs.catInflow),
      })),
      categoryAvailables,
      carryforward: m(prevCCBudgetRows[0]?.available),
      assigned: m(existing?.assigned),
      payments: m(paymentRows[0]!.totalPayments),
    });

    // ── Write phase ──
    if (existing) {
      await database.update(budgetMonths)
        .set({ activity: ccResult.activity, available: ccResult.available })
        .where(and(eq(budgetMonths.categoryId, ccCategory.id), eq(budgetMonths.month, month)));
    } else if (ccResult.activity !== 0) {
      await database.insert(budgetMonths)
        .values({
          budgetId,
          categoryId: ccCategory.id,
          month,
          assigned: ZERO,
          activity: ccResult.activity,
          available: (m(prevCCBudgetRows[0]?.available) + ccResult.activity) as Milliunit,
        });
    }
    }); // end Sentry span
  }

  // ====== Overspending Detection Functions ======

  async function getCashOverspendingForMonth(budgetId: number, month: string): Promise<Milliunit> {
    // ── Query phase ──
    const overspentCategories = await queryRows<{
      categoryId: number;
      available: number;
    }>(database, sql`
      SELECT ${budgetMonths.categoryId} as "categoryId", ${budgetMonths.available} as "available"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false
        AND ${categories.linkedAccountId} IS NULL
        AND ${budgetMonths.available} < 0
        AND ${budgetMonths.month} = ${month}
        AND ${categoryGroups.budgetId} = ${budgetId}
    `);

    // Query cash spending for each overspent category
    const inputs = [];
    for (const cat of overspentCategories) {
      const cashActivityRows = await queryRows<{ total: number }>(database, sql`
        SELECT COALESCE(SUM(${transactions.outflow} - ${transactions.inflow}), 0) as "total"
        FROM ${transactions}
        JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
        WHERE ${transactions.categoryId} = ${cat.categoryId} 
          AND ${yearMonth(transactions.date)} = ${month} 
          AND ${accounts.type} != 'credit'
          AND ${accounts.budgetId} = ${budgetId}
          AND ${notFutureDate(transactions.date)}
      `);

      inputs.push({
        categoryId: cat.categoryId,
        available: m(cat.available),
        linkedAccountId: null as number | null,
        cashSpending: Math.max(0, m(cashActivityRows[0]!.total)) as Milliunit,
      });
    }

    // ── Compute phase: delegate to engine ──
    return calculateCashOverspending(inputs);
  }

  async function getOverspendingTypes(budgetId: number, month: string): Promise<Record<number, 'cash' | 'credit' | null>> {
    const result: Record<number, 'cash' | 'credit' | null> = {};

    // ── Query phase ──
    const overspentCategories = await queryRows<{
      categoryId: number;
      available: number;
      linkedAccountId: number | null;
    }>(database, sql`
      SELECT ${budgetMonths.categoryId} as "categoryId", 
             ${budgetMonths.available} as "available", 
             ${categories.linkedAccountId} as "linkedAccountId"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false
        AND ${budgetMonths.available} < 0
        AND ${budgetMonths.month} = ${month}
        AND ${categoryGroups.budgetId} = ${budgetId}
    `);

    for (const cat of overspentCategories) {
      let cashSpending: Milliunit = ZERO;
      if (!cat.linkedAccountId) {
        const cashActivityRows = await queryRows<{ total: number }>(database, sql`
          SELECT COALESCE(SUM(${transactions.outflow} - ${transactions.inflow}), 0) as "total"
          FROM ${transactions}
          JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
          WHERE ${transactions.categoryId} = ${cat.categoryId} 
            AND ${yearMonth(transactions.date)} = ${month} 
            AND ${accounts.type} != 'credit'
            AND ${accounts.budgetId} = ${budgetId}
            AND ${notFutureDate(transactions.date)}
        `);
        const raw = m(cashActivityRows[0]!.total);
        cashSpending = maxMilliunits(ZERO, raw);
      }

      // ── Compute phase: delegate to engine ──
      const type = classifyOverspending({
        categoryId: cat.categoryId,
        available: m(cat.available),
        linkedAccountId: cat.linkedAccountId,
        cashSpending,
      });

      result[cat.categoryId] = type;
    }

    return result;
  }

  return {
    getCreditCardPaymentCategory,
    ensureCreditCardPaymentCategory,
    updateCreditCardPaymentBudget,
    getCashOverspendingForMonth,
    getOverspendingTypes,
  };
}
