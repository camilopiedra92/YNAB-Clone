const Database = require('better-sqlite3');
const db = new Database('./db/ynab.db');

// User insight: RTA = cumulative income - cumulative assigned
// Income = all transactions categorized as "Inflow: Ready to Assign" (category_id = 31 in Inflow group)
// Assigned = sum of 'assigned' column in budget_months for non-income categories

// Find the income category
const incomeCat = db.prepare(`
  SELECT c.id FROM categories c
  JOIN category_groups cg ON c.category_group_id = cg.id
  WHERE cg.is_income = 1
`).get();
console.log('Income category id:', incomeCat.id);

const months = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'];

for (const m of months) {
    // Cumulative income through month M (on non-CC accounts, through end of month or today)
    const parts = m.split('-');
    const yr = parseInt(parts[0]);
    const mo = parseInt(parts[1]);
    const endDate = new Date(yr, mo, 0);
    const endStr = endDate.toISOString().slice(0, 10);
    const today = '2026-02-07';
    const cashDate = endStr < today ? endStr : today;

    // Total income: all Inflow:Ready to Assign transactions through the month
    // Only on non-CC accounts, only through cashDate (to exclude future)
    const income = db.prepare(`
    SELECT COALESCE(SUM(t.inflow - t.outflow), 0) as total
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE t.category_id = ? AND a.type != 'credit' AND t.date <= ?
  `).get(incomeCat.id, cashDate);

    // Cumulative assigned through month M (all non-income categories, all months up to M)
    const assigned = db.prepare(`
    SELECT COALESCE(SUM(bm.assigned), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND bm.month <= ?
  `).get(m);

    const rta = income.total - assigned.total;
    console.log(m + ': income_thru=' + income.total.toFixed(0) + ' assigned_thru=' + assigned.total.toFixed(0) + ' RTA=' + rta.toFixed(0));
}

// Also try: include ALL income (even on CC accounts) 
console.log('\n--- Including CC account income ---');
for (const m of months) {
    const parts = m.split('-');
    const yr = parseInt(parts[0]);
    const mo = parseInt(parts[1]);
    const endDate = new Date(yr, mo, 0);
    const endStr = endDate.toISOString().slice(0, 10);
    const today = '2026-02-07';
    const cashDate = endStr < today ? endStr : today;

    const income = db.prepare(`
    SELECT COALESCE(SUM(t.inflow - t.outflow), 0) as total
    FROM transactions t
    WHERE t.category_id = ? AND t.date <= ?
  `).get(incomeCat.id, cashDate);

    const assigned = db.prepare(`
    SELECT COALESCE(SUM(bm.assigned), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND bm.month <= ?
  `).get(m);

    const rta = income.total - assigned.total;
    console.log(m + ': income_thru=' + income.total.toFixed(0) + ' assigned_thru=' + assigned.total.toFixed(0) + ' RTA=' + rta.toFixed(0));
}

// Also check: cumulative income (all accounts) through month, including FUTURE months
console.log('\n--- Income through month end (incl future txns in month), all accounts ---');
for (const m of months) {
    const parts = m.split('-');
    const yr = parseInt(parts[0]);
    const mo = parseInt(parts[1]);
    const endDate = new Date(yr, mo, 0);
    const endStr = endDate.toISOString().slice(0, 10);

    const income = db.prepare(`
    SELECT COALESCE(SUM(t.inflow - t.outflow), 0) as total
    FROM transactions t
    WHERE t.category_id = ? AND t.date <= ?
  `).get(incomeCat.id, endStr);

    const assigned = db.prepare(`
    SELECT COALESCE(SUM(bm.assigned), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND bm.month <= ?
  `).get(m);

    const rta = income.total - assigned.total;
    console.log(m + ': income_thru=' + income.total.toFixed(0) + ' assigned_thru=' + assigned.total.toFixed(0) + ' RTA=' + rta.toFixed(0));
}

// Try: income by strftime month instead of date
console.log('\n--- Income by month (strftime), all accounts ---');
for (const m of months) {
    const income = db.prepare(`
    SELECT COALESCE(SUM(t.inflow - t.outflow), 0) as total
    FROM transactions t
    WHERE t.category_id = ? AND strftime('%Y-%m', t.date) <= ?
  `).get(incomeCat.id, m);

    const assigned = db.prepare(`
    SELECT COALESCE(SUM(bm.assigned), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND bm.month <= ?
  `).get(m);

    const rta = income.total - assigned.total;
    console.log(m + ': income_thru=' + income.total.toFixed(0) + ' assigned_thru=' + assigned.total.toFixed(0) + ' RTA=' + rta.toFixed(0));
}

db.close();
