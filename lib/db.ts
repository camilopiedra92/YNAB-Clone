import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'db', 'ynab.db');
const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');

// Ensure db directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create or open database
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema if database is new
if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  console.log('Database schema initialized');
}

export default db;

// Helper functions
export function getAccounts() {
  return db.prepare('SELECT * FROM accounts ORDER BY name').all();
}

export function getAccount(id: number) {
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
}

export function createAccount(account: {
  name: string;
  type: string;
  balance?: number;
}) {
  const stmt = db.prepare(`
    INSERT INTO accounts (name, type, balance, cleared_balance, uncleared_balance)
    VALUES (?, ?, ?, ?, ?)
  `);
  const balance = account.balance || 0;
  return stmt.run(account.name, account.type, balance, balance, 0);
}

export function updateAccount(id: number, updates: {
  name?: string;
  note?: string;
  closed?: boolean;
}) {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.note !== undefined) {
    fields.push('note = ?');
    values.push(updates.note);
  }
  if (updates.closed !== undefined) {
    fields.push('closed = ?');
    values.push(updates.closed ? 1 : 0);
  }

  if (fields.length === 0) return;

  values.push(id);
  const stmt = db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`);
  return stmt.run(...values);
}

export function getCategoryGroups() {
  return db.prepare(`
    SELECT * FROM category_groups 
    ORDER BY sort_order, name
  `).all();
}

export function getCategories(groupId?: number) {
  if (groupId) {
    return db.prepare(`
      SELECT * FROM categories 
      WHERE category_group_id = ?
      ORDER BY sort_order, name
    `).all(groupId);
  }
  return db.prepare(`
    SELECT c.*, cg.name as group_name 
    FROM categories c
    JOIN category_groups cg ON c.category_group_id = cg.id
    ORDER BY cg.sort_order, c.sort_order, c.name
  `).all();
}

export function getBudgetForMonth(month: string) {
  return db.prepare(`
    SELECT 
      CASE WHEN c.id IS NOT NULL THEN COALESCE(bm.id, -c.id) ELSE NULL END as id,
      c.id as category_id,
      c.name as category_name,
      cg.id as category_group_id,
      cg.name as group_name,
      cg.hidden as group_hidden,
      COALESCE(bm.month, ?) as month,
      COALESCE(bm.assigned, 0) as assigned,
      COALESCE(bm.activity, 0) as activity,
      COALESCE(bm.available, 0) as available,
      c.linked_account_id
    FROM category_groups cg
    LEFT JOIN categories c ON c.category_group_id = cg.id
    LEFT JOIN budget_months bm ON c.id = bm.category_id AND bm.month = ?
    WHERE cg.is_income = 0
    ORDER BY cg.sort_order, c.sort_order
  `).all(month, month);
}

/**
 * Calculates the YNAB Ready to Assign value.
 *
 * YNAB Definition: "Ready to Assign is money in cash-based accounts (like Checking)
 * that is not assigned to spending categories."
 *
 * Formula:
 *   RTA = Cash Balance (non-CC accounts, date ≤ today)
 *       + Positive CC Balances (cashback / overpayments — bank owes user)
 *       − Sum of category Available (latest budget month, cumulative)
 *
 * The `available` column is CUMULATIVE in YNAB — it carries forward from month to
 * month and already accounts for:
 *   - All assigned amounts (current + past)
 *   - All activity (spending, refunds)
 *   - CC spending auto-moves (category → CC Payment)
 *   - Cash overspending resets at month boundaries
 *   - Credit overspending (stays as unfunded debt on CC Payment category)
 *
 * Edge Cases Covered:
 *   1. Positive CC balances (cashback): treated as cash, added to RTA
 *   2. Inflow from debt accounts (cash advances): positive CC balance portion added
 *   3. Cash overspending: already baked into cumulative `available` from import.
 *      For ongoing use, month-rollover logic must reset overspent cash categories
 *      to 0 and deduct the negative from next month's RTA.
 *   4. Future transactions (date > today): excluded from cash balance
 *   5. Assigned in future months: reflected in `available` of latest month
 *
 * RTA is a GLOBAL value — same regardless of which month the user is viewing.
 * The `month` parameter is kept for API compatibility but does not affect the result.
 */
export function getReadyToAssign(month: string): number {
  // 1. Cash on hand: net balance of all budget (non-credit) accounts, excluding future transactions
  const cashBalance: any = db.prepare(`
    SELECT COALESCE(SUM(t.inflow - t.outflow), 0) as total
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE a.type != 'credit' AND t.date <= date('now')
  `).get();

  // 2. Positive CC balances: if a credit card has a positive balance (bank owes user),
  //    that surplus is treated as cash per YNAB rules.
  //    Sources: cashback rewards, CC overpayments, cash advances.
  //    Per YNAB: "Only the amount of the positive balance will appear."
  const positiveCCBalances: any = db.prepare(`
    SELECT COALESCE(SUM(positive_balance), 0) as total
    FROM (
      SELECT MAX(0, COALESCE(SUM(t.inflow - t.outflow), 0)) as positive_balance
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE a.type = 'credit' AND t.date <= date('now')
      GROUP BY a.id
    )
  `).get();

  // 3. Find the latest month with COMPLETE budget data (cumulative available reflects all history)
  //    We need a month with a full set of categories, not a sparse ghost month
  //    (which can happen if user assigns then unassigns in a future month).
  //    A "complete" month has at least 10 category entries.
  const latestMonth: any = db.prepare(`
    SELECT month FROM budget_months
    GROUP BY month
    HAVING COUNT(*) >= 10
    ORDER BY month DESC
    LIMIT 1
  `).get();

  if (!latestMonth?.month) {
    return (cashBalance.total || 0) + (positiveCCBalances.total || 0);
  }

  // 4. Sum of all category available values for the latest month (cumulative)
  //    This includes:
  //    - Regular spending categories (assigned - activity carried forward)
  //    - CC Payment categories (money reserved to pay CC bills)
  //    Both must be subtracted since they represent "money with a job"
  const totalAvailable: any = db.prepare(`
    SELECT COALESCE(SUM(bm.available), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND bm.month = ?
  `).get(latestMonth.month);

  let rta = (cashBalance.total || 0) + (positiveCCBalances.total || 0) - (totalAvailable.total || 0);

  // 4b. Subtract assigned amounts from months BEYOND the latest full month.
  //     These are future assignments (e.g., user assigns money in March while latest
  //     full data is in February). They reduce RTA but aren't yet reflected in the
  //     cumulative `available` of the latest full month.
  const futureAssigned: any = db.prepare(`
    SELECT COALESCE(SUM(bm.assigned), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND bm.month > ?
  `).get(latestMonth.month);
  rta -= (futureAssigned.total || 0);

  // 5. Credit overspending correction:
  //    When a CC transaction overspends a category, the negative available reduces SumAvailable
  //    without reducing Cash, which falsely inflates RTA.
  //    Per YNAB: "Credit Overspending (Yellow) does NOT affect RTA."
  //    We must subtract the credit overspending portion to keep RTA accurate.
  //
  //    Total overspending = sum of |negative available| on regular categories
  //    Cash overspending = portion attributable to cash account transactions
  //    Credit overspending = total - cash (the CC-driven portion that shouldn't affect RTA)
  const totalOverspending: any = db.prepare(`
    SELECT COALESCE(SUM(ABS(bm.available)), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0
      AND c.linked_account_id IS NULL
      AND bm.available < 0
      AND bm.month = ?
  `).get(latestMonth.month);

  const cashOverspendingAmount = getCashOverspendingForMonth(latestMonth.month);
  const creditOverspendingAmount = (totalOverspending.total || 0) - cashOverspendingAmount;
  rta -= creditOverspendingAmount;

  // For past months, clamp negative RTA to 0 — overspending is only shown in current/future months
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (rta < 0 && month < currentMonth) {
    return 0;
  }

  return rta;
}

/**
 * Returns the RTA breakdown components for the RTA detail popup.
 * Matches YNAB's "Ready to Assign Breakdown" UI.
 */
export function getReadyToAssignBreakdown(month: string) {
  // Previous month string
  const [y, m] = month.split('-').map(Number);
  const prevDate = new Date(y, m - 2);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  // ➕ Inflow: Ready to Assign in current month (cash-based accounts only)
  const inflowThisMonth: any = db.prepare(`
    SELECT COALESCE(SUM(t.inflow - t.outflow), 0) as total
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    JOIN categories c ON t.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 1
      AND a.type != 'credit'
      AND strftime('%Y-%m', t.date) = ?
      AND t.date <= date('now')
  `).get(month);

  // ➕ Positive CC balances (cashback / overpayments)
  const positiveCCBalances: any = db.prepare(`
    SELECT COALESCE(SUM(positive_balance), 0) as total
    FROM (
      SELECT MAX(0, COALESCE(SUM(t.inflow - t.outflow), 0)) as positive_balance
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE a.type = 'credit' AND t.date <= date('now')
      GROUP BY a.id
    )
  `).get();

  // ➖ Assigned in current month
  const assignedThisMonth: any = db.prepare(`
    SELECT COALESCE(SUM(bm.assigned), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND bm.month = ?
  `).get(month);

  // ➖ Assigned in future (months beyond current)
  const assignedInFuture: any = db.prepare(`
    SELECT COALESCE(SUM(bm.assigned), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND bm.month > ?
  `).get(month);

  // ➖ Cash overspending from previous month (only the cash portion, not credit)
  const cashOverspendingTotal = getCashOverspendingForMonth(prevMonth);
  const cashOverspending = { total: cashOverspendingTotal };

  // ➕ Left over from previous month (computed as: RTA - this month's components)
  // We compute the overall RTA and back-calculate the leftover
  const rta = getReadyToAssign(month);
  const leftOver = rta
    - (inflowThisMonth.total || 0)
    - (positiveCCBalances.total || 0)
    + (assignedThisMonth.total || 0)
    + (assignedInFuture.total || 0)
    + (cashOverspending.total || 0);

  return {
    readyToAssign: rta,
    leftOverFromPreviousMonth: leftOver,
    inflowThisMonth: inflowThisMonth.total || 0,
    positiveCCBalances: positiveCCBalances.total || 0,
    cashOverspendingPreviousMonth: cashOverspending.total || 0,
    assignedThisMonth: assignedThisMonth.total || 0,
    assignedInFuture: assignedInFuture.total || 0,
  };
}

export function updateBudgetAssignment(categoryId: number, month: string, assigned: number) {
  // Final safety guard: reject non-finite values, clamp extreme values
  if (!isFinite(assigned)) {
    console.error(`updateBudgetAssignment: rejected non-finite value ${assigned} for category ${categoryId}`);
    return;
  }
  const MAX_ASSIGNED = 100_000_000_000;
  if (Math.abs(assigned) > MAX_ASSIGNED) {
    console.warn(`updateBudgetAssignment: clamping ${assigned} to max ${MAX_ASSIGNED}`);
    assigned = Math.sign(assigned) * MAX_ASSIGNED;
  }

  // Get the current assigned value to compute the delta
  const existing: any = db.prepare(
    'SELECT assigned, available FROM budget_months WHERE category_id = ? AND month = ?'
  ).get(categoryId, month);

  const oldAssigned = existing?.assigned || 0;
  const delta = assigned - oldAssigned;

  if (existing) {
    // Update this month: set new assigned, adjust available by the delta
    db.prepare(`
      UPDATE budget_months 
      SET assigned = ?, available = available + ?
      WHERE category_id = ? AND month = ?
    `).run(assigned, delta, categoryId, month);

    // Clean up ghost entries: if assigned=0 and no activity, remove the row
    // to prevent sparse months from corrupting the RTA latest-month lookup.
    if (assigned === 0) {
      const updated: any = db.prepare(
        'SELECT assigned, activity, available FROM budget_months WHERE category_id = ? AND month = ?'
      ).get(categoryId, month);
      if (updated && updated.assigned === 0 && updated.activity === 0 && updated.available === 0) {
        db.prepare('DELETE FROM budget_months WHERE category_id = ? AND month = ?').run(categoryId, month);
      }
    }
  } else {
    // Only create new entry if assigned is non-zero (don't create ghost entries)
    if (assigned === 0) return;
    db.prepare(`
      INSERT INTO budget_months (category_id, month, assigned, activity, available)
      VALUES (?, ?, ?, 0, ?)
    `).run(categoryId, month, assigned, assigned);
  }

  // Propagate the delta to ALL subsequent months' available (since available is cumulative)
  if (delta !== 0) {
    db.prepare(`
      UPDATE budget_months
      SET available = available + ?
      WHERE category_id = ? AND month > ?
    `).run(delta, categoryId, month);
  }
}

export function getTransactions(filters?: {
  accountId?: number;
  categoryId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  let query = `
    SELECT 
      t.*,
      a.name as account_name,
      c.name as category_name,
      tr.id as transfer_id,
      CASE WHEN t.date > date('now') THEN 1 ELSE 0 END as is_future
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN transfers tr ON t.id = tr.from_transaction_id OR t.id = tr.to_transaction_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters?.accountId) {
    query += ' AND t.account_id = ?';
    params.push(filters.accountId);
  }
  if (filters?.categoryId) {
    query += ' AND t.category_id = ?';
    params.push(filters.categoryId);
  }
  if (filters?.startDate) {
    query += ' AND t.date >= ?';
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    query += ' AND t.date <= ?';
    params.push(filters.endDate);
  }

  query += ' ORDER BY t.date DESC, t.id DESC';

  if (filters?.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  return db.prepare(query).all(...params);
}

export function createTransaction(transaction: {
  accountId: number;
  date: string;
  payee?: string;
  categoryId?: number;
  memo?: string;
  outflow?: number;
  inflow?: number;
  cleared?: string;
  flag?: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO transactions (
      account_id, date, payee, category_id, memo, outflow, inflow, cleared, flag
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    transaction.accountId,
    transaction.date,
    transaction.payee || null,
    transaction.categoryId || null,
    transaction.memo || null,
    transaction.outflow || 0,
    transaction.inflow || 0,
    transaction.cleared || 'Uncleared',
    transaction.flag || null
  );
}

export function updateTransaction(id: number, transaction: Partial<{
  date: string;
  payee: string;
  categoryId: number;
  memo: string;
  outflow: number;
  inflow: number;
  cleared: string;
  flag: string;
}>) {
  const fields = [];
  const values = [];

  if (transaction.date !== undefined) {
    fields.push('date = ?');
    values.push(transaction.date);
  }
  if (transaction.payee !== undefined) {
    fields.push('payee = ?');
    values.push(transaction.payee);
  }
  if (transaction.categoryId !== undefined) {
    fields.push('category_id = ?');
    values.push(transaction.categoryId);
  }
  if (transaction.memo !== undefined) {
    fields.push('memo = ?');
    values.push(transaction.memo);
  }
  if (transaction.outflow !== undefined) {
    fields.push('outflow = ?');
    values.push(transaction.outflow);
  }
  if (transaction.inflow !== undefined) {
    fields.push('inflow = ?');
    values.push(transaction.inflow);
  }
  if (transaction.cleared !== undefined) {
    fields.push('cleared = ?');
    values.push(transaction.cleared);
  }
  if (transaction.flag !== undefined) {
    fields.push('flag = ?');
    values.push(transaction.flag);
  }

  if (fields.length === 0) return;

  values.push(id);
  const stmt = db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`);
  return stmt.run(...values);
}

export function deleteTransaction(id: number) {
  return db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
}

export function getPayees() {
  return db.prepare(`
    SELECT DISTINCT payee 
    FROM transactions 
    WHERE payee IS NOT NULL AND payee != ''
    ORDER BY payee
  `).all().map((row: any) => row.payee);
}

export function toggleTransactionCleared(id: number) {
  const transaction: any = db.prepare('SELECT cleared FROM transactions WHERE id = ?').get(id);
  if (!transaction) return null;

  // Reconciled transactions cannot be toggled
  if (transaction.cleared === 'Reconciled') return null;

  const newStatus = transaction.cleared === 'Cleared' ? 'Uncleared' : 'Cleared';
  return db.prepare('UPDATE transactions SET cleared = ? WHERE id = ?').run(newStatus, id);
}

export function reconcileAccount(accountId: number) {
  // Mark all Cleared (non-future) transactions as Reconciled for this account
  const result = db.prepare(`
    UPDATE transactions 
    SET cleared = 'Reconciled' 
    WHERE account_id = ? AND cleared = 'Cleared' AND date <= date('now')
  `).run(accountId);

  return result;
}

export function getReconciliationInfo(accountId: number) {
  // Get the cleared balance (sum of Cleared + Reconciled transactions, non-future)
  const result: any = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN cleared IN ('Cleared', 'Reconciled') THEN inflow - outflow ELSE 0 END), 0) as cleared_balance,
      COALESCE(SUM(CASE WHEN cleared = 'Reconciled' THEN inflow - outflow ELSE 0 END), 0) as reconciled_balance,
      COALESCE(SUM(CASE WHEN cleared = 'Cleared' THEN inflow - outflow ELSE 0 END), 0) as pending_cleared_balance,
      COUNT(CASE WHEN cleared = 'Cleared' THEN 1 END) as pending_cleared_count
    FROM transactions
    WHERE account_id = ? AND date <= date('now')
  `).get(accountId);

  return result;
}

export function updateAccountBalances(accountId: number) {
  // Calculate total balance and cleared balance, excluding future-dated transactions
  const result: any = db.prepare(`
    SELECT 
      COALESCE(SUM(inflow - outflow), 0) as balance,
      COALESCE(SUM(CASE WHEN cleared IN ('Cleared', 'Reconciled') THEN inflow - outflow ELSE 0 END), 0) as cleared_balance,
      COALESCE(SUM(CASE WHEN cleared = 'Uncleared' THEN inflow - outflow ELSE 0 END), 0) as uncleared_balance
    FROM transactions
    WHERE account_id = ? AND date <= date('now')
  `).get(accountId);

  return db.prepare(`
    UPDATE accounts 
    SET balance = ?, cleared_balance = ?, uncleared_balance = ?
    WHERE id = ?
  `).run(result.balance, result.cleared_balance, result.uncleared_balance, accountId);
}

export function updateBudgetActivity(categoryId: number, month: string) {
  // Calculate activity for the category in the given month
  // YNAB convention: activity is NEGATIVE for spending (inflow - outflow)
  // YNAB excludes future-dated transactions from activity — they show as "Upcoming"
  const result: any = db.prepare(`
    SELECT COALESCE(SUM(inflow - outflow), 0) as activity
    FROM transactions
    WHERE category_id = ? AND strftime('%Y-%m', date) = ? AND date <= date('now')
  `).get(categoryId, month);

  const activity = result.activity;

  // Get carryforward from previous month (cumulative available)
  const [y, m] = month.split('-').map(Number);
  const prevDate = new Date(y, m - 2);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const prevBudget: any = db.prepare(`
    SELECT available FROM budget_months WHERE category_id = ? AND month = ?
  `).get(categoryId, prevMonth);

  let carryforward = 0;
  if (prevBudget && prevBudget.available !== 0) {
    if (prevBudget.available >= 0) {
      // Positive balance carries forward
      carryforward = prevBudget.available;
    } else {
      // Negative balance: check if this is a CC Payment category
      const category: any = db.prepare(`
        SELECT c.linked_account_id FROM categories c WHERE c.id = ?
      `).get(categoryId);

      if (category?.linked_account_id) {
        // CC Payment category: debt carries forward entirely
        carryforward = prevBudget.available;
      } else {
        // Regular category: only credit overspending carries forward, cash resets to 0
        const totalOverspent = Math.abs(prevBudget.available);
        const cashActivity: any = db.prepare(`
          SELECT COALESCE(SUM(t.outflow - t.inflow), 0) as total
          FROM transactions t
          JOIN accounts a ON t.account_id = a.id
          WHERE t.category_id = ? AND strftime('%Y-%m', t.date) = ? AND a.type != 'credit'
        `).get(categoryId, prevMonth);
        const cashSpending = Math.max(0, cashActivity.total || 0);
        const cashOverspending = Math.min(totalOverspent, cashSpending);
        const creditOverspending = totalOverspent - cashOverspending;
        // Cash overspending resets to 0 (deducted from RTA elsewhere)
        // Credit overspending carries forward as negative
        carryforward = -creditOverspending;
      }
    }
  }

  // Update or insert budget_months record
  const existing: any = db.prepare(`
    SELECT assigned FROM budget_months WHERE category_id = ? AND month = ?
  `).get(categoryId, month);

  const assigned = existing?.assigned || 0;
  const available = carryforward + assigned + activity;

  if (existing) {
    return db.prepare(`
      UPDATE budget_months 
      SET activity = ?, available = ?
      WHERE category_id = ? AND month = ?
    `).run(activity, available, categoryId, month);
  } else {
    return db.prepare(`
      INSERT INTO budget_months (category_id, month, assigned, activity, available)
      VALUES (?, ?, 0, ?, ?)
    `).run(categoryId, month, activity, available);
  }
}

export function getTransaction(id: number) {
  return db.prepare(`
    SELECT 
      t.*,
      a.name as account_name,
      c.name as category_name
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?
  `).get(id);
}

export function updateCategoryName(id: number, name: string) {
  return db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id);
}

export function updateCategoryGroupOrder(groups: { id: number, sort_order: number }[]) {
  const updateStmt = db.prepare('UPDATE category_groups SET sort_order = ? WHERE id = ?');
  const transaction = db.transaction((groups) => {
    for (const group of groups) {
      updateStmt.run(group.sort_order, group.id);
    }
  });
  return transaction(groups);
}

export function updateCategoryOrder(categories: { id: number, sort_order: number, category_group_id?: number }[]) {
  const transaction = db.transaction((categories) => {
    for (const cat of categories) {
      if (cat.category_group_id !== undefined) {
        db.prepare('UPDATE categories SET sort_order = ?, category_group_id = ? WHERE id = ?')
          .run(cat.sort_order, cat.category_group_id, cat.id);
      } else {
        db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?')
          .run(cat.sort_order, cat.id);
      }
    }
  });
  return transaction(categories);
}

export function createCategoryGroup(name: string) {
  const maxOrder = db.prepare('SELECT MAX(sort_order) as maxOrder FROM category_groups').get() as { maxOrder: number };
  const newOrder = (maxOrder.maxOrder || 0) + 1;

  return db.prepare('INSERT INTO category_groups (name, sort_order) VALUES (?, ?)').run(name, newOrder);
}

export function createCategory(category: { name: string; category_group_id: number; linked_account_id?: number }) {
  const maxOrder = db.prepare('SELECT MAX(sort_order) as maxOrder FROM categories WHERE category_group_id = ?').get(category.category_group_id) as { maxOrder: number };
  const newOrder = (maxOrder.maxOrder || 0) + 1;

  if (category.linked_account_id) {
    return db.prepare('INSERT INTO categories (name, category_group_id, sort_order, linked_account_id) VALUES (?, ?, ?, ?)').run(category.name, category.category_group_id, newOrder, category.linked_account_id);
  }
  return db.prepare('INSERT INTO categories (name, category_group_id, sort_order) VALUES (?, ?, ?)').run(category.name, category.category_group_id, newOrder);
}

// ====== Credit Card Payment Functions ======

export function getAccountType(accountId: number): string | null {
  const account: any = db.prepare('SELECT type FROM accounts WHERE id = ?').get(accountId);
  return account?.type || null;
}

export function getCreditCardPaymentCategory(accountId: number): any {
  return db.prepare(
    'SELECT * FROM categories WHERE linked_account_id = ?'
  ).get(accountId);
}

export function ensureCreditCardPaymentCategory(accountId: number, accountName: string): any {
  // Check if category already exists
  let category = getCreditCardPaymentCategory(accountId);
  if (category) return category;

  // Ensure "Credit Card Payments" group exists
  let ccGroup: any = db.prepare("SELECT id FROM category_groups WHERE name = 'Credit Card Payments'").get();
  if (!ccGroup) {
    const maxOrder = db.prepare('SELECT MAX(sort_order) as maxOrder FROM category_groups').get() as { maxOrder: number };
    const newOrder = (maxOrder.maxOrder || 0) + 1;
    const result = db.prepare("INSERT INTO category_groups (name, sort_order, hidden, is_income) VALUES ('Credit Card Payments', ?, 0, 0)").run(newOrder);
    ccGroup = { id: result.lastInsertRowid };
  }

  // Create the CC Payment category
  const result = createCategory({
    name: accountName,
    category_group_id: ccGroup.id,
    linked_account_id: accountId,
  });

  return db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
}

export function updateCreditCardPaymentBudget(accountId: number, month: string) {
  // Get the CC Payment category for this account
  const ccCategory = getCreditCardPaymentCategory(accountId);
  if (!ccCategory) return;

  // FUNDED SPENDING: Only move the funded portion of CC spending to CC Payment.
  // For each spending category used on this CC, we can only move MIN(category_available, cc_spending).
  // The unfunded portion stays as credit overspending (yellow) on the spending category.

  // Get all categories with transactions on this CC this month (excluding the CC Payment category itself)
  // YNAB excludes future-dated transactions — they don't affect CC Payment available
  const categorySpending: any[] = db.prepare(`
    SELECT 
      t.category_id,
      COALESCE(SUM(t.outflow), 0) as cat_outflow,
      COALESCE(SUM(t.inflow), 0) as cat_inflow
    FROM transactions t
    WHERE t.account_id = ? 
      AND strftime('%Y-%m', t.date) = ?
      AND t.date <= date('now')
      AND t.category_id IS NOT NULL
      AND t.category_id != ?
    GROUP BY t.category_id
  `).all(accountId, month, ccCategory.id);

  let fundedActivity = 0;

  for (const catSpend of categorySpending) {
    const netSpending = catSpend.cat_outflow - catSpend.cat_inflow;

    if (netSpending <= 0) {
      // Refund/return: moves money back from CC Payment to category
      fundedActivity += netSpending;
      continue;
    }

    // Get the category's available balance for this month
    // We need the available BEFORE accounting for this CC spending.
    // Since budget_months.available already includes all transactions,
    // we approximate: available_before_cc = current_available + netSpending (add back what was spent)
    const catBudget: any = db.prepare(`
      SELECT COALESCE(bm.available, 0) as available
      FROM budget_months bm
      WHERE bm.category_id = ? AND bm.month = ?
    `).get(catSpend.category_id, month);

    const currentAvailable = catBudget?.available || 0;
    // available_before = currentAvailable + netSpending
    // Since activity is stored as negative (inflow - outflow), spending reduced available.
    // To get what available was BEFORE spending, we add back the spending amount.
    const availableBefore = currentAvailable + netSpending;

    // Only move the funded portion
    const funded = Math.min(Math.max(0, availableBefore), netSpending);
    fundedActivity += funded;
  }

  // Get carryforward from previous month for CC Payment category
  const [y, m] = month.split('-').map(Number);
  const prevDate = new Date(y, m - 2);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const prevCCBudget: any = db.prepare(`
    SELECT available FROM budget_months WHERE category_id = ? AND month = ?
  `).get(ccCategory.id, prevMonth);

  const carryforward = prevCCBudget?.available || 0;

  // Get current assigned amount for the CC Payment category
  const existing: any = db.prepare(
    "SELECT assigned FROM budget_months WHERE category_id = ? AND month = ?"
  ).get(ccCategory.id, month);

  const assigned = existing?.assigned || 0;
  const available = carryforward + assigned + fundedActivity;

  if (existing) {
    db.prepare(
      "UPDATE budget_months SET activity = ?, available = ? WHERE category_id = ? AND month = ?"
    ).run(fundedActivity, available, ccCategory.id, month);
  } else {
    db.prepare(
      "INSERT INTO budget_months (category_id, month, assigned, activity, available) VALUES (?, ?, 0, ?, ?)"
    ).run(ccCategory.id, month, fundedActivity, carryforward + fundedActivity);
  }
}

export function isCreditCardAccount(accountId: number): boolean {
  return getAccountType(accountId) === 'credit';
}

// ====== Overspending Detection Functions ======

/**
 * For a given month, calculate the total CASH overspending across all regular
 * (non-CC-Payment) categories. This is used to deduct from the next month's RTA.
 *
 * Cash overspending = overspending attributable to transactions on cash accounts.
 * Credit overspending = overspending from CC transactions beyond budget (does NOT affect RTA).
 */
export function getCashOverspendingForMonth(month: string): number {
  // Get all overspent categories (available < 0, non-CC-Payment, non-income)
  const overspentCategories: any[] = db.prepare(`
    SELECT bm.category_id, bm.available
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0
      AND c.linked_account_id IS NULL
      AND bm.available < 0
      AND bm.month = ?
  `).all(month);

  let totalCashOverspending = 0;

  for (const cat of overspentCategories) {
    const totalOverspent = Math.abs(cat.available);

    // Get cash activity (spending on non-credit accounts) for this category this month
    const cashActivity: any = db.prepare(`
      SELECT COALESCE(SUM(t.outflow - t.inflow), 0) as total
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.category_id = ? AND strftime('%Y-%m', t.date) = ? AND a.type != 'credit'
    `).get(cat.category_id, month);

    const cashSpending = Math.max(0, cashActivity.total || 0);
    // Cash overspending = min of total overspent and cash spending amount
    const cashOverspending = Math.min(totalOverspent, cashSpending);
    totalCashOverspending += cashOverspending;
  }

  return totalCashOverspending;
}

/**
 * Returns all data needed for the Budget Inspector panel.
 * Aggregates month summary, auto-assign values, and future month assignments.
 */
export function getBudgetInspectorData(month: string) {
  const [y, m] = month.split('-').map(Number);
  const prevDate = new Date(y, m - 2);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  // Calculate the month 12 months before the current one (for trailing averages)
  const twelveMonthsAgoDate = new Date(y, m - 13);
  const twelveMonthsAgo = `${twelveMonthsAgoDate.getFullYear()}-${String(twelveMonthsAgoDate.getMonth() + 1).padStart(2, '0')}`;

  // ── Month Summary ──
  // Get RTA breakdown for assigned values
  const breakdown = getReadyToAssignBreakdown(month);

  // Total activity this month (negative = spending) — non-income, non-CC payment categories
  const activityResult: any = db.prepare(`
    SELECT COALESCE(SUM(bm.activity), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND bm.month = ?
  `).get(month);

  // Total available this month
  const availableResult: any = db.prepare(`
    SELECT COALESCE(SUM(bm.available), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND bm.month = ?
  `).get(month);

  const totalAvailable = availableResult.total || 0;
  const totalAssigned = breakdown.assignedThisMonth || 0;
  const totalActivity = activityResult.total || 0;

  // Left Over from Last Month = Available - Assigned - Activity
  // This represents the cumulative carryover from previous months
  const leftOverFromLastMonth = totalAvailable - totalAssigned - totalActivity;

  // ── Cost to Be Me ──
  // Targets: total assigned this month (represents total monthly spending targets)
  const targets = totalAssigned;

  // Expected Income: average monthly inflow over the last 12 months (cash accounts, income categories)
  const expectedIncome: any = db.prepare(`
    SELECT COALESCE(AVG(monthly_total), 0) as avg_total
    FROM (
      SELECT strftime('%Y-%m', t.date) as month, SUM(t.inflow - t.outflow) as monthly_total
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      JOIN categories c ON t.category_id = c.id
      JOIN category_groups cg ON c.category_group_id = cg.id
      WHERE cg.is_income = 1
        AND a.type != 'credit'
        AND t.date <= date('now')
        AND strftime('%Y-%m', t.date) >= ? AND strftime('%Y-%m', t.date) < ?
      GROUP BY strftime('%Y-%m', t.date)
    )
  `).get(twelveMonthsAgo, month);

  // ── Auto-Assign Calculations ──

  // Underfunded: sum of |available| for categories where available < 0 (non-CC, non-income)
  // Plus CC payment shortfall (where CC balance exceeds CC Payment available)
  const underfundedRegular: any = db.prepare(`
    SELECT COALESCE(SUM(ABS(bm.available)), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND c.linked_account_id IS NULL AND bm.available < 0 AND bm.month = ?
  `).get(month);

  // CC payment shortfall: where ABS(account balance) > CC Payment available
  const ccShortfall: any = db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN ABS(a.balance) > COALESCE(bm.available, 0) AND a.balance < 0
        THEN ABS(a.balance) - COALESCE(bm.available, 0)
        ELSE 0
      END
    ), 0) as total
    FROM accounts a
    LEFT JOIN categories c ON c.linked_account_id = a.id
    LEFT JOIN budget_months bm ON bm.category_id = c.id AND bm.month = ?
    WHERE a.type = 'credit' AND a.closed = 0
  `).get(month);

  const underfundedTotal = (underfundedRegular.total || 0) + (ccShortfall.total || 0);

  // Assigned Last Month (excluding CC payment categories)
  const assignedLastMonth: any = db.prepare(`
    SELECT COALESCE(SUM(bm.assigned), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND c.linked_account_id IS NULL AND bm.month = ?
  `).get(prevMonth);

  // Spent Last Month (absolute value of activity, excluding CC payment categories)
  const spentLastMonth: any = db.prepare(`
    SELECT COALESCE(SUM(ABS(CASE WHEN bm.activity < 0 THEN bm.activity ELSE 0 END)), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND c.linked_account_id IS NULL AND bm.month = ?
  `).get(prevMonth);

  // Average Assigned (trailing 12 months, excluding current month, excluding CC payment categories)
  const avgAssigned: any = db.prepare(`
    SELECT COALESCE(AVG(monthly_total), 0) as avg_total
    FROM (
      SELECT bm.month, SUM(bm.assigned) as monthly_total
      FROM budget_months bm
      JOIN categories c ON bm.category_id = c.id
      JOIN category_groups cg ON c.category_group_id = cg.id
      WHERE cg.is_income = 0 AND c.linked_account_id IS NULL
        AND bm.month >= ? AND bm.month < ?
      GROUP BY bm.month
    )
  `).get(twelveMonthsAgo, month);

  // Average Spent (trailing 12 months, absolute value of negative activity, excluding CC payment categories)
  const avgSpent: any = db.prepare(`
    SELECT COALESCE(AVG(monthly_total), 0) as avg_total
    FROM (
      SELECT bm.month, SUM(ABS(CASE WHEN bm.activity < 0 THEN bm.activity ELSE 0 END)) as monthly_total
      FROM budget_months bm
      JOIN categories c ON bm.category_id = c.id
      JOIN category_groups cg ON c.category_group_id = cg.id
      WHERE cg.is_income = 0 AND c.linked_account_id IS NULL
        AND bm.month >= ? AND bm.month < ?
      GROUP BY bm.month
    )
  `).get(twelveMonthsAgo, month);

  // Reduce Overfunding: for non-CC categories where available > assigned > 0,
  // the surplus (available - assigned) that could be reclaimed
  const reduceOverfunding: any = db.prepare(`
    SELECT COALESCE(SUM(bm.available - bm.assigned), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND c.linked_account_id IS NULL
      AND bm.available > bm.assigned AND bm.assigned > 0 AND bm.activity >= 0
      AND bm.month = ?
  `).get(month);

  // Reset Available Amounts: sum of available for categories where available > 0
  // but assigned is 0 this month (leftover funds without assignment)
  const resetAvailable: any = db.prepare(`
    SELECT COALESCE(SUM(bm.available), 0) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND c.linked_account_id IS NULL
      AND bm.available > 0 AND bm.assigned = 0 AND bm.activity = 0
      AND bm.month = ?
  `).get(month);

  // Reset Assigned Amounts: total assigned this month (non-CC, non-income)
  const resetAssigned = totalAssigned;

  // ── Assigned in Future Months ──
  const futureMonths: any[] = db.prepare(`
    SELECT bm.month, SUM(bm.assigned) as total
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0 AND bm.month > ? AND bm.assigned != 0
    GROUP BY bm.month
    ORDER BY bm.month
  `).all(month);

  return {
    summary: {
      leftOverFromLastMonth,
      assignedThisMonth: totalAssigned,
      activity: totalActivity,
      available: totalAvailable,
    },
    costToBeMe: {
      targets,
      expectedIncome: expectedIncome.avg_total || 0,
    },
    autoAssign: {
      underfunded: underfundedTotal,
      assignedLastMonth: assignedLastMonth.total || 0,
      spentLastMonth: spentLastMonth.total || 0,
      averageAssigned: avgAssigned.avg_total || 0,
      averageSpent: avgSpent.avg_total || 0,
      reduceOverfunding: reduceOverfunding.total || 0,
      resetAvailableAmounts: resetAvailable.total || 0,
      resetAssignedAmounts: resetAssigned,
    },
    futureAssignments: {
      total: breakdown.assignedInFuture,
      months: futureMonths.map(fm => ({
        month: fm.month,
        amount: fm.total,
      })),
    },
  };
}

/**
 * Returns the overspending type per category for a given month.
 * Used by the API to tell the frontend whether to show red (cash) or yellow (credit).
 */
export function getOverspendingTypes(month: string): Record<number, 'cash' | 'credit' | null> {
  const result: Record<number, 'cash' | 'credit' | null> = {};

  // Get all categories with negative available in this month
  const overspentCategories: any[] = db.prepare(`
    SELECT bm.category_id, bm.available, c.linked_account_id
    FROM budget_months bm
    JOIN categories c ON bm.category_id = c.id
    JOIN category_groups cg ON c.category_group_id = cg.id
    WHERE cg.is_income = 0
      AND bm.available < 0
      AND bm.month = ?
  `).all(month);

  for (const cat of overspentCategories) {
    // CC Payment categories always show as 'credit' (underfunded CC debt)
    if (cat.linked_account_id) {
      result[cat.category_id] = 'credit';
      continue;
    }

    const totalOverspent = Math.abs(cat.available);

    // Get cash activity
    const cashActivity: any = db.prepare(`
      SELECT COALESCE(SUM(t.outflow - t.inflow), 0) as total
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.category_id = ? AND strftime('%Y-%m', t.date) = ? AND a.type != 'credit'
    `).get(cat.category_id, month);

    const cashSpending = Math.max(0, cashActivity.total || 0);
    const cashOverspending = Math.min(totalOverspent, cashSpending);
    const creditOverspending = totalOverspent - cashOverspending;

    if (cashOverspending > 0 && creditOverspending === 0) {
      result[cat.category_id] = 'cash';
    } else if (creditOverspending > 0 && cashOverspending === 0) {
      result[cat.category_id] = 'credit';
    } else if (cashOverspending > 0) {
      // Mixed: default to cash (the more urgent/impactful type)
      result[cat.category_id] = 'cash';
    }
  }

  return result;
}
