/**
 * withBudgetAccess — Transaction-scoped RLS wrapper for API routes.
 *
 * Solves the critical connection pooling + RLS problem:
 * `set_config()` is per-connection, but pooled connections are shared.
 * This wraps the ENTIRE route handler in a single DB transaction,
 * ensuring `set_config` and all subsequent queries share one connection.
 *
 * Usage in API routes:
 * ```ts
 * export async function GET(req, { params }) {
 *   return withBudgetAccess(parseInt(params.budgetId), async (tenant, repos) => {
 *     const data = await repos.getBudgetForMonth(month);
 *     return NextResponse.json(data);
 *   });
 * }
 * ```
 */
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { apiError } from './api-error';
import { auth } from './auth';
import db from './db/client';
import { createDbFunctions } from './db/client';
import { budgets, budgetShares } from './db/schema';
import type { DrizzleDB } from './db/helpers';
import type { TenantContext } from './tenant-context';

/** The repos object type returned by createDbFunctions */
export type TransactionRepos = ReturnType<typeof createDbFunctions>;

/**
 * Wrap an API route handler in a transaction with RLS context.
 *
 * 1. Authenticates the user
 * 2. Opens a DB transaction
 * 3. Sets `app.user_id` and `app.budget_id` via `set_config` (transaction-local)
 * 4. Verifies budget access (owner or shared)
 * 5. Creates transaction-scoped repos and passes them to the handler
 * 6. Returns the handler's response
 *
 * All queries inside the handler use the SAME connection (the transaction),
 * so RLS policies that depend on `current_setting('app.user_id')` work correctly.
 *
 * The handler also receives `tx` (the raw transaction) for passing to functions
 * like `importDataFromCSV` that accept a DrizzleDB directly.
 */
export async function withBudgetAccess(
  budgetId: number,
  handler: (tenant: TenantContext, repos: TransactionRepos, tx: DrizzleDB) => Promise<NextResponse>,
): Promise<NextResponse> {
  // Step 1: Authenticate
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('Unauthorized', 401);
  }
  const userId = session.user.id;

  // Step 2: Validate budgetId
  if (!budgetId || isNaN(budgetId) || budgetId <= 0) {
    return apiError('budgetId is required and must be a positive integer', 400);
  }

  try {
    // Step 3: Run everything in a single transaction
    return await db.transaction(async (tx) => {
      // Set RLS context — persists for ALL queries in this transaction
      await tx.execute(
        sql`SELECT set_config('app.budget_id', ${String(budgetId)}, true),
                   set_config('app.user_id', ${userId}, true)`
      );

      // Step 4: Verify budget access — single query (owner OR shared) replaces 2 sequential checks
      const accessRows = await tx.execute(
        sql`SELECT b.id FROM ${budgets} b
            LEFT JOIN ${budgetShares} bs ON bs.budget_id = b.id AND bs.user_id = ${userId}
            WHERE b.id = ${budgetId}
              AND (b.user_id = ${userId} OR bs.id IS NOT NULL)
            LIMIT 1`
      );

      if (accessRows.length === 0) {
        return apiError('Budget not found or access denied', 403);
      }

      const tenant: TenantContext = { userId, budgetId };

      // Step 5: Create transaction-scoped repos — ALL queries use same connection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const repos = createDbFunctions(tx as any);

      // Step 6: Run the handler — also pass raw tx for direct DB access
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return handler(tenant, repos, tx as any);
    });
  } catch (error) {
    // If the transaction throws (not a NextResponse), return 500
    if (error instanceof NextResponse) return error;
    throw error;
  }
}
