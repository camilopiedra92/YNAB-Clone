/**
 * Budget CC Repository — Credit card payments, overspending detection.
 *
 * Extracted from budget.ts for domain cohesion.
 * Pure orchestration: queries → engine → writes.
 *
 * Cross-repo dependencies are injected via `deps`:
 * - `createCategory` from categories repo (for ensureCreditCardPaymentCategory)
 */
import { eq, and, sql, max, inArray, type InferSelectModel } from 'drizzle-orm';
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

    // Previous month string (needed by carryforward query)
    const [yr, mo] = month.split('-').map(Number);
    const prevDate = new Date(yr, mo - 2);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    // ── Query phase: Round 1 — 4 independent queries in parallel ──
    const [categorySpending, paymentRows, prevCCBudgetRows, existingRows] = await Promise.all([
      // 1. Per-category spending on this CC
      queryRows<{
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
      `),
      // 2. CC payments (transfers to this CC)
      queryRows<{ totalPayments: number }>(database, sql`
        SELECT COALESCE(SUM(${transactions.inflow}), 0) as "totalPayments"
        FROM ${transactions}
        JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
        WHERE ${transactions.accountId} = ${accountId}
          AND ${yearMonth(transactions.date)} = ${month}
          AND ${notFutureDate(transactions.date)}
          AND ${transactions.categoryId} IS NULL
          AND ${transactions.inflow} > 0
          AND ${accounts.budgetId} = ${budgetId}
      `),
      // 3. Previous month carryforward
      database.select({ available: budgetMonths.available })
        .from(budgetMonths)
        .where(and(eq(budgetMonths.categoryId, ccCategory.id), eq(budgetMonths.month, prevMonthStr))),
      // 4. Current assigned
      database.select({ assigned: budgetMonths.assigned })
        .from(budgetMonths)
        .where(and(eq(budgetMonths.categoryId, ccCategory.id), eq(budgetMonths.month, month))),
    ]);

    const existing = existingRows[0];

    // ── Query phase: Round 2 — dependent on spending results ──
    // Batch: get current available for ALL affected categories in one query
    const categoryAvailables = new Map<number, Milliunit>();
    const affectedCatIds = categorySpending.map(cs => cs.categoryId);
    if (affectedCatIds.length > 0) {
      const availRows = await database.select({
        categoryId: budgetMonths.categoryId,
        available: budgetMonths.available,
      })
        .from(budgetMonths)
        .innerJoin(categories, eq(budgetMonths.categoryId, categories.id))
        .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
        .where(and(
          inArray(budgetMonths.categoryId, affectedCatIds),
          eq(budgetMonths.month, month),
          eq(categoryGroups.budgetId, budgetId),
        ));
      for (const row of availRows) categoryAvailables.set(row.categoryId, m(row.available));
    }

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

  /**
   * Batch: update ALL CC payment categories for a budget in 4 queries total.
   * Replaces the N-CC-account × 5-queries-each loop (5N → 4 queries).
   *
   * Query 1: All CC payment categories (linked_account_id IS NOT NULL)
   * Query 2: All CC spending grouped by (account_id, category_id)
   * Query 3: All CC payments (transfers) grouped by account_id
   * Query 4: Carryforward + assigned for ALL CC payment category IDs
   *
   * Then iterates per-account in-memory using existing engine functions
   * and bulk-writes via INSERT ... ON CONFLICT DO UPDATE.
   */
  async function batchUpdateAllCCPayments(budgetId: number, month: string) {
    return Sentry.startSpan({ op: 'db.query', name: 'batchUpdateAllCCPayments', attributes: { budgetId, month } }, async () => {
    // Previous month for carryforward
    const [yr, mo] = month.split('-').map(Number);
    const prevDate = new Date(yr, mo - 2);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    // ── Q1: All CC payment categories with their linked account IDs ──
    const ccCategories = await queryRows<{
      categoryId: number;
      linkedAccountId: number;
    }>(database, sql`
      SELECT ${categories.id} AS "categoryId", ${categories.linkedAccountId} AS "linkedAccountId"
      FROM ${categories}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.budgetId} = ${budgetId}
        AND ${categories.linkedAccountId} IS NOT NULL
    `);

    if (ccCategories.length === 0) return;

    // Build lookup maps: accountId → categoryId, categoryId → accountId
    const accountToCcCategory = new Map<number, number>();
    const ccCategoryToAccount = new Map<number, number>();
    const allCcCategoryIds: number[] = [];
    for (const cc of ccCategories) {
      accountToCcCategory.set(cc.linkedAccountId, cc.categoryId);
      ccCategoryToAccount.set(cc.categoryId, cc.linkedAccountId);
      allCcCategoryIds.push(cc.categoryId);
    }

    // Get all CC account IDs
    const ccAccountIds = ccCategories.map(cc => cc.linkedAccountId);

    // ── Q2, Q3, Q4 run in parallel — they're independent ──
    const [allSpending, allPayments, allBudgetData] = await Promise.all([
      // Q2: All CC spending grouped by (account_id, category_id), excluding CC payment categories
      queryRows<{
        accountId: number;
        categoryId: number;
        catOutflow: number;
        catInflow: number;
      }>(database, sql`
        SELECT 
          ${transactions.accountId} AS "accountId",
          ${transactions.categoryId} AS "categoryId",
          COALESCE(SUM(${transactions.outflow}), 0) AS "catOutflow",
          COALESCE(SUM(${transactions.inflow}), 0) AS "catInflow"
        FROM ${transactions}
        JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
        WHERE ${transactions.accountId} IN (${sql.join(ccAccountIds.map(id => sql`${id}`), sql`, `)})
          AND ${yearMonth(transactions.date)} = ${month}
          AND ${notFutureDate(transactions.date)}
          AND ${transactions.categoryId} IS NOT NULL
          AND ${transactions.categoryId} NOT IN (${sql.join(allCcCategoryIds.map(id => sql`${id}`), sql`, `)})
          AND ${accounts.budgetId} = ${budgetId}
        GROUP BY ${transactions.accountId}, ${transactions.categoryId}
      `),

      // Q3: All CC payments (transfers) grouped by account_id
      queryRows<{
        accountId: number;
        totalPayments: number;
      }>(database, sql`
        SELECT 
          ${transactions.accountId} AS "accountId",
          COALESCE(SUM(${transactions.inflow}), 0) AS "totalPayments"
        FROM ${transactions}
        JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
        WHERE ${transactions.accountId} IN (${sql.join(ccAccountIds.map(id => sql`${id}`), sql`, `)})
          AND ${yearMonth(transactions.date)} = ${month}
          AND ${notFutureDate(transactions.date)}
          AND ${transactions.categoryId} IS NULL
          AND ${transactions.inflow} > 0
          AND ${accounts.budgetId} = ${budgetId}
        GROUP BY ${transactions.accountId}
      `),

      // Q4: Carryforward (prev month available), current assigned, and current row existence for ALL CC payment categories
      queryRows<{
        categoryId: number;
        prevAvailable: number;
        currentAssigned: number;
        hasCurrentRow: number;
      }>(database, sql`
        SELECT 
          c."categoryId",
          COALESCE(prev.available, 0) AS "prevAvailable",
          COALESCE(curr.assigned, 0) AS "currentAssigned",
          CASE WHEN curr.id IS NOT NULL THEN 1 ELSE 0 END AS "hasCurrentRow"
        FROM (VALUES ${sql.join(allCcCategoryIds.map(id => sql`(${id}::integer)`), sql`, `)}) AS c("categoryId")
        LEFT JOIN ${budgetMonths} prev ON prev.category_id = c."categoryId" AND prev.month = ${prevMonthStr}
        LEFT JOIN ${budgetMonths} curr ON curr.category_id = c."categoryId" AND curr.month = ${month}
      `),
    ]);

    // ── Build lookup maps from query results ──

    // Category available for funded-amount calculation (need ALL categories, not just CC-payment ones)
    const allCategoryIdsInSpending = new Set<number>();
    for (const s of allSpending) allCategoryIdsInSpending.add(s.categoryId);

    // Get available for ALL categories that have spending on CC accounts
    const categoryAvailablesGlobal = new Map<number, Milliunit>();
    if (allCategoryIdsInSpending.size > 0) {
      const availRows = await queryRows<{ categoryId: number; available: number }>(database, sql`
        SELECT ${budgetMonths.categoryId} AS "categoryId", ${budgetMonths.available} AS "available"
        FROM ${budgetMonths}
        WHERE ${budgetMonths.categoryId} IN (${sql.join([...allCategoryIdsInSpending].map(id => sql`${id}`), sql`, `)})
          AND ${budgetMonths.month} = ${month}
      `);
      for (const row of availRows) categoryAvailablesGlobal.set(row.categoryId, m(row.available));
    }

    // Group spending by accountId
    const spendingByAccount = new Map<number, Array<{ categoryId: number; catOutflow: number; catInflow: number }>>();
    for (const s of allSpending) {
      if (!spendingByAccount.has(s.accountId)) spendingByAccount.set(s.accountId, []);
      spendingByAccount.get(s.accountId)!.push(s);
    }

    // Payments by accountId
    const paymentsByAccount = new Map<number, Milliunit>();
    for (const p of allPayments) paymentsByAccount.set(p.accountId, m(p.totalPayments));

    // Budget data by categoryId
    const budgetDataByCat = new Map<number, { prevAvailable: Milliunit; currentAssigned: Milliunit; hasCurrentRow: boolean }>();
    for (const b of allBudgetData) {
      budgetDataByCat.set(b.categoryId, {
        prevAvailable: m(b.prevAvailable),
        currentAssigned: m(b.currentAssigned),
        hasCurrentRow: b.hasCurrentRow === 1,
      });
    }

    // ── Compute phase: iterate per-account, use existing engine functions ──
    const upserts: Array<{
      budgetId: number;
      categoryId: number;
      month: string;
      assigned: Milliunit;
      activity: Milliunit;
      available: Milliunit;
    }> = [];
    const updates: Array<{
      categoryId: number;
      activity: Milliunit;
      available: Milliunit;
    }> = [];

    for (const ccAccountId of ccAccountIds) {
      const ccCategoryId = accountToCcCategory.get(ccAccountId)!;
      const spending = spendingByAccount.get(ccAccountId) || [];
      const payments = paymentsByAccount.get(ccAccountId) ?? ZERO;
      const budgetData = budgetDataByCat.get(ccCategoryId);
      const carryforward = budgetData?.prevAvailable ?? ZERO;
      const assigned = budgetData?.currentAssigned ?? ZERO;
      const hasRow = budgetData?.hasCurrentRow ?? false;

      // Build per-account category availables map for the engine
      const categoryAvailables = new Map<number, Milliunit>();
      for (const s of spending) {
        categoryAvailables.set(s.categoryId, categoryAvailablesGlobal.get(s.categoryId) ?? ZERO);
      }

      const ccResult = calculateCCPaymentAvailable({
        spending: spending.map(cs => ({
          categoryId: cs.categoryId,
          outflow: m(cs.catOutflow),
          inflow: m(cs.catInflow),
        })),
        categoryAvailables,
        carryforward,
        assigned,
        payments,
      });

      if (hasRow) {
        updates.push({ categoryId: ccCategoryId, activity: ccResult.activity, available: ccResult.available });
      } else if (ccResult.activity !== 0) {
        upserts.push({
          budgetId,
          categoryId: ccCategoryId,
          month,
          assigned: ZERO,
          activity: ccResult.activity,
          available: (carryforward + ccResult.activity) as Milliunit,
        });
      }
    }

    // ── Write phase: batch updates + inserts ──
    // Bulk UPDATE existing rows via VALUES join (1 query instead of N)
    if (updates.length > 0) {
      await database.execute(sql`
        UPDATE ${budgetMonths} bm
        SET activity = v.act::bigint, available = v.avail::bigint
        FROM (VALUES ${sql.join(
          updates.map(u => sql`(${u.categoryId}::integer, ${u.activity}::bigint, ${u.available}::bigint)`),
          sql`, `,
        )}) AS v(cat_id, act, avail)
        WHERE bm.category_id = v.cat_id AND bm.month = ${month}
      `);
    }

    // Insert new rows
    if (upserts.length > 0) {
      await database.insert(budgetMonths)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .values(upserts as any)
        .onConflictDoUpdate({
          target: [budgetMonths.categoryId, budgetMonths.month],
          set: {
            activity: sql`excluded.activity`,
            available: sql`excluded.available`,
          },
        });
    }
    }); // end Sentry span
  }

  // ====== Shared Batch Helpers ======

  /**
   * Batch: cash spending per category for a set of category IDs.
   * Single grouped query replaces per-category N+1 loops.
   * Used by both getCashOverspendingForMonth and getOverspendingTypes.
   */
  async function batchCashSpending(
    budgetId: number, month: string, categoryIds: number[],
  ): Promise<Map<number, Milliunit>> {
    return Sentry.startSpan({ op: 'db.query', name: 'batchCashSpending', attributes: { budgetId, month, count: categoryIds.length } }, async () => {
    const result = new Map<number, Milliunit>();
    if (categoryIds.length === 0) return result;

    const rows = await queryRows<{ categoryId: number; total: number }>(database, sql`
      SELECT ${transactions.categoryId} AS "categoryId",
             COALESCE(SUM(${transactions.outflow} - ${transactions.inflow}), 0) AS "total"
      FROM ${transactions}
      JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
      WHERE ${transactions.categoryId} IN (${sql.join(categoryIds.map(id => sql`${id}`), sql`, `)})
        AND ${yearMonth(transactions.date)} = ${month}
        AND ${accounts.type} != 'credit'
        AND ${accounts.budgetId} = ${budgetId}
        AND ${notFutureDate(transactions.date)}
      GROUP BY ${transactions.categoryId}
    `);
    for (const row of rows) {
      result.set(row.categoryId, maxMilliunits(ZERO, m(row.total)));
    }
    return result;
    }); // end Sentry span
  }

  // ====== Overspending Detection Functions ======

  async function getCashOverspendingForMonth(budgetId: number, month: string): Promise<Milliunit> {
    return Sentry.startSpan({ op: 'db.query', name: 'getCashOverspendingForMonth', attributes: { budgetId, month } }, async () => {
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

    // Batch: get cash spending for ALL overspent categories in one grouped query
    const cashSpendingMap = await batchCashSpending(
      budgetId, month, overspentCategories.map(c => c.categoryId),
    );

    const inputs = overspentCategories.map(cat => ({
      categoryId: cat.categoryId,
      available: m(cat.available),
      linkedAccountId: null as number | null,
      cashSpending: cashSpendingMap.get(cat.categoryId) ?? ZERO,
    }));

    // ── Compute phase: delegate to engine ──
    return calculateCashOverspending(inputs);
    }); // end Sentry span
  }

  async function getOverspendingTypes(budgetId: number, month: string): Promise<Record<number, 'cash' | 'credit' | null>> {
    return Sentry.startSpan({ op: 'db.query', name: 'getOverspendingTypes', attributes: { budgetId, month } }, async () => {
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

    // Batch: get cash spending for all non-CC-payment overspent categories
    const regularCatIds = overspentCategories
      .filter(c => !c.linkedAccountId)
      .map(c => c.categoryId);
    const cashSpendingMap = await batchCashSpending(budgetId, month, regularCatIds);

    for (const cat of overspentCategories) {
      const cashSpending = cat.linkedAccountId ? ZERO : (cashSpendingMap.get(cat.categoryId) ?? ZERO);

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
    }); // end Sentry span
  }

  /**
   * Unified overspending pipeline: computes BOTH cashOverspending and overspendingTypes
   * in a single pass (2 queries instead of 4 when called separately).
   *
   * Use this when both values are needed for the same month (e.g., buildBudgetResponse).
   * Individual functions remain available for cases where only one value is needed.
   */
  async function getOverspendingData(budgetId: number, month: string): Promise<{
    cashOverspending: Milliunit;
    overspendingTypes: Record<number, 'cash' | 'credit' | null>;
  }> {
    return Sentry.startSpan({ op: 'db.query', name: 'getOverspendingData', attributes: { budgetId, month } }, async () => {
    // ── Single query: ALL overspent categories (superset of both functions) ──
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

    // ── Single batch: cash spending for ALL non-CC-payment overspent categories ──
    const regularCatIds = overspentCategories
      .filter(c => !c.linkedAccountId)
      .map(c => c.categoryId);
    const cashSpendingMap = await batchCashSpending(budgetId, month, regularCatIds);

    // ── Compute phase: both outputs from shared data ──
    const overspendingTypes: Record<number, 'cash' | 'credit' | null> = {};
    const cashOverspendingInputs: Array<{
      categoryId: number;
      available: Milliunit;
      linkedAccountId: number | null;
      cashSpending: Milliunit;
    }> = [];

    for (const cat of overspentCategories) {
      const cashSpending = cat.linkedAccountId ? ZERO : (cashSpendingMap.get(cat.categoryId) ?? ZERO);

      // Classify for overspendingTypes
      const type = classifyOverspending({
        categoryId: cat.categoryId,
        available: m(cat.available),
        linkedAccountId: cat.linkedAccountId,
        cashSpending,
      });
      overspendingTypes[cat.categoryId] = type;

      // Collect inputs for cash overspending (only regular categories)
      if (!cat.linkedAccountId) {
        cashOverspendingInputs.push({
          categoryId: cat.categoryId,
          available: m(cat.available),
          linkedAccountId: null,
          cashSpending,
        });
      }
    }

    const cashOverspending = calculateCashOverspending(cashOverspendingInputs);

    return { cashOverspending, overspendingTypes };
    }); // end Sentry span
  }

  return {
    getCreditCardPaymentCategory,
    ensureCreditCardPaymentCategory,
    updateCreditCardPaymentBudget,
    batchUpdateAllCCPayments,
    getCashOverspendingForMonth,
    getOverspendingTypes,
    getOverspendingData,
  };
}
