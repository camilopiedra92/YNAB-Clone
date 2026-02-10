/**
 * Test helpers — creates an isolated, in-process PGlite database for each test.
 *
 * Usage:
 *   const { db, fns } = await createTestDb();
 *   // db = Drizzle DB instance (for Drizzle queries in tests)
 *   // fns = all repo functions bound to this instance
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { createDbFunctions } from '../repos';
import type { DrizzleDB } from '../repos/client';
import { budgetMonths } from '../db/schema';
import { milliunit, ZERO, type Milliunit } from '../engine/primitives';

/** Shorthand for creating a branded Milliunit from a number in tests */
export const mu = milliunit;
export { ZERO, type Milliunit };

/** Shape of a raw budget_months row from DB in tests */
export interface RawBudgetMonthRow {
    id: number;
    category_id: number;
    month: string;
    assigned: number;
    activity: number;
    available: number;
}

export async function createTestDb() {
    const pglite = new PGlite();

    const drizzleDb = drizzle(pglite, { schema }) as unknown as DrizzleDB;

    // Create enums
    await drizzleDb.execute(sql`
        CREATE TYPE account_type AS ENUM ('checking', 'savings', 'credit', 'cash', 'investment', 'tracking')
    `);
    await drizzleDb.execute(sql`
        CREATE TYPE cleared_status AS ENUM ('Cleared', 'Uncleared', 'Reconciled')
    `);

    // Create all tables using raw SQL (matching the Drizzle schema exactly)
    await drizzleDb.execute(sql`
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            failed_login_attempts INTEGER DEFAULT 0 NOT NULL,
            locked_until TIMESTAMP,
            created_at TIMESTAMP DEFAULT now()
        )
    `);

    await drizzleDb.execute(sql`
        CREATE TABLE IF NOT EXISTS budgets (
            id SERIAL PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            currency_code TEXT DEFAULT 'COP' NOT NULL,
            currency_symbol TEXT DEFAULT '$' NOT NULL,
            currency_decimals INTEGER DEFAULT 0 NOT NULL,
            created_at TIMESTAMP DEFAULT now(),
            updated_at TIMESTAMP DEFAULT now()
        )
    `);

    await drizzleDb.execute(sql`
        CREATE TABLE IF NOT EXISTS budget_shares (
            id SERIAL PRIMARY KEY,
            budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT DEFAULT 'editor' NOT NULL
        )
    `);

    await drizzleDb.execute(sql`
        CREATE TABLE IF NOT EXISTS accounts (
            id SERIAL PRIMARY KEY,
            budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            type account_type NOT NULL,
            balance DOUBLE PRECISION DEFAULT 0 NOT NULL,
            cleared_balance DOUBLE PRECISION DEFAULT 0 NOT NULL,
            uncleared_balance DOUBLE PRECISION DEFAULT 0 NOT NULL,
            note TEXT DEFAULT '',
            closed BOOLEAN DEFAULT false NOT NULL,
            created_at TEXT DEFAULT now()
        )
    `);
    await drizzleDb.execute(sql`
        CREATE INDEX idx_accounts_budget ON accounts(budget_id)
    `);

    await drizzleDb.execute(sql`
        CREATE TABLE IF NOT EXISTS category_groups (
            id SERIAL PRIMARY KEY,
            budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0 NOT NULL,
            hidden BOOLEAN DEFAULT false NOT NULL,
            is_income BOOLEAN DEFAULT false NOT NULL
        )
    `);
    await drizzleDb.execute(sql`
        CREATE INDEX idx_category_groups_budget ON category_groups(budget_id)
    `);

    await drizzleDb.execute(sql`
        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            category_group_id INTEGER NOT NULL REFERENCES category_groups(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0 NOT NULL,
            hidden BOOLEAN DEFAULT false NOT NULL,
            linked_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL
        )
    `);

    await drizzleDb.execute(sql`
        CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            date DATE NOT NULL,
            payee TEXT,
            category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
            memo TEXT,
            outflow DOUBLE PRECISION DEFAULT 0 NOT NULL,
            inflow DOUBLE PRECISION DEFAULT 0 NOT NULL,
            cleared cleared_status DEFAULT 'Uncleared' NOT NULL,
            flag TEXT,
            created_at TEXT DEFAULT now()
        )
    `);

    await drizzleDb.execute(sql`
        CREATE INDEX idx_transactions_account ON transactions(account_id)
    `);
    await drizzleDb.execute(sql`
        CREATE INDEX idx_transactions_date ON transactions(date)
    `);
    await drizzleDb.execute(sql`
        CREATE INDEX idx_transactions_category ON transactions(category_id)
    `);

    await drizzleDb.execute(sql`
        CREATE TABLE IF NOT EXISTS transfers (
            id SERIAL PRIMARY KEY,
            from_transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
            to_transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE
        )
    `);

    await drizzleDb.execute(sql`
        CREATE TABLE IF NOT EXISTS budget_months (
            id SERIAL PRIMARY KEY,
            category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            month TEXT NOT NULL,
            assigned DOUBLE PRECISION DEFAULT 0 NOT NULL,
            activity DOUBLE PRECISION DEFAULT 0 NOT NULL,
            available DOUBLE PRECISION DEFAULT 0 NOT NULL
        )
    `);
    await drizzleDb.execute(sql`
        CREATE UNIQUE INDEX budget_months_cat_month ON budget_months(category_id, month)
    `);
    await drizzleDb.execute(sql`
        CREATE INDEX idx_budget_months_category ON budget_months(category_id)
    `);
    await drizzleDb.execute(sql`
        CREATE INDEX idx_budget_months_month ON budget_months(month)
    `);

    const fns = createDbFunctions(drizzleDb);

    // Create a default user and budget for convenience in tests
    const userResult = await drizzleDb.insert(schema.users).values({
        name: 'Default User',
        email: 'default@test.com',
        password: 'password',
    }).returning();
    const defaultUser = userResult[0];

    const budgetResult = await drizzleDb.insert(schema.budgets).values({
        userId: defaultUser.id,
        name: 'Default Budget',
    }).returning();
    const defaultBudget = budgetResult[0];

    return { 
        db: drizzleDb, 
        drizzleDb, 
        fns, 
        defaultUserId: defaultUser.id, 
        defaultBudgetId: defaultBudget.id 
    };
}

/**
 * Seeds a minimal budget-ready scenario:
 * - 1 checking account (id returned)
 * - 1 category group with N categories
 * - Returns { accountId, groupId, categoryIds }
 */
export async function seedBasicBudget(fns: ReturnType<typeof createDbFunctions>, options?: {
    categoryCount?: number;
    accountType?: 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'tracking';
    accountName?: string;
    accountBalance?: number;
    db?: DrizzleDB;
    budgetId?: number;
}) {
    const categoryCount = options?.categoryCount ?? 3;
    const accountType = options?.accountType ?? 'checking' as const;
    const accountName = options?.accountName ?? 'Checking';
    const accountBalance = options?.accountBalance ?? 0;
    const db = options?.db;
    let budgetId = options?.budgetId;

    if (!budgetId) {
        if (!db) {
            // This is a bit of a hack for existing tests that don't pass db.
            // In our new createTestDb, there's always a user/budget.
            // But we don't have an easy way to get it here without db.
            // We'll try to use a default or throw if we really can't.
            throw new Error('db or budgetId is required for seedBasicBudget');
        }
        
        // Find existing budget
        const budgets = await db.select().from(schema.budgets).limit(1);
        if (budgets.length > 0) {
            budgetId = budgets[0].id;
        } else {
            // Create user
            const userResult = await db.insert(schema.users).values({
                name: 'Test User',
                email: `test-${Math.random()}@test.com`,
                password: 'password',
            }).returning();
            const user = userResult[0];

            // Create budget
            const budgetResult = await db.insert(schema.budgets).values({
                userId: user.id,
                name: 'Test Budget',
            }).returning();
            budgetId = budgetResult[0].id;
        }
    }

    const accountResult = await fns.createAccount({
        name: accountName,
        type: accountType,
        balance: accountBalance,
        budgetId,
    });
    const accountId = accountResult.id;

    const groupResult = await fns.createCategoryGroup('Essentials', budgetId);
    const groupId = groupResult.id;

    const categoryIds: number[] = [];
    for (let i = 0; i < categoryCount; i++) {
        const catResult = await fns.createCategory({
            name: `Category ${i + 1}`,
            category_group_id: groupId,
        });
        categoryIds.push(catResult.id);
    }

    return { accountId, groupId, categoryIds, budgetId };
}

/**
 * Seeds enough categories to pass the "complete month" threshold (>=10 entries)
 * used by getReadyToAssign's latest-month detection.
 */
export async function seedCompleteMonth(
    fns: ReturnType<typeof createDbFunctions>,
    db: DrizzleDB,
    month: string,
    groupId: number,
    options?: { categoryCount?: number }
) {
    const count = options?.categoryCount ?? 12;
    const categoryIds: number[] = [];

    for (let i = 0; i < count; i++) {
        const catResult = await fns.createCategory({
            name: `Fill Cat ${i + 1}`,
            category_group_id: groupId,
        });
        const catId = catResult.id;
        categoryIds.push(catId);

        // Insert a budget_months row with assigned=0, activity=0, available=0
        // just to make the month "complete" for RTA calculation
        await db.insert(budgetMonths).values({
            categoryId: catId,
            month,
            assigned: ZERO,
            activity: ZERO,
            available: ZERO,
        });
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
