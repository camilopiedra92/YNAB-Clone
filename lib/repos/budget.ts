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
import { eq, and, sql, gt, inArray } from 'drizzle-orm';
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
    // Single composite query: get previous month's available AND isCCPayment in one round-trip
    const rows = await queryRows<{ available: number | null; linkedAccountId: number | null }>(database, sql`
      SELECT bm.available as "available", c.linked_account_id as "linkedAccountId"
      FROM ${budgetMonths} bm
      JOIN ${categories} c ON bm.category_id = c.id
      JOIN ${categoryGroups} cg ON c.category_group_id = cg.id
      WHERE bm.category_id = ${categoryId}
        AND bm.month < ${targetMonth}
        AND cg.budget_id = ${budgetId}
      ORDER BY bm.month DESC
      LIMIT 1
    `);

    if (rows.length > 0) {
      return engineCarryforward(rows[0].available !== null ? m(rows[0].available) : null, !!rows[0].linkedAccountId);
    }

    // Fallback: no previous month data — still need linkedAccountId to determine CC payment category
    const categoryRows = await database.select({ linkedAccountId: categories.linkedAccountId })
      .from(categories)
      .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
      .where(eq(categories.id, categoryId));
    return engineCarryforward(null, !!categoryRows[0]?.linkedAccountId);
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
    // ── Query phase (3 independent queries run in parallel) ──
    const [activityRows, carryforward, existingRows] = await Promise.all([
      queryRows<{ activity: number }>(database, sql`
        SELECT COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0) as "activity"
        FROM ${transactions}
        JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
        WHERE ${transactions.categoryId} = ${categoryId} 
          AND ${yearMonth(transactions.date)} = ${month} 
          AND ${notFutureDate(transactions.date)}
          AND ${accounts.budgetId} = ${budgetId}
      `),
      computeCarryforward(budgetId, categoryId, month),
      database.select({ assigned: budgetMonths.assigned })
        .from(budgetMonths)
        .where(and(eq(budgetMonths.categoryId, categoryId), eq(budgetMonths.month, month))),
    ]);

    const activity = m(activityRows[0]!.activity);
    const existing = existingRows[0];

    const assigned = m(existing?.assigned);

    // ── Compute phase: delegate to engine ──
    const available = calculateBudgetAvailable(carryforward as Milliunit, assigned, activity);

    // ── Write phase ──
    if (existing) {
      await database.update(budgetMonths)
        .set({ activity, available })
        .where(and(eq(budgetMonths.categoryId, categoryId), eq(budgetMonths.month, month)));
    } else {
      await database.insert(budgetMonths)
        .values({ budgetId, categoryId, month, assigned: ZERO, activity, available });
    }

    // ── Propagate available to subsequent months ──
    // If future months have existing budget_months rows, their carryforward may be stale.
    const futureRows = await queryRows<{
      month: string; assigned: number; activity: number;
      available: number; linkedAccountId: number | null;
    }>(database, sql`
      SELECT bm.month, bm.assigned, bm.activity, bm.available,
             c.linked_account_id as "linkedAccountId"
      FROM ${budgetMonths} bm
      JOIN ${categories} c ON bm.category_id = c.id
      WHERE bm.category_id = ${categoryId} AND bm.month > ${month}
      ORDER BY bm.month ASC
    `);

    if (futureRows.length > 0) {
      let prevAvailable = available;
      const categoryLinkedAccountId = futureRows[0].linkedAccountId;
      const isCCPayment = !!categoryLinkedAccountId;

      for (const row of futureRows) {
        const cf = engineCarryforward(prevAvailable, isCCPayment);
        const newAvailable = calculateBudgetAvailable(cf, m(row.assigned), m(row.activity));

        if (newAvailable !== Number(row.available)) {
          if (Number(row.assigned) === 0 && Number(row.activity) === 0 && newAvailable === 0) {
            await database.execute(sql`
              DELETE FROM ${budgetMonths}
              WHERE ${budgetMonths.categoryId} = ${categoryId}
                AND ${budgetMonths.month} = ${row.month}
            `);
          } else {
            await database.execute(sql`
              UPDATE ${budgetMonths}
              SET available = ${newAvailable}
              WHERE ${budgetMonths.categoryId} = ${categoryId}
                AND ${budgetMonths.month} = ${row.month}
            `);
          }
        }

        prevAvailable = newAvailable;
      }
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

    // 6. Handle CC Payment Categories (batch — single operation for all CC accounts)
    await cc.batchUpdateAllCCPayments(budgetId, month);

    // 7. Propagate available changes to subsequent months (ALL categories).
    // After steps 5+6 updated the current month, subsequent months that have
    // existing budget_months rows may have stale carryforward values.
    // This covers BOTH regular categories AND CC payment categories.
    const currentMonthRows = await queryRows<{
      categoryId: number; available: number; linkedAccountId: number | null;
    }>(database, sql`
      SELECT bm.category_id as "categoryId", bm.available,
             c.linked_account_id as "linkedAccountId"
      FROM ${budgetMonths} bm
      JOIN ${categories} c ON bm.category_id = c.id
      JOIN ${categoryGroups} cg ON c.category_group_id = cg.id
      WHERE bm.month = ${month} AND cg.budget_id = ${budgetId}
    `);

    if (currentMonthRows.length > 0) {
      const currentAvailableMap = new Map<number, Milliunit>();
      const linkedMap = new Map<number, boolean>();
      const allCatIds: number[] = [];
      for (const row of currentMonthRows) {
        currentAvailableMap.set(row.categoryId, m(row.available));
        linkedMap.set(row.categoryId, !!row.linkedAccountId);
        allCatIds.push(row.categoryId);
      }

      // Get all subsequent months that have budget_months rows for these categories
      const futureRows = await queryRows<{
        categoryId: number; month: string; assigned: number; activity: number;
        available: number; linkedAccountId: number | null;
      }>(database, sql`
        SELECT bm.category_id as "categoryId", bm.month, bm.assigned, bm.activity,
               bm.available, c.linked_account_id as "linkedAccountId"
        FROM ${budgetMonths} bm
        JOIN ${categories} c ON bm.category_id = c.id
        JOIN ${categoryGroups} cg ON c.category_group_id = cg.id
        WHERE bm.month > ${month}
          AND cg.budget_id = ${budgetId}
          AND bm.category_id IN ${sql.raw(`(${allCatIds.join(',')})`)}
        ORDER BY bm.category_id, bm.month ASC
      `);

      if (futureRows.length > 0) {
        // Group by category, process each month sequentially (carryforward chains)
        const byCat = new Map<number, typeof futureRows>();
        for (const row of futureRows) {
          if (!byCat.has(row.categoryId)) byCat.set(row.categoryId, []);
          byCat.get(row.categoryId)!.push(row);
        }

        const futureUpdates: { categoryId: number; month: string; available: Milliunit }[] = [];
        const futureDeletes: { categoryId: number; month: string }[] = [];

        for (const [catId, rows] of byCat) {
          let prevAvailable = currentAvailableMap.get(catId) ?? ZERO;
          const isCCPayment = linkedMap.get(catId) ?? false;

          for (const row of rows) {
            const cf = engineCarryforward(prevAvailable, isCCPayment);
            const newAvailable = calculateBudgetAvailable(cf, m(row.assigned), m(row.activity));

            if (newAvailable !== Number(row.available)) {
              if (Number(row.assigned) === 0 && Number(row.activity) === 0 && newAvailable === 0) {
                futureDeletes.push({ categoryId: catId, month: row.month });
              } else {
                futureUpdates.push({ categoryId: catId, month: row.month, available: newAvailable });
              }
            }

            prevAvailable = newAvailable;
          }
        }

        // Bulk-write propagated changes
        if (futureUpdates.length > 0 || futureDeletes.length > 0) {
          await database.transaction(async (tx) => {
            for (const upd of futureUpdates) {
              await tx.execute(sql`
                UPDATE ${budgetMonths}
                SET available = ${upd.available}
                WHERE ${budgetMonths.categoryId} = ${upd.categoryId}
                  AND ${budgetMonths.month} = ${upd.month}
              `);
            }
            for (const del of futureDeletes) {
              await tx.execute(sql`
                DELETE FROM ${budgetMonths}
                WHERE ${budgetMonths.categoryId} = ${del.categoryId}
                  AND ${budgetMonths.month} = ${del.month}
              `);
            }
          });
        }
      }
    }
  }

  async function getBudgetInspectorData(
    budgetId: number,
    month: string,
    precomputed?: { budgetRows?: BudgetRow[]; rtaBreakdown?: ReturnType<typeof calculateRTABreakdown>; assignedThisMonth?: number },
  ) {
    const [yr, mo] = month.split('-').map(Number);
    const prevDate = new Date(yr, mo - 2);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const twelveMonthsAgoDate = new Date(yr, mo - 13);
    const twelveMonthsAgo = `${twelveMonthsAgoDate.getFullYear()}-${String(twelveMonthsAgoDate.getMonth() + 1).padStart(2, '0')}`;

    // ── Month Summary ──
    // Use pre-computed data when available (eliminates redundant DB calls from buildBudgetResponse)
    const budgetRows = precomputed?.budgetRows ?? await getBudgetForMonth(budgetId, month);

    let totalAvailable = 0;
    let totalActivity = 0;
    let computedAssigned = 0;
    for (const row of budgetRows) {
      if (row.categoryId !== null) {
        totalAvailable += row.available || 0;
        totalActivity += row.activity || 0;
        computedAssigned += row.assigned || 0;
      }
    }

    // Use precomputed assignedThisMonth (from rtaBreakdown or direct), or compute from rows
    const totalAssigned = precomputed?.assignedThisMonth ?? precomputed?.rtaBreakdown?.assignedThisMonth ?? computedAssigned;
    const leftOverFromLastMonth = totalAvailable - totalAssigned - totalActivity;

    // ── Cost to Be Me ── + ── Auto-Assign ── + ── Future ──
    // Consolidated: current + previous month budget_months aggregates in 1 query via conditional FILTER
    const [
      budgetAggs,
      ccShortfallRows,
      avgRows,
      expectedIncomeRows,
      futureMonths,
    ] = await Promise.all([
      // 1. Current + previous month aggregates (merged — same base tables)
      queryRows<{
        underfunded: number; reduceOverfunding: number; resetAvailable: number;
        assignedLastMonth: number; spentLastMonth: number;
      }>(database, sql`
        SELECT
          COALESCE(SUM(ABS(${budgetMonths.available})) FILTER (
            WHERE ${budgetMonths.month} = ${month}
              AND ${budgetMonths.available} < 0 AND ${categories.linkedAccountId} IS NULL
          ), 0) AS "underfunded",
          COALESCE(SUM(${budgetMonths.available} - ${budgetMonths.assigned}) FILTER (
            WHERE ${budgetMonths.month} = ${month}
              AND ${budgetMonths.available} > ${budgetMonths.assigned}
              AND ${budgetMonths.assigned} > 0 AND ${budgetMonths.activity} >= 0
              AND ${categories.linkedAccountId} IS NULL
          ), 0) AS "reduceOverfunding",
          COALESCE(SUM(${budgetMonths.available}) FILTER (
            WHERE ${budgetMonths.month} = ${month}
              AND ${budgetMonths.available} > 0
              AND ${budgetMonths.assigned} = 0 AND ${budgetMonths.activity} = 0
              AND ${categories.linkedAccountId} IS NULL
          ), 0) AS "resetAvailable",
          COALESCE(SUM(${budgetMonths.assigned}) FILTER (
            WHERE ${budgetMonths.month} = ${prevMonthStr}
              AND ${categories.linkedAccountId} IS NULL
          ), 0) AS "assignedLastMonth",
          COALESCE(SUM(ABS(CASE WHEN ${budgetMonths.activity} < 0 THEN ${budgetMonths.activity} ELSE 0 END)) FILTER (
            WHERE ${budgetMonths.month} = ${prevMonthStr}
              AND ${categories.linkedAccountId} IS NULL
          ), 0) AS "spentLastMonth"
        FROM ${budgetMonths}
        JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
        JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
        WHERE ${categoryGroups.isIncome} = false
          AND ${budgetMonths.month} IN (${month}, ${prevMonthStr})
          AND ${categoryGroups.budgetId} = ${budgetId}
      `),

      // 2. CC shortfall (separate table: accounts)
      queryRows<{ total: number }>(database, sql`
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
      `),

      // 3. 12-month averages: avgAssigned + avgSpent
      queryRows<{ avgAssigned: number; avgSpent: number }>(database, sql`
        SELECT
          COALESCE(AVG("monthlyAssigned"), 0) AS "avgAssigned",
          COALESCE(AVG("monthlySpent"), 0) AS "avgSpent"
        FROM (
          SELECT ${budgetMonths.month},
            SUM(${budgetMonths.assigned}) AS "monthlyAssigned",
            SUM(ABS(CASE WHEN ${budgetMonths.activity} < 0 THEN ${budgetMonths.activity} ELSE 0 END)) AS "monthlySpent"
          FROM ${budgetMonths}
          JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
          JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
          WHERE ${categoryGroups.isIncome} = false AND ${categories.linkedAccountId} IS NULL
            AND ${budgetMonths.month} >= ${twelveMonthsAgo} AND ${budgetMonths.month} < ${month}
            AND ${categoryGroups.budgetId} = ${budgetId}
          GROUP BY ${budgetMonths.month}
        ) sub
      `),

      // 4. Expected income (separate table: transactions)
      queryRows<{ avgTotal: number }>(database, sql`
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
      `),

      // 5. Future months (assigned in future)
      queryRows<{ month: string; total: number }>(database, sql`
        SELECT ${budgetMonths.month} as "month", SUM(${budgetMonths.assigned}) as "total"
        FROM ${budgetMonths}
        JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
        JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
        WHERE ${categoryGroups.isIncome} = false AND ${budgetMonths.month} > ${month} AND ${budgetMonths.assigned} != 0
          AND ${categoryGroups.budgetId} = ${budgetId}
        GROUP BY ${budgetMonths.month}
        ORDER BY ${budgetMonths.month}
      `),
    ]);

    const underfundedTotal = m(budgetAggs[0]!.underfunded) + m(ccShortfallRows[0]!.total);

    const resetAssigned = totalAssigned;

    return {
      summary: {
        leftOverFromLastMonth,
        assignedThisMonth: totalAssigned,
        activity: totalActivity,
        available: totalAvailable,
      },
      costToBeMe: {
        targets: totalAssigned,
        expectedIncome: m(expectedIncomeRows[0]!.avgTotal) || 0,
      },
      autoAssign: {
        underfunded: underfundedTotal,
        assignedLastMonth: m(budgetAggs[0]!.assignedLastMonth),
        spentLastMonth: m(budgetAggs[0]!.spentLastMonth),
        averageAssigned: m(avgRows[0]!.avgAssigned),
        averageSpent: m(avgRows[0]!.avgSpent),
        reduceOverfunding: m(budgetAggs[0]!.reduceOverfunding),
        resetAvailableAmounts: m(budgetAggs[0]!.resetAvailable),
        resetAssignedAmounts: resetAssigned,
      },
      futureAssignments: {
        total: m(futureMonths.reduce((acc: number, fm: { month: string; total: number }) => acc + fm.total, 0)),
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

      // Run both assignment updates in parallel — they target different categories
      // and are fully independent (carryforward, delta propagation, ghost entries)
      await Promise.all([
        updateBudgetAssignment(budgetId, sourceCategoryId, month, newSourceAssigned),
        updateBudgetAssignment(budgetId, targetCategoryId, month, newTargetAssigned),
      ]);

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
