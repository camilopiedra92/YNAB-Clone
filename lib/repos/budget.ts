/**
 * Budget Repository — Carryforward, assignments, activity, inspector, month range.
 *
 * Part of the Repository Pattern.
 * Orchestration layer: queries → engine → writes.
 * All queries use Drizzle ORM query builder or sql template.
 *
 * RTA queries → budget-rta.ts
 * CC payments & overspending → budget-cc.ts
 *
 * This module composes all sub-repos and re-exports the full API surface.
 * Cross-repo dependencies are injected via `deps`:
 * - `createCategory` from categories repo (for ensureCreditCardPaymentCategory)
 */
import { eq, and, sql, lt, gt, inArray } from 'drizzle-orm';
import { accounts, categories, categoryGroups, budgetMonths, transactions } from '../db/schema';
import { yearMonth, notFutureDate } from '../db/sql-helpers';
import type { DrizzleDB } from '../db/helpers';
import { queryRows } from '../db/helpers';
import * as Sentry from '@sentry/nextjs';
import {
  computeCarryforward as engineCarryforward,
  calculateRTABreakdown,
  validateAssignment,
  calculateAssignment,
  calculateBudgetAvailable,
  ZERO,
  type Milliunit,
} from '../engine';
import { createBudgetRTAFunctions } from './budget-rta';
import { createBudgetCCFunctions } from './budget-cc';

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

  async function computeCarryforward(budgetId: number, categoryId: number, targetMonth: string): Promise<Milliunit> {
    // 1. Query: get previous month's available
    const prevRows = await database.select({ available: budgetMonths.available })
      .from(budgetMonths)
      .where(and(
        eq(budgetMonths.categoryId, categoryId),
        lt(budgetMonths.month, targetMonth),
        eq(categoryGroups.budgetId, budgetId)
      ))
      .innerJoin(categories, eq(budgetMonths.categoryId, categories.id))
      .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
      .orderBy(sql`${budgetMonths.month} DESC`)
      .limit(1);

    const prevAvailable = prevRows[0]?.available ?? null;

    // 2. Query: check if this is a CC Payment category
    const categoryRows = await database.select({ linkedAccountId: categories.linkedAccountId, budgetId: categoryGroups.budgetId })
      .from(categories)
      .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
      .where(eq(categories.id, categoryId));
    const isCCPayment = !!categoryRows[0]?.linkedAccountId;

    // 3. Compute: delegate to engine
    return engineCarryforward(prevAvailable, isCCPayment);
  }

  async function getBudgetForMonth(budgetId: number, month: string) {
    return Sentry.startSpan({ op: 'db.query', name: 'getBudgetForMonth', attributes: { budgetId, month } }, async () => {
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
      WHERE cg.is_income = false AND cg.budget_id = ${budgetId}
      ORDER BY cg.sort_order, c.sort_order
    `);

    // Batch carryforward: single query replaces per-row computeCarryforward (N+1 elimination)
    const missingIds = rows
      .filter(r => r._budgetMonthId === null && r.categoryId !== null)
      .map(r => r.categoryId);

    const carryforwardMap = new Map<number, Milliunit>();
    if (missingIds.length > 0) {
      const prevRows = await queryRows<{ categoryId: number; available: number; linkedAccountId: number | null }>(database, sql`
        SELECT DISTINCT ON (bm.category_id)
          bm.category_id as "categoryId",
          bm.available as "available",
          c.linked_account_id as "linkedAccountId"
        FROM ${budgetMonths} bm
        JOIN ${categories} c ON bm.category_id = c.id
        JOIN ${categoryGroups} cg ON c.category_group_id = cg.id
        WHERE bm.month < ${month}
          AND cg.budget_id = ${budgetId}
          AND bm.category_id IN ${sql.raw(`(${missingIds.join(',')})`)}
        ORDER BY bm.category_id, bm.month DESC
      `);
      for (const pr of prevRows) {
        const isCCPayment = !!pr.linkedAccountId;
        carryforwardMap.set(pr.categoryId, engineCarryforward(m(pr.available), isCCPayment));
      }
    }

    const result: BudgetRow[] = [];
    for (const row of rows) {
      const r = { ...row };
      // Coerce BIGINT fields — PostgreSQL returns strings via raw SQL
      r.assigned = m(r.assigned);
      r.activity = m(r.activity);
      if (r._budgetMonthId === null && r.categoryId !== null) {
        // Use batch carryforward; default to ZERO if no prior month data
        r.available = carryforwardMap.get(r.categoryId) ?? ZERO;
      } else {
        r.available = m(r.available);
      }
      delete r._budgetMonthId;
      result.push(r);
    }
    return result;
    }); // end Sentry span
  }

  async function updateBudgetAssignment(budgetId: number, categoryId: number, month: string, assigned: Milliunit) {
    return Sentry.startSpan({ op: 'db.query', name: 'updateBudgetAssignment', attributes: { budgetId, categoryId, month } }, async () => {
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

    const carryforward = await computeCarryforward(budgetId, categoryId, month);

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
            budgetId,
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
    }); // end Sentry span
  }

  async function updateBudgetActivity(budgetId: number, categoryId: number, month: string) {
    // ── Query phase ──
    const activityRows = await queryRows<{ activity: number }>(database, sql`
      SELECT COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0) as "activity"
      FROM ${transactions}
      JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
      WHERE ${transactions.categoryId} = ${categoryId} 
        AND ${yearMonth(transactions.date)} = ${month} 
        AND ${notFutureDate(transactions.date)}
        AND ${accounts.budgetId} = ${budgetId}
    `);

    const activity = m(activityRows[0]!.activity);
    const carryforward = await computeCarryforward(budgetId, categoryId, month);

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
        .values({ budgetId, categoryId, month, assigned: ZERO, activity, available });
    }
  }

  async function refreshAllBudgetActivity(budgetId: number, month: string) {
    // 1. Get all activity for the month
    const activityRows = await queryRows<{ categoryId: number; activity: number }>(database, sql`
      SELECT 
        ${transactions.categoryId} as "categoryId",
        COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0) as "activity"
      FROM ${transactions}
      JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
      WHERE ${transactions.categoryId} IS NOT NULL
        AND ${yearMonth(transactions.date)} = ${month}
        AND ${notFutureDate(transactions.date)}
        AND ${accounts.budgetId} = ${budgetId}
      GROUP BY ${transactions.categoryId}
    `);
    const activityMap = new Map<number, Milliunit>();
    for (const row of activityRows) activityMap.set(row.categoryId, m(row.activity));

    // 2. Get existing budget rows for this month
    const existingRows = await database.select().from(budgetMonths)
      .innerJoin(categories, eq(budgetMonths.categoryId, categories.id))
      .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
      .where(and(
        eq(budgetMonths.month, month),
        eq(categoryGroups.budgetId, budgetId)
      ));
    const existingMap = new Map<number, typeof existingRows[0]>();
    for (const row of existingRows) existingMap.set(row.budget_months.categoryId, row);

    // 3. Get carryforward (latest previous available) for ALL categories
    //    MUST include linked_account_id to apply engineCarryforward correctly:
    //    regular categories reset negative available to 0, CC payment categories carry forward debt.
    const prevRows = await queryRows<{ categoryId: number; available: number; linkedAccountId: number | null }>(database, sql`
      SELECT DISTINCT ON (${budgetMonths.categoryId})
        ${budgetMonths.categoryId} as "categoryId",
        ${budgetMonths.available} as "available",
        ${categories.linkedAccountId} as "linkedAccountId"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${budgetMonths.month} < ${month}
        AND ${categoryGroups.budgetId} = ${budgetId}
      ORDER BY ${budgetMonths.categoryId}, ${budgetMonths.month} DESC
    `);
    const carryforwardMap = new Map<number, Milliunit>();
    for (const row of prevRows) {
      const isCCPayment = !!row.linkedAccountId;
      carryforwardMap.set(row.categoryId, engineCarryforward(m(row.available), isCCPayment));
    }

    // 4. Identify all categories that need updates
    const allCategories = await database.select({ id: categories.id, linkedAccountId: categories.linkedAccountId })
        .from(categories)
        .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
        .where(eq(categoryGroups.budgetId, budgetId));

    const updates: { 
        budgetId: number;
        categoryId: number; 
        month: string; 
        assigned: Milliunit; 
        activity: Milliunit; 
        available: Milliunit;
    }[] = [];
    
    const deletes: number[] = [];

    for (const cat of allCategories) {
        if (cat.linkedAccountId) continue;

        const activity = activityMap.get(cat.id) || ZERO;
        const existing = existingMap.get(cat.id)?.budget_months;
        const carryforward = carryforwardMap.get(cat.id) || ZERO;
        const assigned = m(existing?.assigned);

        const available = calculateBudgetAvailable(carryforward, assigned, activity);

        if (assigned === 0 && activity === 0 && available === 0) {
            if (existing) deletes.push(existing.id);
        } else {
            updates.push({
                budgetId,
                categoryId: cat.id,
                month,
                assigned,
                activity,
                available
            });
        }
    }

    // 5. Bulk Write
    await database.transaction(async (tx) => {
        if (deletes.length > 0) {
            await tx.delete(budgetMonths).where(inArray(budgetMonths.id, deletes));
        }
        
        if (updates.length > 0) {
             for (let i = 0; i < updates.length; i += 1000) {
                const chunk = updates.slice(i, i + 1000);
                await tx.insert(budgetMonths)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .values(chunk as any)
                    .onConflictDoUpdate({
                        target: [budgetMonths.categoryId, budgetMonths.month],
                        set: {
                            activity: sql`excluded.activity`,
                            available: sql`excluded.available`,
                            assigned: sql`excluded.assigned`
                        }
                    });
             }
        }
    });

    // 6. Handle CC Payment Categories
    const ccAccounts = await database.select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.type, 'credit'), eq(accounts.budgetId, budgetId)));

    for (const acc of ccAccounts) {
      await cc.updateCreditCardPaymentBudget(budgetId, acc.id, month);
    }
  }

  async function getBudgetInspectorData(
    budgetId: number,
    month: string,
    precomputed?: { budgetRows: BudgetRow[]; rtaBreakdown: ReturnType<typeof calculateRTABreakdown> },
  ) {
    const [yr, mo] = month.split('-').map(Number);
    const prevDate = new Date(yr, mo - 2);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const twelveMonthsAgoDate = new Date(yr, mo - 13);
    const twelveMonthsAgo = `${twelveMonthsAgoDate.getFullYear()}-${String(twelveMonthsAgoDate.getMonth() + 1).padStart(2, '0')}`;

    // ── Month Summary ──
    // Use pre-computed data when available (eliminates redundant DB calls from buildBudgetResponse)
    const breakdown = precomputed?.rtaBreakdown ?? await rta.getReadyToAssignBreakdown(budgetId, month);

    const budgetRows = precomputed?.budgetRows ?? await getBudgetForMonth(budgetId, month);

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
          AND ${notFutureDate(transactions.date)}
          AND ${yearMonth(transactions.date)} >= ${twelveMonthsAgo} AND ${yearMonth(transactions.date)} < ${month}
          AND ${accounts.budgetId} = ${budgetId}
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
        AND ${categoryGroups.budgetId} = ${budgetId}
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
      WHERE ${accounts.type} = 'credit' AND ${accounts.closed} = false AND ${accounts.budgetId} = ${budgetId}
    `);

    const underfundedTotal = m(underfundedRegularRows[0]!.total) + m(ccShortfallRows[0]!.total);

    const assignedLastMonthRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(${budgetMonths.assigned}), 0) as "total"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false AND ${categories.linkedAccountId} IS NULL 
        AND ${budgetMonths.month} = ${prevMonthStr}
        AND ${categoryGroups.budgetId} = ${budgetId}
    `);

    const spentLastMonthRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(ABS(CASE WHEN ${budgetMonths.activity} < 0 THEN ${budgetMonths.activity} ELSE 0 END)), 0) as "total"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false AND ${categories.linkedAccountId} IS NULL 
        AND ${budgetMonths.month} = ${prevMonthStr}
        AND ${categoryGroups.budgetId} = ${budgetId}
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
          AND ${categoryGroups.budgetId} = ${budgetId}
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
          AND ${categoryGroups.budgetId} = ${budgetId}
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
        AND ${categoryGroups.budgetId} = ${budgetId}
    `);

    const resetAvailableRows = await queryRows<{ total: number }>(database, sql`
      SELECT COALESCE(SUM(${budgetMonths.available}), 0) as "total"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false AND ${categories.linkedAccountId} IS NULL
        AND ${budgetMonths.available} > 0 AND ${budgetMonths.assigned} = 0 AND ${budgetMonths.activity} = 0
        AND ${budgetMonths.month} = ${month}
        AND ${categoryGroups.budgetId} = ${budgetId}
    `);

    const resetAssigned = totalAssigned;

    // ── Assigned in Future Months ──
    const futureMonths = await queryRows<{ month: string; total: number }>(database, sql`
      SELECT ${budgetMonths.month} as "month", SUM(${budgetMonths.assigned}) as "total"
      FROM ${budgetMonths}
      JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
      JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
      WHERE ${categoryGroups.isIncome} = false AND ${budgetMonths.month} > ${month} AND ${budgetMonths.assigned} != 0
        AND ${categoryGroups.budgetId} = ${budgetId}
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

  async function getMonthRange(budgetId: number): Promise<{ minMonth: string; maxMonth: string }> {
    const rows = await queryRows<{ minMonth: string | null }>(database, sql`
      SELECT to_char(MIN(${transactions.date}), 'YYYY-MM') as "minMonth"
      FROM ${transactions}
      JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
      WHERE ${accounts.budgetId} = ${budgetId}
    `);

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const maxMonth = `${now.getFullYear() + 1}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return {
      minMonth: rows[0]?.minMonth ?? currentMonth,
      maxMonth,
    };
  }

  /**
   * Move money between two categories by adjusting their assigned amounts.
   *
   * Orchestration: queries current assigned → updateBudgetAssignment(source) →
   * updateBudgetAssignment(target) → refreshAllBudgetActivity.
   *
   * All financial logic (carryforward, delta propagation, ghost entries)
   * is handled by updateBudgetAssignment.
   */
  async function moveMoney(
    budgetId: number,
    sourceCategoryId: number,
    targetCategoryId: number,
    month: string,
    amount: Milliunit,
  ) {
    return Sentry.startSpan({ op: 'db.query', name: 'moveMoney', attributes: { budgetId, sourceCategoryId, targetCategoryId, month } }, async () => {
      // Query current assigned values for both categories
      const [sourceRows, targetRows] = await Promise.all([
        database.select({ assigned: budgetMonths.assigned })
          .from(budgetMonths)
          .where(and(eq(budgetMonths.categoryId, sourceCategoryId), eq(budgetMonths.month, month))),
        database.select({ assigned: budgetMonths.assigned })
          .from(budgetMonths)
          .where(and(eq(budgetMonths.categoryId, targetCategoryId), eq(budgetMonths.month, month))),
      ]);

      const sourceAssigned = sourceRows[0] ? m(sourceRows[0].assigned) : ZERO;
      const targetAssigned = targetRows[0] ? m(targetRows[0].assigned) : ZERO;

      // Adjust: source loses amount, target gains amount
      const newSourceAssigned = (sourceAssigned - amount) as Milliunit;
      const newTargetAssigned = (targetAssigned + amount) as Milliunit;

      // Reuse existing updateBudgetAssignment for each — handles carryforward,
      // delta propagation, ghost entry prevention, and validation
      await updateBudgetAssignment(budgetId, sourceCategoryId, month, newSourceAssigned);
      await updateBudgetAssignment(budgetId, targetCategoryId, month, newTargetAssigned);

      // Refresh CC payments and activity
      await refreshAllBudgetActivity(budgetId, month);
    });
  }

  // ── Compose sub-factories ──
  const cc = createBudgetCCFunctions(database, { createCategory: deps.createCategory });
  const rta = createBudgetRTAFunctions(database, {
    getBudgetForMonth,
    getCashOverspendingForMonth: cc.getCashOverspendingForMonth,
  });

  return {
    computeCarryforward,
    getBudgetForMonth,
    ...rta,
    updateBudgetAssignment,
    moveMoney,
    updateBudgetActivity,
    refreshAllBudgetActivity,
    ...cc,
    getBudgetInspectorData,
    getMonthRange,
  };
}
