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
 *
 * `DrizzleDB` and `queryRows` live in `./helpers.ts` (leaf module) so that
 * repos can import them without creating a circular dependency back to this
 * file. Re-exported here for backward compatibility.
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

// Re-export from leaf module for backward compatibility
export { type DrizzleDB, queryRows } from './helpers';
import type { DrizzleDB } from './helpers';

// ── Production singleton ──

import env from '../env';

const connectionString = env.DATABASE_URL;

const client = postgres(connectionString);
const db: DrizzleDB = drizzle(client, { schema });

export default db;

// ── Graceful Shutdown ────────────────────────────────────────
// Clean up PostgreSQL connections on process termination.
// Without this, Docker SIGTERM leaves orphan connections in pg_stat_activity.
if (typeof process !== 'undefined') {
  const shutdown = async (signal: string) => {
    console.log(`[DB] Received ${signal} — closing connections...`);
    try {
      await client.end({ timeout: 5 });
      console.log('[DB] Connections closed cleanly.');
    } catch (err) {
      console.error('[DB] Error during shutdown:', err);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

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
