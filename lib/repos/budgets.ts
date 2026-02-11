import { eq, and, sql } from 'drizzle-orm';
import { budgets, budgetShares, users } from '../db/schema';
import type { DrizzleDB } from '../db/helpers';

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
    // We join with budgetShares to get the role if it's a shared budget,
    // or we assume 'owner' if they are the userId in the budgets table.
    
    // First, get owned budgets
    const owned = await database.select({
      id: budgets.id,
      name: budgets.name,
      currencyCode: budgets.currencyCode,
      currencySymbol: budgets.currencySymbol,
      currencyDecimals: budgets.currencyDecimals,
    })
    .from(budgets)
    .where(eq(budgets.userId, userId));

    const ownedWithRole = owned.map(b => ({ ...b, role: 'owner' }));

    // Second, get shared budgets
    const shared = await database.select({
      id: budgets.id,
      name: budgets.name,
      currencyCode: budgets.currencyCode,
      currencySymbol: budgets.currencySymbol,
      currencyDecimals: budgets.currencyDecimals,
      role: budgetShares.role,
    })
    .from(budgets)
    .innerJoin(budgetShares, eq(budgets.id, budgetShares.budgetId))
    .where(eq(budgetShares.userId, userId));

    return [...ownedWithRole, ...shared];
  }

  async function getBudget(id: number, userId: string): Promise<BudgetMetadata | undefined> {
    // Verify access
    const owned = await database.select()
      .from(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .limit(1);

    if (owned.length > 0) {
      return {
        id: owned[0].id,
        name: owned[0].name,
        currencyCode: owned[0].currencyCode,
        currencySymbol: owned[0].currencySymbol,
        currencyDecimals: owned[0].currencyDecimals,
        role: 'owner',
      };
    }

    const shared = await database.select({
      id: budgets.id,
      name: budgets.name,
      currencyCode: budgets.currencyCode,
      currencySymbol: budgets.currencySymbol,
      currencyDecimals: budgets.currencyDecimals,
      role: budgetShares.role,
    })
    .from(budgets)
    .innerJoin(budgetShares, eq(budgets.id, budgetShares.budgetId))
    .where(and(eq(budgets.id, id), eq(budgetShares.userId, userId)))
    .limit(1);

    return shared[0];
  }

  async function createBudget(userId: string, data: {
    name: string;
    currencyCode?: string;
    currencySymbol?: string;
    currencyDecimals?: number;
  }) {
    // Use a transaction to ensure set_config and INSERT run on the same connection.
    // RLS policy budgets_user_isolation requires app.user_id to be set for INSERT.
    const result = await database.transaction(async (tx) => {
      // Set RLS context within this transaction's connection
      await tx.execute(
        sql`SELECT set_config('app.user_id', ${userId}, true)`
      );

      const [row] = await tx.insert(budgets).values({
        userId,
        name: data.name,
        currencyCode: data.currencyCode ?? 'COP',
        currencySymbol: data.currencySymbol ?? '$',
        currencyDecimals: data.currencyDecimals ?? 0,
      }).returning();

      return row;
    });
    
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

