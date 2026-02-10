/**
 * Example: Repository using the factory pattern.
 *
 * Every repo exports a `createXFunctions(database)` factory.
 * Wire into `createDbFunctions()` in lib/repos/client.ts.
 * Export individual functions from lib/repos/index.ts barrel.
 */
import { eq, and } from 'drizzle-orm';
import { goals } from '../db/schema';
import { milliunit, ZERO } from '../engine/primitives';
import type { DrizzleDB } from './client';

export function createGoalFunctions(database: DrizzleDB) {

  async function getGoals(budgetId: number) {
    return database.select().from(goals)
      .where(eq(goals.budgetId, budgetId));
  }

  async function getGoal(budgetId: number, id: number) {
    const rows = await database.select().from(goals)
      .where(and(eq(goals.id, id), eq(goals.budgetId, budgetId)));
    return rows[0];
  }

  async function createGoal(data: {
    budgetId: number;
    categoryId: number;
    targetAmount: number;
    targetDate?: string;
  }) {
    const [row] = await database.insert(goals)
      .values({
        budgetId: data.budgetId,
        categoryId: data.categoryId,
        targetAmount: milliunit(data.targetAmount),
        targetDate: data.targetDate ?? null,
      })
      .returning();
    return row;
  }

  async function updateGoal(budgetId: number, id: number, updates: {
    targetAmount?: number;
    targetDate?: string | null;
  }) {
    const setFields: Partial<typeof goals.$inferInsert> = {};
    if (updates.targetAmount !== undefined) setFields.targetAmount = milliunit(updates.targetAmount);
    if (updates.targetDate !== undefined) setFields.targetDate = updates.targetDate;

    if (Object.keys(setFields).length === 0) return;

    return database.update(goals)
      .set(setFields)
      .where(and(eq(goals.id, id), eq(goals.budgetId, budgetId)));
  }

  async function deleteGoal(budgetId: number, id: number) {
    return database.delete(goals)
      .where(and(eq(goals.id, id), eq(goals.budgetId, budgetId)));
  }

  return { getGoals, getGoal, createGoal, updateGoal, deleteGoal };
}
