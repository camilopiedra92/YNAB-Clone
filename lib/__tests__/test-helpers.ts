/**
 * Test helpers — creates an isolated, in-memory SQLite database for each test.
 *
 * Usage:
 *   const { db, fns } = createTestDb();
 *   // db = raw better-sqlite3 instance (for direct SQL inspection)
 *   // fns = all lib/db.ts functions bound to this in-memory database
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { createDbFunctions } from '../db';

const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');

export function createTestDb() {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(schema);

    const fns = createDbFunctions(db);

    return { db, fns };
}

/**
 * Seeds a minimal budget-ready scenario:
 * - 1 checking account (id returned)
 * - 1 category group with N categories
 * - Returns { accountId, groupId, categoryIds }
 */
export function seedBasicBudget(fns: ReturnType<typeof createDbFunctions>, options?: {
    categoryCount?: number;
    accountType?: string;
    accountName?: string;
    accountBalance?: number;
}) {
    const categoryCount = options?.categoryCount ?? 3;
    const accountType = options?.accountType ?? 'checking';
    const accountName = options?.accountName ?? 'Checking';
    const accountBalance = options?.accountBalance ?? 0;

    const accountResult = fns.createAccount({
        name: accountName,
        type: accountType,
        balance: accountBalance,
    });
    const accountId = Number(accountResult.lastInsertRowid);

    const groupResult = fns.createCategoryGroup('Essentials');
    const groupId = Number(groupResult.lastInsertRowid);

    const categoryIds: number[] = [];
    for (let i = 0; i < categoryCount; i++) {
        const catResult = fns.createCategory({
            name: `Category ${i + 1}`,
            category_group_id: groupId,
        });
        categoryIds.push(Number(catResult.lastInsertRowid));
    }

    return { accountId, groupId, categoryIds };
}

/**
 * Seeds enough categories to pass the "complete month" threshold (>=10 entries)
 * used by getReadyToAssign's latest-month detection.
 */
export function seedCompleteMonth(
    fns: ReturnType<typeof createDbFunctions>,
    db: Database.Database,
    month: string,
    groupId: number,
    options?: { categoryCount?: number }
) {
    const count = options?.categoryCount ?? 12;
    const categoryIds: number[] = [];

    for (let i = 0; i < count; i++) {
        const catResult = fns.createCategory({
            name: `Fill Cat ${i + 1}`,
            category_group_id: groupId,
        });
        const catId = Number(catResult.lastInsertRowid);
        categoryIds.push(catId);

        // Insert a budget_months row with assigned=0, activity=0, available=0
        // just to make the month "complete" for RTA calculation
        db.prepare(`
      INSERT INTO budget_months (category_id, month, assigned, activity, available)
      VALUES (?, ?, 0, 0, 0)
    `).run(catId, month);
    }

    return categoryIds;
}

/** Today as YYYY-MM-DD */
export function today(): string {
    return new Date().toISOString().slice(0, 10);
}

/** Current month as YYYY-MM */
export function currentMonth(): string {
    return new Date().toISOString().slice(0, 7);
}

/** Previous month as YYYY-MM */
export function prevMonth(month: string): string {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Next month as YYYY-MM */
export function nextMonth(month: string): string {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
