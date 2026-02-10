/**
 * Auth Helpers — Budget access validation for API routes.
 *
 * Provides reusable functions to authenticate requests AND verify
 * budget ownership/access in a single call. This is the enforcement
 * layer for multi-tenancy: every API route that operates on budget
 * data must call `requireBudgetAccess()` before proceeding.
 *
 * Also sets PostgreSQL session variables for RLS enforcement (safety net).
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │ Every data-mutating API route MUST call requireBudgetAccess  │
 * │ to prevent cross-tenant data access.                         │
 * └──────────────────────────────────────────────────────────────┘
 */
import { NextResponse } from 'next/server';
import { apiError } from './api-error';
import { sql } from 'drizzle-orm';
import { auth } from './auth';
import { getBudget } from './repos';
import db from './db/client';
import type { DrizzleDB } from './db/client';
import type { TenantContext } from './tenant-context';

/** Result of requireAuth — either a session or an error response */
type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/** Result of requireBudgetAccess — either a TenantContext or an error response */
type BudgetAccessResult =
  | { ok: true; tenant: TenantContext }
  | { ok: false; response: NextResponse };

/**
 * Validate the user is authenticated.
 * Returns userId on success, or a 401 NextResponse on failure.
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: apiError('Unauthorized', 401),
    };
  }
  return { ok: true, userId: session.user.id };
}

/**
 * Set PostgreSQL session variables for Row-Level Security (RLS).
 *
 * Called automatically by `requireBudgetAccess()` after verifying access.
 * Uses `set_config(..., ..., true)` — the `true` makes it local to the
 * current transaction, so it resets automatically.
 *
 * In local dev (superuser), RLS policies exist but don't enforce.
 * This is a defense-in-depth safety net for production.
 */
export async function setTenantContext(
  database: DrizzleDB,
  tenant: TenantContext,
): Promise<void> {
  try {
    await database.execute(
      sql`SELECT set_config('app.budget_id', ${String(tenant.budgetId)}, true),
                 set_config('app.user_id', ${tenant.userId}, true)`
    );
  } catch {
    // Silently ignore — RLS is a safety net, not the primary defense.
    // PGlite (unit tests) doesn't support set_config.
  }
}

/**
 * Validate the user is authenticated AND has access to the given budget.
 *
 * Also sets PostgreSQL session variables for RLS enforcement.
 *
 * Usage in API routes:
 * ```ts
 * const access = await requireBudgetAccess(budgetId);
 * if (!access.ok) return access.response;
 * const { tenant } = access;
 * // tenant.userId and tenant.budgetId are now verified
 * ```
 */
export async function requireBudgetAccess(budgetId: number): Promise<BudgetAccessResult> {
  // Step 1: Verify authentication
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult;

  // Step 2: Validate budgetId
  if (!budgetId || isNaN(budgetId) || budgetId <= 0) {
    return {
      ok: false,
      response: apiError('budgetId is required and must be a positive integer', 400),
    };
  }

  // Step 3: Verify the user has access to this budget (owner or shared)
  const budget = await getBudget(budgetId, authResult.userId);
  if (!budget) {
    return {
      ok: false,
      response: apiError('Budget not found or access denied', 403),
    };
  }

  const tenant: TenantContext = {
    userId: authResult.userId,
    budgetId,
  };

  // Step 4: Set PostgreSQL session variables for RLS (safety net)
  await setTenantContext(db, tenant);

  return {
    ok: true,
    tenant,
  };
}

/**
 * Extract budgetId from a Request's query parameters.
 * Returns the parsed number or null if missing/invalid.
 */
export function extractBudgetId(request: Request): number | null {
  const { searchParams } = new URL(request.url);
  const param = searchParams.get('budgetId');
  if (!param) return null;
  const num = parseInt(param, 10);
  return isNaN(num) ? null : num;
}

/**
 * Safely parse a string to a positive integer ID.
 *
 * Returns null if the input is missing, not a number, zero, or negative.
 * Use this instead of raw `parseInt()` in routes to avoid NaN propagation.
 *
 * @example
 * const budgetId = parseId(budgetIdStr);
 * if (!budgetId) return apiError('Invalid ID', 400);
 */
export function parseId(value: string | undefined | null): number | null {
  if (!value) return null;
  const num = parseInt(value, 10);
  return isNaN(num) || num <= 0 ? null : num;
}
