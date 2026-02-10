/**
 * Tenant Context — Core multi-tenancy type.
 *
 * Represents the authenticated user + their selected budget.
 * Used by auth-helpers to validate budget access before passing
 * (budgetId) to repository functions.
 *
 * The budget (not the user) is the tenant boundary for data isolation.
 */
export interface TenantContext {
  /** Authenticated user's ID (from NextAuth JWT) */
  userId: string;
  /** The budget being accessed (tenant boundary) */
  budgetId: number;
}
