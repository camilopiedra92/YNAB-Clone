/**
 * Example: Next.js App Router API route.
 *
 * Location: app/api/budgets/[budgetId]/goals/route.ts
 *
 * Every handler MUST use `withBudgetAccess()` which:
 * 1. Authenticates the user (NextAuth session)
 * 2. Wraps all queries in a single DB transaction
 * 3. Sets RLS context (app.budget_id, app.user_id) on the connection
 * 4. Verifies budget ownership/share access
 * 5. Provides transaction-scoped repo functions
 *
 * See rule `11-api-route-patterns.md` for the full pattern.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withBudgetAccess } from '@/lib/with-budget-access';
import { validateBody, CreateGoalSchema } from '@/lib/schemas';
import { toGoalDTO } from '@/lib/dtos';
import { logger as _logger } from '@/lib/logger';

type RouteContext = { params: Promise<{ budgetId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { budgetId: budgetIdStr } = await params;
  const budgetId = parseInt(budgetIdStr, 10);

  return withBudgetAccess(budgetId, async (tenant, repos) => {
    const goals = await repos.getGoals(tenant.budgetId);
    return NextResponse.json(goals.map(toGoalDTO));
  });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { budgetId: budgetIdStr } = await params;
  const budgetId = parseInt(budgetIdStr, 10);

  return withBudgetAccess(budgetId, async (tenant, repos) => {
    const body = await request.json();
    const validation = validateBody(CreateGoalSchema, body);
    if (!validation.success) return validation.response;

    const goal = await repos.createGoal({ ...validation.data, budgetId: tenant.budgetId });
    return NextResponse.json(toGoalDTO(goal), { status: 201 });
  });
}
