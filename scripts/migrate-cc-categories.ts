/**
 * Migration: Credit Card Payment Categories
 * 
 * 1. Add `linked_account_id` column to categories table
 * 2. Create CC Payment categories for all existing credit card accounts
 * 3. Link existing "Bancolombia - Mastercard Black" category to its account
 * 4. Calculate initial Available for each CC Payment category
 */

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'db', 'ynab.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

function migrate() {
    console.log('Starting Credit Card Payment categories migration...\n');

    // 1. Add linked_account_id column if it doesn't exist
    const columns = db.prepare("PRAGMA table_info(categories)").all() as any[];
    const hasLinkedAccountId = columns.some((col: any) => col.name === 'linked_account_id');

    if (!hasLinkedAccountId) {
        console.log('Adding linked_account_id column to categories table...');
        db.exec('ALTER TABLE categories ADD COLUMN linked_account_id INTEGER DEFAULT NULL REFERENCES accounts(id) ON DELETE SET NULL');
        console.log('✓ Column added.\n');
    } else {
        console.log('✓ linked_account_id column already exists.\n');
    }

    // 2. Ensure "Credit Card Payments" category group exists
    let ccGroup: any = db.prepare("SELECT id FROM category_groups WHERE name = 'Credit Card Payments'").get();
    if (!ccGroup) {
        const result = db.prepare("INSERT INTO category_groups (name, sort_order, hidden, is_income) VALUES ('Credit Card Payments', 0, 0, 0)").run();
        ccGroup = { id: result.lastInsertRowid };
        console.log(`✓ Created "Credit Card Payments" group (id=${ccGroup.id}).\n`);
    } else {
        // Ensure the group is visible and sorted first
        db.prepare("UPDATE category_groups SET hidden = 0, sort_order = 0 WHERE id = ?").run(ccGroup.id);
        console.log(`✓ "Credit Card Payments" group already exists (id=${ccGroup.id}), ensured visible.\n`);
    }

    // 3. Get all credit card accounts
    const creditAccounts = db.prepare("SELECT id, name, balance FROM accounts WHERE type = 'credit'").all() as any[];
    console.log(`Found ${creditAccounts.length} credit card accounts.\n`);

    for (const account of creditAccounts) {
        // Check if a CC Payment category already exists for this account
        let category: any = db.prepare(
            "SELECT id, name FROM categories WHERE linked_account_id = ?"
        ).get(account.id);

        if (!category) {
            // Check if there's an existing category with the same name in the CC Payments group (like the manually created one)
            category = db.prepare(
                "SELECT id, name FROM categories WHERE category_group_id = ? AND name = ?"
            ).get(ccGroup.id, account.name);

            if (category) {
                // Link the existing category
                db.prepare("UPDATE categories SET linked_account_id = ? WHERE id = ?").run(account.id, category.id);
                console.log(`✓ Linked existing category "${category.name}" (id=${category.id}) to account id=${account.id}`);
            } else {
                // Create new CC Payment category
                const maxOrder: any = db.prepare(
                    'SELECT MAX(sort_order) as maxOrder FROM categories WHERE category_group_id = ?'
                ).get(ccGroup.id);
                const newOrder = (maxOrder?.maxOrder || 0) + 1;

                const result = db.prepare(
                    "INSERT INTO categories (name, category_group_id, sort_order, hidden, linked_account_id) VALUES (?, ?, ?, 0, ?)"
                ).run(account.name, ccGroup.id, newOrder, account.id);
                category = { id: result.lastInsertRowid, name: account.name };
                console.log(`✓ Created CC Payment category "${account.name}" (id=${category.id})`);
            }
        } else {
            console.log(`✓ CC Payment category already exists for "${account.name}" (category id=${category.id})`);
        }

        // 4. Calculate and set the Available for this CC Payment category
        // For each month that has transactions on this credit card, calculate how much
        // should be in the CC Payment category
        const months = db.prepare(`
      SELECT DISTINCT strftime('%Y-%m', date) as month 
      FROM transactions 
      WHERE account_id = ?
      ORDER BY month
    `).all(account.id) as any[];

        for (const { month } of months) {
            // Calculate total funded spending on this credit card for this month
            // "Funded spending" = outflows on the credit card that have a category assigned
            const spending: any = db.prepare(`
        SELECT COALESCE(SUM(outflow), 0) as total_outflow,
               COALESCE(SUM(inflow), 0) as total_inflow
        FROM transactions
        WHERE account_id = ? 
          AND strftime('%Y-%m', date) = ?
          AND category_id IS NOT NULL
      `).get(account.id, month);

            // Net amount that should move to CC Payment = outflow - inflow (for categorized transactions)
            const ccPaymentActivity = spending.total_outflow - spending.total_inflow;

            if (ccPaymentActivity !== 0) {
                // Check if budget entry exists
                const existing: any = db.prepare(
                    "SELECT id, assigned, activity, available FROM budget_months WHERE category_id = ? AND month = ?"
                ).get(category.id, month);

                if (existing) {
                    // Update: add the CC payment activity to available
                    db.prepare(
                        "UPDATE budget_months SET activity = ?, available = assigned + ? WHERE category_id = ? AND month = ?"
                    ).run(ccPaymentActivity, ccPaymentActivity, category.id, month);
                } else {
                    // Create new budget entry
                    db.prepare(
                        "INSERT INTO budget_months (category_id, month, assigned, activity, available) VALUES (?, ?, 0, ?, ?)"
                    ).run(category.id, month, ccPaymentActivity, ccPaymentActivity);
                }
                console.log(`  → ${month}: CC Payment activity = ${ccPaymentActivity.toFixed(0)}`);
            }
        }
        console.log('');
    }

    console.log('Migration complete! ✓');
}

migrate();
db.close();
