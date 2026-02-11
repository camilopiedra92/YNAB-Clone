import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { validateBody, CreateBudgetSchema } from '@/lib/schemas';
import { requireAuth } from '@/lib/auth-helpers';
import { createDbFunctions } from '@/lib/db/client';
import db from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-error';

/**
 * Helper to run a callback in a transaction with RLS user context.
 * Used by routes that only need userId (not budgetId).
 */
async function withUserContext<T>(userId: string, fn: (repos: ReturnType<typeof createDbFunctions>) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    // Set both RLS variables — budget_id='0' is a safe no-match default
    // that prevents ''::integer cast errors in RLS policies
    await tx.execute(
      sql`SELECT set_config('app.user_id', ${userId}, true),
                 set_config('app.budget_id', ${'0'}, true)`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repos = createDbFunctions(tx as any);
    return fn(repos);
  });
}

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  try {
    const budgets = await withUserContext(authResult.userId, (repos) =>
      repos.getBudgets(authResult.userId)
    );
    return NextResponse.json(budgets);
  } catch (error) {
    logger.error('Error fetching budgets:', error);
    return apiError('Failed to fetch budgets', 500);
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  try {
    const body = await request.json();
    const validation = validateBody(CreateBudgetSchema, body);
    if (!validation.success) return validation.response;

    const budget = await withUserContext(authResult.userId, (repos) =>
      repos.createBudget(authResult.userId, validation.data)
    );
    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    logger.error('Error creating budget:', error);
    return apiError('Failed to create budget', 500);
  }
}
