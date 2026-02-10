/**
 * Example: Unit test using PGlite in-process DB.
 *
 * Location: lib/__tests__/goals.test.ts
 *
 * Key patterns:
 * - createTestDb() gives you an isolated DB + all repo functions
 * - seedBasicBudget() creates a checking account + categories
 * - mu() creates branded Milliunit values in tests
 * - ZERO is the branded zero constant
 * - Each test gets a fresh database (beforeEach)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedBasicBudget, mu, ZERO } from './test-helpers';
import type { DrizzleDB } from '../repos/client';

describe('Goals', () => {
  let db: DrizzleDB;
  let fns: Awaited<ReturnType<typeof createTestDb>>['fns'];

  beforeEach(async () => {
    const ctx = await createTestDb();
    db = ctx.db;
    fns = ctx.fns;
  });

  it('creates and retrieves a goal', async () => {
    const { categoryIds } = await seedBasicBudget(fns);

    const goal = await fns.createGoal({
      budgetId: 1,
      categoryId: categoryIds[0],
      targetAmount: mu(500_000),
    });

    expect(goal.id).toBeGreaterThan(0);
    expect(Number(goal.targetAmount)).toBe(500_000);

    const goals = await fns.getGoals(1);
    expect(goals).toHaveLength(1);
  });

  it('updates a goal target amount', async () => {
    const { categoryIds } = await seedBasicBudget(fns);

    const goal = await fns.createGoal({
      budgetId: 1,
      categoryId: categoryIds[0],
      targetAmount: mu(500_000),
    });

    await fns.updateGoal(1, goal.id, { targetAmount: mu(1_000_000) });

    const updated = await fns.getGoal(1, goal.id);
    expect(Number(updated.targetAmount)).toBe(1_000_000);
  });

  it('respects budget isolation', async () => {
    const { categoryIds } = await seedBasicBudget(fns);

    await fns.createGoal({
      budgetId: 1,
      categoryId: categoryIds[0],
      targetAmount: mu(500_000),
    });

    // Budget 2 should have no goals
    const otherGoals = await fns.getGoals(2);
    expect(otherGoals).toHaveLength(0);
  });
});
