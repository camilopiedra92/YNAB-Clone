import { eq, and, sql } from 'drizzle-orm';
import { budgets, budgetShares, users } from '../db/schema';
import type { DrizzleDB } from '../db/helpers';
import { queryRows } from '../db/helpers';

export type BudgetMetadata = {
  id: number;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimals: number;
  role: string;
};

export type BudgetShareInfo = {
  id: number;
  budgetId: number;
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  createdAt: Date | null;
};

export function createBudgetsFunctions(database: DrizzleDB) {
  /**
   * List all budgets accessible by a user.
   * Includes both owned budgets and shared budgets.
   */
  async function getBudgets(userId: string): Promise<BudgetMetadata[]> {
    // Single query: UNION ALL replaces 2 sequential queries (owned + shared)
    return queryRows<BudgetMetadata>(database, sql`
      SELECT ${budgets.id} AS "id", ${budgets.name} AS "name",
             ${budgets.currencyCode} AS "currencyCode",
             ${budgets.currencySymbol} AS "currencySymbol",
             ${budgets.currencyDecimals} AS "currencyDecimals",
             'owner' AS "role"
      FROM ${budgets}
      WHERE ${budgets.userId} = ${userId}
      UNION ALL
      SELECT ${budgets.id} AS "id", ${budgets.name} AS "name",
             ${budgets.currencyCode} AS "currencyCode",
             ${budgets.currencySymbol} AS "currencySymbol",
             ${budgets.currencyDecimals} AS "currencyDecimals",
             ${budgetShares.role} AS "role"
      FROM ${budgets}
      INNER JOIN ${budgetShares} ON ${budgets.id} = ${budgetShares.budgetId}
      WHERE ${budgetShares.userId} = ${userId}
    `);
  }

  async function getBudget(id: number, userId: string): Promise<BudgetMetadata | undefined> {
    // Single query: LEFT JOIN replaces 2 sequential queries (owned check + shared check)
    const rows = await queryRows<BudgetMetadata>(database, sql`
      SELECT ${budgets.id} AS "id", ${budgets.name} AS "name",
             ${budgets.currencyCode} AS "currencyCode",
             ${budgets.currencySymbol} AS "currencySymbol",
             ${budgets.currencyDecimals} AS "currencyDecimals",
             CASE WHEN ${budgets.userId} = ${userId} THEN 'owner'
                  ELSE COALESCE(${budgetShares.role}, 'none')
             END AS "role"
      FROM ${budgets}
      LEFT JOIN ${budgetShares} ON ${budgets.id} = ${budgetShares.budgetId}
                                AND ${budgetShares.userId} = ${userId}
      WHERE ${budgets.id} = ${id}
        AND (${budgets.userId} = ${userId} OR ${budgetShares.id} IS NOT NULL)
      LIMIT 1
    `);
    return rows[0];
  }

  async function createBudget(userId: string, data: {
    name: string;
    currencyCode?: string;
    currencySymbol?: string;
    currencyDecimals?: number;
  }) {
    const [result] = await database.insert(budgets).values({
      userId,
      name: data.name,
      currencyCode: data.currencyCode ?? 'COP',
      currencySymbol: data.currencySymbol ?? '$',
      currencyDecimals: data.currencyDecimals ?? 0,
    }).returning();
    
    return result;
  }

  async function updateBudget(id: number, userId: string, data: Partial<{
    name: string;
    currencyCode: string;
    currencySymbol: string;
    currencyDecimals: number;
  }>) {
    // Only owner can update budget settings (name, currency)
    const [result] = await database.update(budgets)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();
    
    return result;
  }

  async function deleteBudget(id: number, userId: string) {
    // Only owner can delete
    const [result] = await database.delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();
    
    return result;
  }

  // ── Share Management ──

  /**
   * List all shares for a budget (excluding the owner).
   * Returns user info (name, email) alongside share data.
   */
  async function getShares(budgetId: number): Promise<BudgetShareInfo[]> {
    const rows = await database.select({
      id: budgetShares.id,
      budgetId: budgetShares.budgetId,
      userId: budgetShares.userId,
      userName: users.name,
      userEmail: users.email,
      role: budgetShares.role,
      createdAt: budgetShares.createdAt,
    })
    .from(budgetShares)
    .innerJoin(users, eq(budgetShares.userId, users.id))
    .where(eq(budgetShares.budgetId, budgetId));

    return rows;
  }

  /**
   * Add a share — invite a user to a budget.
   * The unique index on (budget_id, user_id) prevents duplicates.
   */
  async function addShare(budgetId: number, userId: string, role: string = 'editor') {
    const [result] = await database.insert(budgetShares).values({
      budgetId,
      userId,
      role,
    }).returning();

    return result;
  }

  /**
   * Update the role of an existing share.
   */
  async function updateShareRole(shareId: number, role: string) {
    const [result] = await database.update(budgetShares)
      .set({ role })
      .where(eq(budgetShares.id, shareId))
      .returning();

    return result;
  }

  /**
   * Remove a share — revoke a user's access to a budget.
   */
  async function removeShare(shareId: number) {
    const [result] = await database.delete(budgetShares)
      .where(eq(budgetShares.id, shareId))
      .returning();

    return result;
  }

  return {
    getBudgets,
    getBudget,
    createBudget,
    updateBudget,
    deleteBudget,
    getShares,
    addShare,
    updateShareRole,
    removeShare,
  };
}

