/**
 * Sentry Utilities — Centralized helpers for user identification, 
 * context enrichment, and breadcrumbs.
 * 
 * All Sentry scope mutations go through this file for consistency.
 * Import these helpers in components, hooks, and API routes —
 * never call Sentry.setUser/setContext/addBreadcrumb directly.
 */
import * as Sentry from '@sentry/nextjs';

// ── Types ────────────────────────────────────────────────────

interface SentryUser {
  id: string;
  email?: string | null;
  name?: string | null;
}

interface BudgetContext {
  budgetId: number;
  role?: string;
  budgetName?: string;
}

// ── User Identification ──────────────────────────────────────

/**
 * Set the current user on the Sentry scope.
 * Called when a session is loaded/changed (e.g., in Providers.tsx).
 */
export function identifyUser(user: SentryUser): void {
  Sentry.setUser({
    id: user.id,
    email: user.email ?? undefined,
    username: user.name ?? undefined,
  });
}

/**
 * Clear the current user from Sentry scope.
 * Called on logout to prevent stale user attribution.
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

// ── Context Enrichment ───────────────────────────────────────

/**
 * Set budget context on the Sentry scope.
 * Called when the user selects/navigates to a budget.
 */
export function setBudgetContext(ctx: BudgetContext): void {
  Sentry.setContext('budget', {
    budget_id: ctx.budgetId,
    role: ctx.role ?? 'owner',
    budget_name: ctx.budgetName,
  });
  Sentry.setTag('budget_id', String(ctx.budgetId));
}

// ── Breadcrumbs ──────────────────────────────────────────────

/**
 * Add a navigation breadcrumb (page transitions).
 */
export function addNavigationBreadcrumb(from: string, to: string): void {
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `${from} → ${to}`,
    level: 'info',
  });
}

/**
 * Add a database operation breadcrumb for debugging slow/failed queries.
 */
export function addDbBreadcrumb(
  operation: string,
  table: string,
  durationMs?: number,
): void {
  Sentry.addBreadcrumb({
    category: 'db',
    message: `${operation} ${table}`,
    level: 'info',
    data: durationMs !== undefined ? { duration_ms: durationMs } : undefined,
  });
}

/**
 * Add a user action breadcrumb (button clicks, form submissions).
 */
export function addUserActionBreadcrumb(
  action: string,
  data?: Record<string, unknown>,
): void {
  Sentry.addBreadcrumb({
    category: 'user',
    message: action,
    level: 'info',
    data,
  });
}
