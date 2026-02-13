/**
 * Debug: Future Month Inspector & Summary Calculations
 */
import db from '../lib/db/client';
import { createDbFunctions } from '../lib/repos';
import { fromMilliunits, type Milliunit } from '../lib/engine/primitives';

const fmt = (v: number) => fromMilliunits(v as Milliunit).toLocaleString('es-CO', { minimumFractionDigits: 0 });

async function main() {
  const fns = createDbFunctions(db);

  const budgetId = 1;

  // Current month + next 3
  const now = new Date();
  const months: string[] = [];
  for (let i = -1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i);
    months.push(d.toISOString().slice(0, 7));
  }

  console.log('=== Budget Summary per Month ===\n');

  for (const month of months) {
    console.log(`--- ${month} ---`);

    // 1. RTA
    const rta = await fns.getReadyToAssign(budgetId, month);
    console.log(`  RTA: ${fmt(rta)}`);

    // 2. RTA Breakdown
    const breakdown = await fns.getReadyToAssignBreakdown(budgetId, month);
    console.log(`  RTA Breakdown:`);
    console.log(`    leftOverFromPreviousMonth: ${fmt(breakdown.leftOverFromPreviousMonth)}`);
    console.log(`    inflowThisMonth: ${fmt(breakdown.inflowThisMonth)}`);
    console.log(`    positiveCCBalances: ${fmt(breakdown.positiveCCBalances)}`);
    console.log(`    assignedThisMonth: ${fmt(breakdown.assignedThisMonth)}`);
    console.log(`    cashOverspendingPreviousMonth: ${fmt(breakdown.cashOverspendingPreviousMonth)}`);
    console.log(`    assignedInFuture: ${fmt(breakdown.assignedInFuture)}`);

    // 3. Inspector data
    const inspector = await fns.getBudgetInspectorData(budgetId, month);
    console.log(`  Inspector Summary:`);
    console.log(`    leftOverFromLastMonth: ${fmt(inspector.summary.leftOverFromLastMonth)}`);
    console.log(`    assignedThisMonth: ${fmt(inspector.summary.assignedThisMonth)}`);
    console.log(`    activity: ${fmt(inspector.summary.activity)}`);
    console.log(`    available: ${fmt(inspector.summary.available)}`);

    // 4. Budget rows data
    const budgetRows = await fns.getBudgetForMonth(budgetId, month);
    let totalAvailable = 0;
    let totalActivity = 0;
    let totalAssigned = 0;
    let rowCount = 0;
    for (const row of budgetRows) {
      if (row.categoryId !== null) {
        totalAvailable += Number(row.available) || 0;
        totalActivity += Number(row.activity) || 0;
        totalAssigned += Number(row.assigned) || 0;
        rowCount++;
      }
    }
    console.log(`  Raw getBudgetForMonth totals (${rowCount} categories):`);
    console.log(`    totalAssigned: ${fmt(totalAssigned)}`);
    console.log(`    totalActivity: ${fmt(totalActivity)}`);
    console.log(`    totalAvailable: ${fmt(totalAvailable)}`);

    console.log(`  >>> DISCREPANCY: Inspector leftOver vs RTA Breakdown leftOver: ${inspector.summary.leftOverFromLastMonth === Number(breakdown.leftOverFromPreviousMonth) ? '✅ MATCH' : '❌ MISMATCH'}`);
    console.log(`      Inspector: ${fmt(inspector.summary.leftOverFromLastMonth)} vs RTA: ${fmt(breakdown.leftOverFromPreviousMonth)}`);

    console.log('');
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
