/**
 * Budget Repository — RTA, carryforward, assignments, CC payments, overspending, inspector.
 *
 * Part of the Repository Pattern.
 * Orchestration layer: queries → engine → writes.
 * All queries use Drizzle ORM query builder or sql template.
 *
 * Cross-repo dependencies are injected via `deps`:
 * - `createCategory` from categories repo (for ensureCreditCardPaymentCategory)
 */
import { eq, and, sql, lt, gt, max, isNull, isNotNull, type InferSelectModel } from 'drizzle-orm';
import { accounts, categories, categoryGroups, budgetMonths, transactions } from '../db/schema';
import { currentDate, yearMonth } from '../db/sql-helpers';
import type { DrizzleDB } from './client';
import { queryRows } from './client';
import {
  computeCarryforward as engineCarryforward,
  calculateRTA,
  calculateRTABreakdown,
  validateAssignment,
  calculateAssignment,
  calculateCCPaymentAvailable,
  calculateCashOverspending,
  classifyOverspending,
  calculateBudgetAvailable,
  ZERO,
  type Milliunit,
} from '../engine';

/** Cast a DB value to Milliunit (values are already integers from BIGINT columns). */
const m = (v: unknown): Milliunit => (Number(v) || 0) as Milliunit;

export interface BudgetRow {
  id: number | null;
  categoryId: number;
  categoryName: string;
  categoryGroupId: number;
  groupName: string;
  groupHidden: boolean | number;
  month: string;
  assigned: Milliunit;
  activity: Milliunit;
  available: Milliunit;
  _budgetMonthId?: number | null;
  linkedAccountId: number | null;
}

export interface BudgetRepoDeps {
  createCategory: (category: { name: string; category_group_id: number; linked_account_id?: number }) => Promise<{ id: number }> | { id: number };
}

export function createBudgetFunctions(
  database: DrizzleDB,
  deps: BudgetRepoDeps,
) {

  async function computeCarryforward(categoryId: number, targetMonth: string): Promise<Milliunit> {
    // 1. Query: get previous month's available
    const prevRows = await database.select({ available: budgetMonths.available })
      .from(budgetMonths)
      .where(and(
        eq(budgetMonths.categoryId, categoryId),
        lt(budgetMonths.month, targetMonth),
      ))
      .orderBy(sql`${budgetMonths.month} DESC`)
      .limit(1);

    const prevAvailable = prevRows[0]?.available ?? null;

    // 2. Query: check if this is a CC Payment category
    const categoryRows = await database.select({ linkedAccountId: categories.linkedAccountId })
      .from(categories)
      .where(eq(categories.id, categoryId));
    const isCCPayment = !!categoryRows[0]?.linkedAccountId;

    // 3. Compute: delegate to engine
    return engineCarryforward(prevAvailable, isCCPayment);
  }

  async function getBudgetForMonth(month: string) {
    const rows = await queryRows<BudgetRow>(database, sql`
      SELECT 
        CASE WHEN c.id IS NOT NULL THEN COALESCE(bm.id, -c.id) ELSE NULL END as "id",
        c.id as "categoryId",
        c.name as "categoryName",
        cg.id as "categoryGroupId",
        cg.name as "groupName",
        cg.hidden as "groupHidden",
        COALESCE(bm.month, ${month}) as "month",
        COALESCE(bm.assigned, 0) as "assigned",
        COALESCE(bm.activity, 0) as "activity",
        bm.available as "available",
        bm.id as "_budgetMonthId",
        c.linked_account_id as "linkedAccountId"
      FROM ${categoryGroups} cg
      LEFT JOIN ${categories} c ON c.category_group_id = cg.id
      LEFT JOIN ${budgetMonths} bm ON c.id = bm.category_id AND bm.month = ${month}
      WHERE cg.is_income = false
      ORDER BY cg.sort_order, c.sort_order
    `);

    // For categories without a budget_months row, compute carryforward from prior months
    const result: BudgetRow[] = [];
    for (const row of rows) {
      const r = { ...row };
      // Coerce BIGINT fields — PostgreSQL returns strings via raw SQL
      r.assigned = m(r.assigned);
      r.activity = m(r.activity);
      if (r._budgetMonthId === null && r.categoryId !== null) {
        r.available = await computeCarryforward(r.categoryId, month) as Milliunit;
      } else {
        r.available = m(r.available);
      }
      delete r._budgetMonthId;
      result.push(r);
    }
    return result;
  }

  async function getReadyToAssign(month: string): Promise<Milliunit> {
    // ── Query phase ──

    // 1. Cash on hand
    const cashRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0) as "total"
      FROM ${transactions}
      JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
      WHERE ${accounts.type} != 'credit' AND ${transactions.date} <= ${currentDate()}
    `);

    // 2. Positive CC balances
    const ccRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM("positiveBalance"), 0) as "total"
      FROM (
        SELECT GREATEST(0, COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0)) as "positiveBalance"
        FROM ${transactions}
        JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
        WHERE ${accounts.type} = 'credit' AND ${transactions.date} <= ${currentDate()}
        GROUP BY ${accounts.id}
      ) sub
    `);

    // 3. Latest month with COMPLETE budget data
    const latestMonthRows = await queryRows<{ month: string }>(database, sql`
      SELECT month FROM ${budgetMonths}
      GROUP BY month
      HAVING COUNT(*) >= 10
      ORDER BY month DESC
      LIMIT 1
    `);

    const latestMonth = latestMonthRows[0];

    if (!latestMonth?.month) {
      return (m(cashRows[0]!.total) + m(ccRows[0]!.total)) as Milliunit;
    }

    // 4. Sum of all category available values for the latest month
    const totalAvailableRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(${budgetMonths.available}), 0) as "total"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false AND ${budgetMonths.month} = ${latestMonth.month}
    `);

    // 4b. Future assigned
    const futureAssignedRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(${budgetMonths.assigned}), 0) as "total"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false 
        AND ${budgetMonths.month} > ${latestMonth.month} 
        AND ${budgetMonths.month} <= ${month}
    `);

    // 5. Overspending data
    const totalOverspendingRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(ABS(${budgetMonths.available})), 0) as "total"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false
        AND ${categories.linkedAccountId} IS NULL
        AND ${budgetMonths.available} < 0
        AND ${budgetMonths.month} = ${latestMonth.month}
    `);

    const cashOverspendingAmount = await getCashOverspendingForMonth(latestMonth.month);

    // ── Compute phase: delegate to engine ──
    return calculateRTA({
      cashBalance: m(cashRows[0]!.total),
      positiveCCBalances: m(ccRows[0]!.total),
      totalAvailable: m(totalAvailableRows[0]!.total),
      futureAssigned: m(futureAssignedRows[0]!.total),
      totalOverspending: m(totalOverspendingRows[0]!.total),
      cashOverspending: cashOverspendingAmount,
      currentMonth: new Date().toISOString().slice(0, 7),
      viewedMonth: month,
    });
  }

  async function getReadyToAssignBreakdown(month: string) {
    // ── Query phase ──
    const [yr, mo] = month.split('-').map(Number);
    const prevDate = new Date(yr, mo - 2);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    // ➕ Inflow: Ready to Assign in current month (cash-based accounts only)
    const inflowRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0) as "total"
      FROM ${transactions}
      JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
      JOIN ${categories} ON ${transactions.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = true
        AND ${accounts.type} != 'credit'
        AND ${yearMonth(transactions.date)} = ${month}
        AND ${transactions.date} <= ${currentDate()}
    `);

    // ➕ Positive CC balances
    const positiveCCRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM("positiveBalance"), 0) as "total"
      FROM (
        SELECT GREATEST(0, COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0)) as "positiveBalance"
        FROM ${transactions}
        JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
        WHERE ${accounts.type} = 'credit' AND ${transactions.date} <= ${currentDate()}
        GROUP BY ${accounts.id}
      ) sub
    `);

    // ➖ Assigned in current month
    const assignedThisMonthRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(${budgetMonths.assigned}), 0) as "total"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false AND ${budgetMonths.month} = ${month}
    `);

    // ➖ Assigned in future
    const assignedInFutureRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(${budgetMonths.assigned}), 0) as "total"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false AND ${budgetMonths.month} > ${month}
    `);

    // ➖ Cash overspending from previous month
    const cashOverspendingTotal = await getCashOverspendingForMonth(prevMonth);

    // RTA (already uses engine internally)
    const rta = await getReadyToAssign(month);

    // ── Compute phase: delegate to engine ──
    return calculateRTABreakdown({
      rta,
      inflowThisMonth: m(inflowRows[0]!.total),
      positiveCCBalances: m(positiveCCRows[0]!.total),
      assignedThisMonth: m(assignedThisMonthRows[0]!.total),
      cashOverspendingPreviousMonth: cashOverspendingTotal,
      assignedInFuture: m(assignedInFutureRows[0]!.total),
    });
  }

  async function updateBudgetAssignment(categoryId: number, month: string, assigned: Milliunit) {
    // ── Validate phase: delegate to engine ──
    const validation = validateAssignment(assigned);
    if (!validation.valid && validation.clamped === 0) {
      console.error(`updateBudgetAssignment: rejected non-finite value ${assigned} for category ${categoryId}`);
      return;
    }
    assigned = validation.clamped;

    // ── Query phase (BEFORE transaction to avoid PGlite deadlock) ──
    const existingRows = await database.select({ assigned: budgetMonths.assigned, available: budgetMonths.available })
      .from(budgetMonths)
      .where(and(eq(budgetMonths.categoryId, categoryId), eq(budgetMonths.month, month)));
    const existing = existingRows[0];

    const carryforward = await computeCarryforward(categoryId, month);

    // ── Compute phase: delegate to engine ──
    const result = calculateAssignment({
      existing: existing ? { assigned: m(existing.assigned), available: m(existing.available) } : null,
      carryforward: carryforward as Milliunit,
      newAssigned: assigned,
    });

    if (result.shouldSkip) return;

    // ── Write phase (inside transaction for atomicity) ──
    await database.transaction(async (tx) => {
      if (existing) {
        await tx.execute(sql`
          UPDATE ${budgetMonths}
          SET assigned = ${assigned}, available = available + ${result.delta}
          WHERE ${budgetMonths.categoryId} = ${categoryId} AND ${budgetMonths.month} = ${month}
        `);

        // Ghost entry cleanup
        if (result.shouldDelete) {
          const updatedRows = await tx.select({
            assigned: budgetMonths.assigned,
            activity: budgetMonths.activity,
            available: budgetMonths.available,
          })
            .from(budgetMonths)
            .where(and(eq(budgetMonths.categoryId, categoryId), eq(budgetMonths.month, month)));
          const updated = updatedRows[0];
          if (updated && updated.assigned === 0 && updated.activity === 0 && updated.available === 0) {
            await tx.delete(budgetMonths)
              .where(and(eq(budgetMonths.categoryId, categoryId), eq(budgetMonths.month, month)));
          }
        }
      } else {
        await tx.insert(budgetMonths)
          .values({
            categoryId,
            month,
            assigned,
            activity: ZERO,
            available: result.newAvailable,
          });
      }

      // Propagate the delta to ALL subsequent months' available
      if (result.delta !== 0) {
        await tx.execute(sql`
          UPDATE ${budgetMonths}
          SET available = available + ${result.delta}
          WHERE ${budgetMonths.categoryId} = ${categoryId} AND ${budgetMonths.month} > ${month}
        `);

        // Clean up ghost entries created by propagation
        await tx.delete(budgetMonths)
          .where(and(
            eq(budgetMonths.categoryId, categoryId),
            gt(budgetMonths.month, month),
            eq(budgetMonths.assigned, ZERO),
            eq(budgetMonths.activity, ZERO),
            eq(budgetMonths.available, ZERO),
          ));
      }
    });
  }

  async function updateBudgetActivity(categoryId: number, month: string) {
    // ── Query phase ──
    const activityRows = await queryRows<{ activity: number }>(database, sql`
      SELECT COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0) as "activity"
      FROM ${transactions}
      WHERE ${transactions.categoryId} = ${categoryId} 
        AND ${yearMonth(transactions.date)} = ${month} 
        AND ${transactions.date} <= ${currentDate()}
    `);

    const activity = m(activityRows[0]!.activity);
    const carryforward = await computeCarryforward(categoryId, month);

    const existingRows = await database.select({ assigned: budgetMonths.assigned })
      .from(budgetMonths)
      .where(and(eq(budgetMonths.categoryId, categoryId), eq(budgetMonths.month, month)));
    const existing = existingRows[0];

    const assigned = m(existing?.assigned);

    // ── Compute phase: delegate to engine ──
    const available = calculateBudgetAvailable(carryforward as Milliunit, assigned, activity);

    // ── Write phase ──
    if (existing) {
      return database.update(budgetMonths)
        .set({ activity, available })
        .where(and(eq(budgetMonths.categoryId, categoryId), eq(budgetMonths.month, month)));
    } else {
      return database.insert(budgetMonths)
        .values({ categoryId, month, assigned: ZERO, activity, available });
    }
  }

  async function refreshAllBudgetActivity(month: string) {
    // Sequential execution — no transaction wrapper to avoid PGlite deadlock
    // (updateBudgetActivity and updateCreditCardPaymentBudget use `database` internally)
    const cats = await database.selectDistinct({ categoryId: transactions.categoryId })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(
        eq(yearMonth(transactions.date), month),
        sql`${transactions.date} <= ${currentDate()}`,
        isNotNull(transactions.categoryId),
        isNull(categories.linkedAccountId)
      ));

    for (const cat of cats) {
      await updateBudgetActivity(cat.categoryId!, month);
    }

    const ccAccounts = await database.select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.type, 'credit'));

    for (const acc of ccAccounts) {
      await updateCreditCardPaymentBudget(acc.id, month);
    }
  }

  // ====== Credit Card Payment Functions ======

  async function getCreditCardPaymentCategory(accountId: number): Promise<InferSelectModel<typeof categories> | undefined> {
    const rows = await database.select().from(categories)
      .where(eq(categories.linkedAccountId, accountId));
    return rows[0];
  }

  async function ensureCreditCardPaymentCategory(accountId: number, accountName: string): Promise<InferSelectModel<typeof categories> | undefined> {
    const category = await getCreditCardPaymentCategory(accountId);
    if (category) return category;

    // Check/create CC group BEFORE deps call to avoid PGlite deadlock
    const ccGroupRows = await database.select({ id: categoryGroups.id })
      .from(categoryGroups)
      .where(eq(categoryGroups.name, 'Credit Card Payments'));
    let ccGroup = ccGroupRows[0];

    if (!ccGroup) {
      const maxOrderResult = await database.select({ maxOrder: max(categoryGroups.sortOrder) })
        .from(categoryGroups);
      const newOrder = (maxOrderResult[0]?.maxOrder ?? 0) + 1;
      const ccGroupResult = await database.insert(categoryGroups)
        .values({ name: 'Credit Card Payments', sortOrder: newOrder, hidden: false, isIncome: false })
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

  async function updateCreditCardPaymentBudget(accountId: number, month: string) {
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
      WHERE ${transactions.accountId} = ${accountId}
        AND ${yearMonth(transactions.date)} = ${month}
        AND ${transactions.date} <= ${currentDate()}
        AND ${transactions.categoryId} IS NOT NULL
        AND ${transactions.categoryId} != ${ccCategory.id}
      GROUP BY ${transactions.categoryId}
    `);

    // 2. Get current available for each affected category
    const categoryAvailables = new Map<number, Milliunit>();
    for (const catSpend of categorySpending) {
      const catBudgetRows = await database.select({ available: budgetMonths.available })
        .from(budgetMonths)
        .where(and(
          eq(budgetMonths.categoryId, catSpend.categoryId),
          eq(budgetMonths.month, month),
        ));
      categoryAvailables.set(catSpend.categoryId, m(catBudgetRows[0]?.available));
    }

    // 3. CC payments (transfers to this CC)
    const paymentRows = await queryRows<{ totalPayments: number }>(database, sql`
      SELECT COALESCE(SUM(${transactions.inflow}), 0) as "totalPayments"
      FROM ${transactions}
      WHERE ${transactions.accountId} = ${accountId}
        AND ${yearMonth(transactions.date)} = ${month}
        AND ${transactions.date} <= ${currentDate()}
        AND ${transactions.categoryId} IS NULL
        AND ${transactions.inflow} > 0
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
          categoryId: ccCategory.id,
          month,
          assigned: ZERO,
          activity: ccResult.activity,
          available: (m(prevCCBudgetRows[0]?.available) + ccResult.activity) as Milliunit,
        });
    }
  }

  // ====== Overspending Detection Functions ======

  async function getCashOverspendingForMonth(month: string): Promise<Milliunit> {
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

  async function getOverspendingTypes(month: string): Promise<Record<number, 'cash' | 'credit' | null>> {
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
    `);

    for (const cat of overspentCategories) {
      let cashSpending = 0;
      if (!cat.linkedAccountId) {
        const cashActivityRows = await queryRows<{ total: number }>(database, sql`
          SELECT COALESCE(SUM(${transactions.outflow} - ${transactions.inflow}), 0) as "total"
          FROM ${transactions}
          JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
          WHERE ${transactions.categoryId} = ${cat.categoryId} 
            AND ${yearMonth(transactions.date)} = ${month} 
            AND ${accounts.type} != 'credit'
        `);
        cashSpending = Math.max(0, m(cashActivityRows[0]!.total)) as unknown as number;
      }

      // ── Compute phase: delegate to engine ──
      const type = classifyOverspending({
        categoryId: cat.categoryId,
        available: m(cat.available),
        linkedAccountId: cat.linkedAccountId,
        cashSpending: cashSpending as unknown as Milliunit,
      });

      result[cat.categoryId] = type;
    }

    return result;
  }

  async function getBudgetInspectorData(month: string) {
    const [yr, mo] = month.split('-').map(Number);
    const prevDate = new Date(yr, mo - 2);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const twelveMonthsAgoDate = new Date(yr, mo - 13);
    const twelveMonthsAgo = `${twelveMonthsAgoDate.getFullYear()}-${String(twelveMonthsAgoDate.getMonth() + 1).padStart(2, '0')}`;

    // ── Month Summary ──
    const breakdown = await getReadyToAssignBreakdown(month);

    const budgetRows = await getBudgetForMonth(month);

    let totalAvailable = 0;
    let totalActivity = 0;
    for (const row of budgetRows) {
      if (row.categoryId !== null) {
        totalAvailable += row.available || 0;
        totalActivity += row.activity || 0;
      }
    }

    const totalAssigned = breakdown.assignedThisMonth || 0;
    const leftOverFromLastMonth = totalAvailable - totalAssigned - totalActivity;

    // ── Cost to Be Me ──
    const targets = totalAssigned;

    const expectedIncomeRows = await queryRows<{ avgTotal: number }>(database, sql`
      SELECT COALESCE(AVG("monthlyTotal"), 0) as "avgTotal"
      FROM (
        SELECT ${yearMonth(transactions.date)} as month, SUM(${transactions.inflow} - ${transactions.outflow}) as "monthlyTotal"
        FROM ${transactions}
        JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
        JOIN ${categories} ON ${transactions.categoryId} = ${categories.id}
        JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
        WHERE ${categoryGroups.isIncome} = true
          AND ${accounts.type} != 'credit'
          AND ${transactions.date} <= ${currentDate()}
          AND ${yearMonth(transactions.date)} >= ${twelveMonthsAgo} AND ${yearMonth(transactions.date)} < ${month}
        GROUP BY ${yearMonth(transactions.date)}
      ) sub
    `);

    // ── Auto-Assign Calculations ──

    const underfundedRegularRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(ABS(${budgetMonths.available})), 0) as "total"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false AND ${categories.linkedAccountId} IS NULL 
        AND ${budgetMonths.available} < 0 AND ${budgetMonths.month} = ${month}
    `);

    const ccShortfallRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(
        CASE WHEN ABS(${accounts.balance}) > COALESCE(bm.available, 0) AND ${accounts.balance} < 0
          THEN ABS(${accounts.balance}) - COALESCE(bm.available, 0)
          ELSE 0
        END
      ), 0) as "total"
      FROM ${accounts}
      LEFT JOIN ${categories} c ON c.linked_account_id = ${accounts.id}
      LEFT JOIN ${budgetMonths} bm ON bm.category_id = c.id AND bm.month = ${month}
      WHERE ${accounts.type} = 'credit' AND ${accounts.closed} = false
    `);

    const underfundedTotal = m(underfundedRegularRows[0]!.total) + m(ccShortfallRows[0]!.total);

    const assignedLastMonthRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(${budgetMonths.assigned}), 0) as "total"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false AND ${categories.linkedAccountId} IS NULL 
        AND ${budgetMonths.month} = ${prevMonthStr}
    `);

    const spentLastMonthRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(ABS(CASE WHEN ${budgetMonths.activity} < 0 THEN ${budgetMonths.activity} ELSE 0 END)), 0) as "total"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false AND ${categories.linkedAccountId} IS NULL 
        AND ${budgetMonths.month} = ${prevMonthStr}
    `);

    const avgAssignedRows = await queryRows<{ avgTotal: number }>(database, sql`
      SELECT COALESCE(AVG("monthlyTotal"), 0) as "avgTotal"
      FROM (
        SELECT ${budgetMonths.month}, SUM(${budgetMonths.assigned}) as "monthlyTotal"
        FROM ${budgetMonths}
        JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
        JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
        WHERE ${categoryGroups.isIncome} = false AND ${categories.linkedAccountId} IS NULL
          AND ${budgetMonths.month} >= ${twelveMonthsAgo} AND ${budgetMonths.month} < ${month}
        GROUP BY ${budgetMonths.month}
      ) sub
    `);

    const avgSpentRows = await queryRows<{ avgTotal: number }>(database, sql`
      SELECT COALESCE(AVG("monthlyTotal"), 0) as "avgTotal"
      FROM (
        SELECT ${budgetMonths.month}, SUM(ABS(CASE WHEN ${budgetMonths.activity} < 0 THEN ${budgetMonths.activity} ELSE 0 END)) as "monthlyTotal"
        FROM ${budgetMonths}
        JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
        JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
        WHERE ${categoryGroups.isIncome} = false AND ${categories.linkedAccountId} IS NULL
          AND ${budgetMonths.month} >= ${twelveMonthsAgo} AND ${budgetMonths.month} < ${month}
        GROUP BY ${budgetMonths.month}
      ) sub
    `);

    const reduceOverfundingRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(${budgetMonths.available} - ${budgetMonths.assigned}), 0) as "total"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false AND ${categories.linkedAccountId} IS NULL
        AND ${budgetMonths.available} > ${budgetMonths.assigned} 
        AND ${budgetMonths.assigned} > 0 AND ${budgetMonths.activity} >= 0
        AND ${budgetMonths.month} = ${month}
    `);

    const resetAvailableRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(${budgetMonths.available}), 0) as "total"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false AND ${categories.linkedAccountId} IS NULL
        AND ${budgetMonths.available} > 0 AND ${budgetMonths.assigned} = 0 AND ${budgetMonths.activity} = 0
        AND ${budgetMonths.month} = ${month}
    `);

    const resetAssigned = totalAssigned;

    // ── Assigned in Future Months ──
    const futureMonths = await queryRows<{ month: string; total: number }>(database, sql`
      SELECT ${budgetMonths.month} as "month", SUM(${budgetMonths.assigned}) as "total"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false AND ${budgetMonths.month} > ${month} AND ${budgetMonths.assigned} != 0
      GROUP BY ${budgetMonths.month}
      ORDER BY ${budgetMonths.month}
    `);

    return {
      summary: {
        leftOverFromLastMonth,
        assignedThisMonth: totalAssigned,
        activity: totalActivity,
        available: totalAvailable,
      },
      costToBeMe: {
        targets,
        expectedIncome: m(expectedIncomeRows[0]!.avgTotal) || 0,
      },
      autoAssign: {
        underfunded: underfundedTotal,
        assignedLastMonth: m(assignedLastMonthRows[0]!.total),
        spentLastMonth: m(spentLastMonthRows[0]!.total),
        averageAssigned: m(avgAssignedRows[0]!.avgTotal),
        averageSpent: m(avgSpentRows[0]!.avgTotal),
        reduceOverfunding: m(reduceOverfundingRows[0]!.total),
        resetAvailableAmounts: m(resetAvailableRows[0]!.total),
        resetAssignedAmounts: resetAssigned,
      },
      futureAssignments: {
        total: breakdown.assignedInFuture,
        months: futureMonths.map((fm: { month: string; total: number }) => ({
          month: fm.month,
          amount: m(fm.total),
        })),
      },
    };
  }

  return {
    computeCarryforward,
    getBudgetForMonth,
    getReadyToAssign,
    getReadyToAssignBreakdown,
    updateBudgetAssignment,
    updateBudgetActivity,
    refreshAllBudgetActivity,
    getCreditCardPaymentCategory,
    ensureCreditCardPaymentCategory,
    updateCreditCardPaymentBudget,
    getCashOverspendingForMonth,
    getOverspendingTypes,
    getBudgetInspectorData,
  };
}
