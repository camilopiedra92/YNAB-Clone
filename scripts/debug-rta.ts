/**
 * Debug: RTA Calculation Inspector
 *
 * Prints income, assigned, and RTA for a range of months to help
 * diagnose RTA discrepancies. Uses Drizzle ORM with PostgreSQL.
 *
 * Usage:
 *   npm run db:debug-rta
 */
import { eq, and, lte, sql } from 'drizzle-orm';
import db from '../lib/repos/client';
import {
  accounts,
  categoryGroups,
  categories,
  transactions,
  budgetMonths,
} from '../lib/db/schema';
import { yearMonth } from '../lib/db/sql-helpers';
import { fromMilliunits, type Milliunit } from '../lib/engine/primitives';

async function main() {
  // Find the income category
  const incomeCatRows = await db.select({ id: categories.id })
    .from(categories)
    .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
    .where(eq(categoryGroups.isIncome, true));

  const incomeCat = incomeCatRows[0];
  if (!incomeCat) {
    console.error('No income category found!');
    process.exit(1);
  }

  console.log('Income category id:', incomeCat.id);
  console.log('\n[!WARNING] This script uses a RAW calculation. For the authoritative formula, see lib/engine/rta.ts');

  // Last 6 months dynamically
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }

  function getEndOfMonth(m: string): string {
    const [yr, mo] = m.split('-').map(Number);
    const endDate = new Date(yr, mo, 0);
    return endDate.toISOString().slice(0, 10);
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  // ── Standard: non-CC accounts, through today or month end ─────────

  for (const m of months) {
    const endStr = getEndOfMonth(m);
    const cashDate = endStr < todayStr ? endStr : todayStr;

    const incomeRows = await db.select({
      total: sql<number>`COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0)`,
    })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(
        eq(transactions.categoryId, incomeCat.id),
        sql`${accounts.type} != 'credit'`,
        lte(transactions.date, cashDate),
      ));

    const assignedRows = await db.select({
      total: sql<number>`COALESCE(SUM(${budgetMonths.assigned}), 0)`,
    })
      .from(budgetMonths)
      .innerJoin(categories, eq(budgetMonths.categoryId, categories.id))
      .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
      .where(and(
        eq(categoryGroups.isIncome, false),
        lte(budgetMonths.month, m),
      ));

    const income = incomeRows[0];
    const assigned = assignedRows[0];
    const incomeVal = Number(income?.total) || 0;
    const assignedVal = Number(assigned?.total) || 0;
    const rta = incomeVal - assignedVal;
    
    console.log(`${m}: income_thru=${fromMilliunits(incomeVal as Milliunit).toFixed(2)} assigned_thru=${fromMilliunits(assignedVal as Milliunit).toFixed(2)} RTA=${fromMilliunits(rta as Milliunit).toFixed(2)}`);
  }

  // ── Including CC account income ───────────────────────────────────

  console.log('\n--- Including CC account income ---');
  for (const m of months) {
    const endStr = getEndOfMonth(m);
    const cashDate = endStr < todayStr ? endStr : todayStr;

    const incomeRows = await db.select({
      total: sql<number>`COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0)`,
    })
      .from(transactions)
      .where(and(
        eq(transactions.categoryId, incomeCat.id),
        lte(transactions.date, cashDate),
      ));

    const assignedRows = await db.select({
      total: sql<number>`COALESCE(SUM(${budgetMonths.assigned}), 0)`,
    })
      .from(budgetMonths)
      .innerJoin(categories, eq(budgetMonths.categoryId, categories.id))
      .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
      .where(and(
        eq(categoryGroups.isIncome, false),
        lte(budgetMonths.month, m),
      ));

    const income = incomeRows[0];
    const assigned = assignedRows[0];
    const incomeVal = Number(income?.total) || 0;
    const assignedVal = Number(assigned?.total) || 0;
    const rta = incomeVal - assignedVal;
    console.log(`${m}: income_thru=${fromMilliunits(incomeVal as Milliunit).toFixed(2)} assigned_thru=${fromMilliunits(assignedVal as Milliunit).toFixed(2)} RTA=${fromMilliunits(rta as Milliunit).toFixed(2)}`);
  }

  // ── Income through month end (including future txns), all accounts ─

  console.log('\n--- Income through month end (incl future txns in month), all accounts ---');
  for (const m of months) {
    const endStr = getEndOfMonth(m);

    const incomeRows = await db.select({
      total: sql<number>`COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0)`,
    })
      .from(transactions)
      .where(and(
        eq(transactions.categoryId, incomeCat.id),
        lte(transactions.date, endStr),
      ));

    const assignedRows = await db.select({
      total: sql<number>`COALESCE(SUM(${budgetMonths.assigned}), 0)`,
    })
      .from(budgetMonths)
      .innerJoin(categories, eq(budgetMonths.categoryId, categories.id))
      .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
      .where(and(
        eq(categoryGroups.isIncome, false),
        lte(budgetMonths.month, m),
      ));

    const income = incomeRows[0];
    const assigned = assignedRows[0];
    const incomeVal = Number(income?.total) || 0;
    const assignedVal = Number(assigned?.total) || 0;
    const rta = incomeVal - assignedVal;
    console.log(`${m}: income_thru=${fromMilliunits(incomeVal as Milliunit).toFixed(2)} assigned_thru=${fromMilliunits(assignedVal as Milliunit).toFixed(2)} RTA=${fromMilliunits(rta as Milliunit).toFixed(2)}`);
  }

  // ── Income by yearMonth, all accounts ────────────────────────

  console.log('\n--- Income by month (yearMonth), all accounts ---');
  for (const m of months) {
    const incomeRows = await db.select({
      total: sql<number>`COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0)`,
    })
      .from(transactions)
      .where(and(
        eq(transactions.categoryId, incomeCat.id),
        sql`${yearMonth(transactions.date)} <= ${m}`,
      ));

    const assignedRows = await db.select({
      total: sql<number>`COALESCE(SUM(${budgetMonths.assigned}), 0)`,
    })
      .from(budgetMonths)
      .innerJoin(categories, eq(budgetMonths.categoryId, categories.id))
      .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
      .where(and(
        eq(categoryGroups.isIncome, false),
        lte(budgetMonths.month, m),
      ));

    const income = incomeRows[0];
    const assigned = assignedRows[0];
    const incomeVal = Number(income?.total) || 0;
    const assignedVal = Number(assigned?.total) || 0;
    const rta = incomeVal - assignedVal;
    console.log(`${m}: income_thru=${fromMilliunits(incomeVal as Milliunit).toFixed(2)} assigned_thru=${fromMilliunits(assignedVal as Milliunit).toFixed(2)} RTA=${fromMilliunits(rta as Milliunit).toFixed(2)}`);
  }
}

main().catch(console.error);
