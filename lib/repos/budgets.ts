import { eq, and } from 'drizzle-orm';
import { budgets, budgetShares } from '../db/schema';
import type { DrizzleDB } from './client';

export type BudgetMetadata = {
  id: number;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimals: number;
  role: string;
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

  return {
    getBudgets,
    getBudget,
    createBudget,
    updateBudget,
    deleteBudget,
  };
}
