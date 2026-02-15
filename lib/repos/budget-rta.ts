/**
 * Budget RTA Repository — Ready to Assign + Breakdown queries.
 *
 * Extracted from budget.ts for domain cohesion.
 * Pure orchestration: queries → engine → return.
 */
import { sql } from 'drizzle-orm';
import { accounts, categories, categoryGroups, budgetMonths, transactions } from '../db/schema';
import { yearMonth, notFutureDate } from '../db/sql-helpers';
import type { DrizzleDB } from '../db/helpers';
import { queryRows } from '../db/helpers';
import * as Sentry from '@sentry/nextjs';
import {
  calculateRTA,
  calculateRTABreakdown,
  ZERO,
  type Milliunit,
} from '../engine';
import type { BudgetRow } from './budget';

/** Cast a DB value to Milliunit (values are already integers from BIGINT columns). */
const m = (v: unknown): Milliunit => (Number(v) || 0) as Milliunit;

export interface BudgetRTADeps {
  getBudgetForMonth: (budgetId: number, month: string) => Promise<BudgetRow[]>;
  getCashOverspendingForMonth: (budgetId: number, month: string) => Promise<Milliunit>;
}

/** Return type for getReadyToAssign — includes intermediates for downstream reuse. */
export interface RTAResult {
  rta: Milliunit;
  positiveCCBalances: Milliunit;
  assignedInFuture: Milliunit;
}

export function createBudgetRTAFunctions(
  database: DrizzleDB,
  deps: BudgetRTADeps,
) {

  /**
   * Compute Ready to Assign and return intermediates for downstream reuse.
   * Returns { rta, positiveCCBalances } so the breakdown can skip its duplicate CC query.
   */
  async function getReadyToAssign(budgetId: number, month: string): Promise<RTAResult> {
    return Sentry.startSpan({ op: 'db.query', name: 'getReadyToAssign', attributes: { budgetId, month } }, async () => {
    // ── Query phase (Round 1: 3 independent queries in parallel) ──
    const [cashRows, ccRows, latestMonthRows] = await Promise.all([
      // 1. Cash on hand
      queryRows<{ total: number }>(database, sql`
        SELECT COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0) as "total"
        FROM ${transactions}
        JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
        WHERE ${accounts.type} != 'credit' AND ${notFutureDate(transactions.date)} AND ${accounts.budgetId} = ${budgetId}
      `),
      // 2. Positive CC balances
      queryRows<{ total: number }>(database, sql`
        SELECT COALESCE(SUM("positiveBalance"), 0) as "total"
        FROM (
          SELECT GREATEST(0, COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0)) as "positiveBalance"
          FROM ${transactions}
          JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
          WHERE ${accounts.type} = 'credit' AND ${notFutureDate(transactions.date)} AND ${accounts.budgetId} = ${budgetId}
          GROUP BY ${accounts.id}
        ) sub
      `),
      // 3. Latest month with ANY budget data (constrained to <= viewed month)
      // Ghost entries are prevented at the source: updateBudgetAssignment deletes
      // rows where assigned=0 AND activity=0 AND available=0.
      queryRows<{ month: string }>(database, sql`
        SELECT MAX(month) as "month" FROM ${budgetMonths}
        JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
        JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
        WHERE ${categoryGroups.budgetId} = ${budgetId}
          AND month <= ${month}
      `),
    ]);

    const positiveCCBalances = m(ccRows[0]!.total);
    const latestMonth = latestMonthRows[0];

    if (!latestMonth?.month) {
      return {
        rta: (m(cashRows[0]!.total) + positiveCCBalances) as Milliunit,
        positiveCCBalances,
        assignedInFuture: ZERO,
      };
    }

    // ── Query phase (Round 2: 3 dependent queries in parallel) ──
    const [budgetRows, futureAssignedRows, cashOverspendingAmount] = await Promise.all([
      // 4. Sum available using getBudgetForMonth (handles carryforward for missing rows)
      // Per MEMORY §4c: aggregate queries MUST use getBudgetForMonth(), not raw SQL SUM.
      deps.getBudgetForMonth(budgetId, latestMonth.month),
      // 4b. Future assigned
      queryRows<{ total: number }>(database, sql`
        SELECT COALESCE(SUM(${budgetMonths.assigned}), 0) as "total"
        FROM ${budgetMonths}
        JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
        JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
        WHERE ${categoryGroups.isIncome} = false 
          AND ${budgetMonths.month} > ${latestMonth.month} 
          AND ${budgetMonths.month} <= ${month}
          AND ${categoryGroups.budgetId} = ${budgetId}
      `),
      // 5. Cash overspending
      deps.getCashOverspendingForMonth(budgetId, latestMonth.month),
    ]);

    let totalAvailableVal = ZERO as Milliunit;
    let totalOverspendingVal = ZERO as Milliunit;
    for (const row of budgetRows) {
      if (row.categoryId !== null) {
        totalAvailableVal = (totalAvailableVal + row.available) as Milliunit;
        // Overspending: non-CC-payment categories with negative available
        if (row.available < 0 && !row.linkedAccountId) {
          totalOverspendingVal = (totalOverspendingVal + Math.abs(row.available)) as Milliunit;
        }
      }
    }

    // ── Compute phase: delegate to engine ──
    const assignedInFuture = m(futureAssignedRows[0]!.total);
    const rta = calculateRTA({
      cashBalance: m(cashRows[0]!.total),
      positiveCCBalances,
      totalAvailable: totalAvailableVal,
      futureAssigned: assignedInFuture,
      totalOverspending: totalOverspendingVal,
      cashOverspending: cashOverspendingAmount,
      currentMonth: new Date().toISOString().slice(0, 7),
      viewedMonth: month,
    });

    return { rta, positiveCCBalances, assignedInFuture };
    }); // end Sentry span
  }

  async function getReadyToAssignBreakdown(
    budgetId: number,
    month: string,
    precomputed?: { rta?: Milliunit; positiveCCBalances?: Milliunit; assignedInFuture?: Milliunit },
  ) {
    // ── Query phase ──
    const [yr, mo] = month.split('-').map(Number);
    const prevDate = new Date(yr, mo - 2);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    // Build query list — skip queries when pre-computed values are available
    const queries: Promise<unknown>[] = [
      // ➕ Inflow: Ready to Assign in current month (cash-based accounts only)
      queryRows<{ total: number }>(database, sql`
        SELECT COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0) as "total"
        FROM ${transactions}
        JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
        JOIN ${categories} ON ${transactions.categoryId} = ${categories.id}
        JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
        WHERE ${categoryGroups.isIncome} = true
          AND ${accounts.type} != 'credit'
          AND ${yearMonth(transactions.date)} = ${month}
          AND ${notFutureDate(transactions.date)}
          AND ${categoryGroups.budgetId} = ${budgetId}
      `),
      // ➕ Positive CC balances — skip if precomputed
      precomputed?.positiveCCBalances !== undefined
        ? Promise.resolve(null)
        : queryRows<{ total: number }>(database, sql`
            SELECT COALESCE(SUM("positiveBalance"), 0) as "total"
            FROM (
              SELECT GREATEST(0, COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0)) as "positiveBalance"
              FROM ${transactions}
              JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
              WHERE ${accounts.type} = 'credit' AND ${notFutureDate(transactions.date)} AND ${accounts.budgetId} = ${budgetId}
              GROUP BY ${accounts.id}
            ) sub
          `),
      // ➖ Assigned in current month
      queryRows<{ total: number }>(database, sql`
        SELECT COALESCE(SUM(${budgetMonths.assigned}), 0) as "total"
        FROM ${budgetMonths}
        JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
        JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
        WHERE ${categoryGroups.isIncome} = false AND ${budgetMonths.month} = ${month} AND ${categoryGroups.budgetId} = ${budgetId}
      `),
      // ➖ Assigned in future — skip if precomputed from getReadyToAssign
      precomputed?.assignedInFuture !== undefined
        ? Promise.resolve(null)
        : queryRows<{ total: number }>(database, sql`
            SELECT COALESCE(SUM(${budgetMonths.assigned}), 0) as "total"
            FROM ${budgetMonths}
            JOIN ${categories} ON ${budgetMonths.categoryId} = ${categories.id}
            JOIN ${categoryGroups} ON ${categories.categoryGroupId} = ${categoryGroups.id}
            WHERE ${categoryGroups.isIncome} = false AND ${budgetMonths.month} > ${month} AND ${categoryGroups.budgetId} = ${budgetId}
          `),
      // ➖ Cash overspending from previous month
      deps.getCashOverspendingForMonth(budgetId, prevMonth),
      // RTA (skip if pre-computed by caller)
      precomputed?.rta !== undefined
        ? Promise.resolve(precomputed.rta)
        : getReadyToAssign(budgetId, month).then(r => r.rta),
    ];

    const [inflowRows, positiveCCRows, assignedThisMonthRows, assignedInFutureRows, cashOverspendingTotal, rta] =
      await Promise.all(queries) as [
        { total: number }[],
        { total: number }[] | null,
        { total: number }[],
        { total: number }[] | null,
        Milliunit,
        Milliunit,
      ];

    // Use precomputed values or query results
    const positiveCCBalances = precomputed?.positiveCCBalances ?? m(positiveCCRows![0]!.total);
    const assignedInFuture = precomputed?.assignedInFuture ?? m(assignedInFutureRows![0]!.total);

    // ── Compute phase: delegate to engine ──
    return calculateRTABreakdown({
      rta: rta as Milliunit,
      inflowThisMonth: m(inflowRows[0]!.total),
      positiveCCBalances,
      assignedThisMonth: m(assignedThisMonthRows[0]!.total),
      cashOverspendingPreviousMonth: cashOverspendingTotal,
      assignedInFuture,
    });
  }

  return {
    getReadyToAssign,
    getReadyToAssignBreakdown,
  };
}
