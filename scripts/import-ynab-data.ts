import fs from 'fs';
import path from 'path';
import db, { createAccount } from '../lib/db';

interface RegisterRow {
    Account: string;
    Flag: string;
    Date: string;
    Payee: string;
    'Category Group/Category': string;
    'Category Group': string;
    Category: string;
    Memo: string;
    Outflow: string;
    Inflow: string;
    Cleared: string;
}

interface PlanRow {
    Month: string;
    'Category Group/Category': string;
    'Category Group': string;
    Category: string;
    Assigned: string;
    Activity: string;
    Available: string;
}

function parseCSV(filePath: string): any[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length === 0) return [];

    // Parse CSV line with mixed quoted and unquoted values
    function parseLine(line: string): string[] {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current);

        return values;
    }

    // Parse header
    const header = parseLine(lines[0]).map(h => h.replace(/^\uFEFF/, '')); // Remove BOM

    // Parse rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);

        const row: any = {};
        header.forEach((key, index) => {
            row[key] = values[index] || '';
        });
        rows.push(row);
    }

    return rows;
}

function parseAmount(amount: string): number {
    if (!amount || amount === '$0.00') return 0;
    return parseFloat(amount.replace(/[$,]/g, ''));
}

function parseDate(dateStr: string): string {
    // Convert DD/MM/YYYY to YYYY-MM-DD
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function importData() {
    console.log('Starting YNAB data import...');

    const registerPath = path.join(process.cwd(), '..', 'YNAB Export - Compartido COP as of 2026-02-07 16-53', 'Compartido COP as of 2026-02-07 16-53 - Register.csv');
    const planPath = path.join(process.cwd(), '..', 'YNAB Export - Compartido COP as of 2026-02-07 16-53', 'Compartido COP as of 2026-02-07 16-53 - Plan.csv');

    if (!fs.existsSync(registerPath) || !fs.existsSync(planPath)) {
        console.error('CSV files not found!');
        console.error('Register path:', registerPath);
        console.error('Plan path:', planPath);
        return;
    }

    const registerData = parseCSV(registerPath) as RegisterRow[];
    const planData = parseCSV(planPath) as PlanRow[];

    console.log(`Loaded ${registerData.length} transactions and ${planData.length} budget entries`);
    console.log('Register headers:', Object.keys(registerData[0] || {}));

    // Clear existing data
    console.log('Clearing existing data...');
    db.prepare('DELETE FROM transfers').run();
    db.prepare('DELETE FROM transactions').run();
    db.prepare('DELETE FROM budget_months').run();
    db.prepare('DELETE FROM categories').run();
    db.prepare('DELETE FROM category_groups').run();
    db.prepare('DELETE FROM accounts').run();
    // Reset autoincrement
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('transfers', 'transactions', 'budget_months', 'categories', 'category_groups', 'accounts')").run();

    // Extract unique accounts
    const accountNames = new Set<string>();
    registerData.forEach(row => {
        if (row.Account && !row.Account.startsWith('Transfer :')) {
            accountNames.add(row.Account);
        }
    });

    console.log(`Found ${accountNames.size} accounts`);

    // Create accounts
    const accountMap = new Map<string, number>();
    accountNames.forEach(name => {
        let type = 'checking';
        if (
            name.toLowerCase().includes('credit') ||
            name.toLowerCase().includes('mastercard') ||
            name.toLowerCase().includes('master card') ||
            name.toLowerCase().includes('visa') ||
            name.toLowerCase().includes('american express') ||
            name.toLowerCase().includes('amex') ||
            name.toLowerCase().includes('one rewards')
        ) {
            type = 'credit';
        } else if (name.toLowerCase().includes('efectivo') || name.toLowerCase().includes('cash')) {
            type = 'cash';
        } else if (name.toLowerCase().includes('fiducuenta') || name.toLowerCase().includes('investment')) {
            type = 'savings';
        } else if (name.toLowerCase().includes('ahorros') || name.toLowerCase().includes('savings')) {
            type = 'savings';
        }

        const result = createAccount({ name, type, balance: 0 });
        accountMap.set(name, result.lastInsertRowid as number);
        console.log(`Created account: ${name} (${type})`);
    });

    // Extract category groups and categories from BOTH register and plan data
    const categoryGroupMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();

    const categoryData = new Map<string, Set<string>>();

    // 1. From transactions
    registerData.forEach(row => {
        const groupName = row['Category Group'];
        const categoryName = row.Category;

        if (groupName && categoryName) {
            if (!categoryData.has(groupName)) {
                categoryData.set(groupName, new Set());
            }
            categoryData.get(groupName)!.add(categoryName.trim());
        }
    });

    // 2. From budget plan (to catch categories with no transactions)
    planData.forEach(row => {
        const groupName = row['Category Group'];
        const categoryName = row.Category;

        if (groupName && categoryName) {
            if (!categoryData.has(groupName)) {
                categoryData.set(groupName, new Set());
            }
            categoryData.get(groupName)!.add(categoryName.trim());
        }
    });

    // Create category groups and categories
    let groupSortOrder = 0;
    categoryData.forEach((categories, groupName) => {
        const isIncome = groupName === 'Inflow';
        const hidden = groupName.includes('Hidden');
        const isCreditCardPayments = groupName === 'Credit Card Payments';

        // Skip Inflow group for regular display if needed, but we want it for Ready to Assign
        // The issue was it was being skipped entirely. Now we allow it.
        // Credit Card Payments should appear at the top of the budget (sort_order = 0)

        let sortOrder: number;
        if (isIncome) sortOrder = -1;
        else if (isCreditCardPayments) sortOrder = 0;
        else sortOrder = groupSortOrder++ + 1;

        const groupResult = db.prepare(`
      INSERT INTO category_groups (name, sort_order, hidden, is_income)
      VALUES (?, ?, ?, ?)
    `).run(groupName, sortOrder, hidden ? 1 : 0, isIncome ? 1 : 0);

        const groupId = groupResult.lastInsertRowid as number;
        categoryGroupMap.set(groupName, groupId);

        let categorySortOrder = 0;
        categories.forEach(categoryName => {
            let linkedAccountId = null;
            // Find account with the same name that is a credit card
            for (const [name, id] of accountMap.entries()) {
                if (name === categoryName) {
                    const accountType = db.prepare('SELECT type FROM accounts WHERE id = ?').get(id) as { type: string };
                    if (accountType && accountType.type === 'credit') {
                        linkedAccountId = id;
                        console.log(`Linking category "${categoryName}" to credit account ID ${id}`);
                        break;
                    }
                }
            }

            const categoryResult = db.prepare(`
        INSERT INTO categories (category_group_id, name, sort_order, hidden, linked_account_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(groupId, categoryName, categorySortOrder++, 0, linkedAccountId);

            categoryMap.set(`${groupName}:${categoryName}`, categoryResult.lastInsertRowid as number);
        });

        console.log(`Created category group: ${groupName} with ${categories.size} categories`);
    });

    // Import transactions
    console.log('Importing transactions...');
    let transactionCount = 0;
    let skippedCount = 0;

    const transferMap = new Map<string, number>();

    registerData.forEach((row, index) => {
        try {
            const accountName = row.Account;
            const accountId = accountMap.get(accountName);

            if (!accountId) {
                skippedCount++;
                return;
            }

            const date = parseDate(row.Date);
            const payee = row.Payee;
            const memo = row.Memo;
            const outflow = parseAmount(row.Outflow);
            const inflow = parseAmount(row.Inflow);
            const cleared = row.Cleared || 'Uncleared';
            const flag = row.Flag || null;

            let categoryId = null;
            if (row['Category Group'] && row.Category) {
                const categoryKey = `${row['Category Group'].trim()}:${row.Category.trim()}`;
                categoryId = categoryMap.get(categoryKey) || null;
            }

            const result = db.prepare(`
        INSERT INTO transactions (
          account_id, date, payee, category_id, memo, outflow, inflow, cleared, flag
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(accountId, date, payee, categoryId, memo, outflow, inflow, cleared, flag);

            transactionCount++;

            // Track transfers for later linking
            if (payee && payee.startsWith('Transfer :')) {
                const transferKey = `${date}-${outflow || inflow}`;
                transferMap.set(transferKey, result.lastInsertRowid as number);
            }

            if (transactionCount % 500 === 0) {
                console.log(`Imported ${transactionCount} transactions...`);
            }
        } catch (error) {
            console.error(`Error importing transaction ${index}:`, error);
            skippedCount++;
        }
    });

    console.log(`Imported ${transactionCount} transactions (skipped ${skippedCount})`);

    // Process transfers
    console.log('Processing transfers...');
    let transferCount = 0;

    // We need to match transfers locally since we don't have a reliable ID from CSV
    // Valid transfers have "Transfer : <AccountName>" as Payee
    const potentialTransfers = db.prepare(`
        SELECT t.id, t.account_id, t.date, t.outflow, t.inflow, t.payee, a.name as account_name
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        WHERE t.payee LIKE 'Transfer : %'
    `).all() as any[];

    const processedTransferIds = new Set<number>();

    for (const t1 of potentialTransfers) {
        if (processedTransferIds.has(t1.id)) continue;

        const targetAccountName = t1.payee.substring(11); // Remove "Transfer : "

        // Find matching transaction: same date, opposite amount, opposite account
        // Note: targetAccountName from Payee should match the account_name of the other transaction
        // And t1.account_name should match the Payee of the other transaction (usually)

        const amount = t1.outflow > 0 ? t1.outflow : t1.inflow;
        const isOutflow = t1.outflow > 0;

        const match = potentialTransfers.find(t2 =>
            t2.id !== t1.id &&
            !processedTransferIds.has(t2.id) &&
            t2.date === t1.date &&
            // Check amounts are opposite (outflow vs inflow)
            ((isOutflow && t2.inflow === amount) || (!isOutflow && t2.outflow === amount)) &&
            // Check accounts match
            t2.account_name === targetAccountName
        );

        if (match) {
            db.prepare(`
                INSERT INTO transfers (from_transaction_id, to_transaction_id)
                VALUES (?, ?)
            `).run(t1.id, match.id); // We just link them, direction doesn't strictly matter for the link but usually from/to implies flow

            processedTransferIds.add(t1.id);
            processedTransferIds.add(match.id);
            transferCount++;
        }
    }
    console.log(`Linked ${transferCount} transfers`);

    // Import budget data
    console.log('Importing budget data...');
    let budgetCount = 0;

    planData.forEach(row => {
        try {
            const month = row.Month;
            const groupName = row['Category Group'];
            const categoryName = row.Category;
            const assigned = parseAmount(row.Assigned);
            const activity = parseAmount(row.Activity);
            const available = parseAmount(row.Available);

            if (!month || !groupName || !categoryName) return;

            const categoryKey = `${groupName.trim()}:${categoryName.trim()}`;
            const categoryId = categoryMap.get(categoryKey);

            if (!categoryId) return;

            // Convert "Jan 2023" to "2023-01"
            const parts = month.trim().split(' ');
            if (parts.length !== 2) return;

            const [monthName, year] = parts;
            const monthMap: any = {
                'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
            };

            if (!monthMap[monthName]) return;

            const monthStr = `${year}-${monthMap[monthName]}`;

            db.prepare(`
        INSERT INTO budget_months (category_id, month, assigned, activity, available)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(category_id, month) DO UPDATE SET
          assigned = excluded.assigned,
          activity = excluded.activity,
          available = excluded.available
      `).run(categoryId, monthStr, assigned, activity, available);

            budgetCount++;
        } catch (error) {
            console.error('Error importing budget entry:', error, row);
        }
    });

    console.log(`Imported ${budgetCount} budget entries`);

    // Update account balances based on transactions (excluding future-dated ones)
    console.log('Updating account balances...');
    accountMap.forEach((accountId, accountName) => {
        const result = db.prepare(`
      SELECT 
        SUM(inflow - outflow) as balance,
        SUM(CASE WHEN cleared IN ('Cleared', 'Reconciled') THEN inflow - outflow ELSE 0 END) as cleared_balance,
        SUM(CASE WHEN cleared = 'Uncleared' THEN inflow - outflow ELSE 0 END) as uncleared_balance
      FROM transactions
      WHERE account_id = ? AND date <= date('now')
    `).get(accountId) as any;

        db.prepare(`
      UPDATE accounts 
      SET balance = ?, cleared_balance = ?, uncleared_balance = ?
      WHERE id = ?
    `).run(result.balance || 0, result.cleared_balance || 0, result.uncleared_balance || 0, accountId);
    });

    // Mark credit card accounts as closed if their CC payment category is in Hidden Categories
    db.prepare(`
      UPDATE accounts SET closed = 1
      WHERE type = 'credit' AND name IN (
        SELECT c.name FROM categories c
        JOIN category_groups cg ON c.category_group_id = cg.id
        WHERE cg.name = 'Hidden Categories'
        AND c.name IN (SELECT name FROM accounts WHERE type = 'credit')
      )
    `).run();
    console.log('Marked closed credit card accounts based on hidden categories');

    console.log('Data import completed successfully!');
}

// Run import
try {
    importData();
} catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
}
