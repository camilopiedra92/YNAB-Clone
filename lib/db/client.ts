/**
 * Database Client — Drizzle ORM wrapper, migrations, and composite factory.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ DATABASE ADAPTER — ONLY file that may reference the DB driver. │
 * │ When switching dialects, ONLY this file and lib/db/schema.ts   │
 * │ need to change.                                                │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * `createDbFunctions(database)` composes all domain repos into a single
 * object with the exact same API shape as the original monolithic `lib/db.ts`.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { createAccountFunctions } from '../repos/accounts';
import { createTransactionFunctions } from '../repos/transactions';
import { createBudgetFunctions } from '../repos/budget';
import { createBudgetsFunctions } from '../repos/budgets';
import { createCategoryFunctions } from '../repos/categories';
import { createUserFunctions } from '../repos/users';

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { SQL } from 'drizzle-orm';

/**
 * App-wide database type alias.
 *
 * Consumers import `DrizzleDB` — they never reference `PostgresJsDatabase`
 * directly. This alias is the single point to change if the driver changes.
 */
export type DrizzleDB = PostgresJsDatabase<typeof schema>;

/**
 * Normalize `database.execute(sql)` result across drivers.
 *
 * - **postgres-js**: returns `T[]` (array-like RowList)
 * - **PGlite**: returns `{ rows: T[] }`
 *
 * This helper extracts the rows array regardless of driver format.
 */
export async function queryRows<T extends object>(
  db: DrizzleDB,
  query: SQL,
): Promise<T[]> {
  const result = await db.execute(query);
  // PGlite returns { rows: T[] }, postgres-js returns T[] (array-like)
  if (Array.isArray(result)) return result as unknown as T[];
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as unknown as { rows: T[] }).rows;
  }
  return result as unknown as T[];
}

// ── Production singleton ──

import env from '../env';

const connectionString = env.DATABASE_URL;

const client = postgres(connectionString);
const db: DrizzleDB = drizzle(client, { schema });

export default db;

// ====== Factory: compose all domain repos into a single API ======

export function createDbFunctions(database: DrizzleDB) {
  const accounts = createAccountFunctions(database);
  const categories = createCategoryFunctions(database);

  // Budget must be created before transactions — transactions needs budget operations
  const budget = createBudgetFunctions(database, {
    createCategory: categories.createCategory,
  });

  const transactions = createTransactionFunctions(database, {
    updateAccountBalances: accounts.updateAccountBalances,
    updateBudgetActivity: budget.updateBudgetActivity,
    isCreditCardAccount: accounts.isCreditCardAccount,
    updateCreditCardPaymentBudget: budget.updateCreditCardPaymentBudget,
    reconcileAccount: accounts.reconcileAccount,
  });

  const budgets = createBudgetsFunctions(database);
  const users = createUserFunctions(database, {});

  return {
    ...accounts,
    ...transactions,
    ...budget,
    ...categories,
    ...budgets,
    ...users,
  };
}
