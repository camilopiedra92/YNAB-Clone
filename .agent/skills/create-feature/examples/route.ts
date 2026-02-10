/**
 * Example: Next.js App Router API route.
 *
 * Location: app/api/budgets/[budgetId]/goals/route.ts
 *
 * Every handler MUST:
 * 1. await params (Next.js 15 async params)
 * 2. Call requireBudgetAccess(budgetId)
 * 3. Validate body with validateBody() for writes
 * 4. Use repo functions (never inline SQL)
 * 5. Transform via DTO (never return raw rows)
 * 6. Wrap in try/catch → 500
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireBudgetAccess } from '@/lib/auth-helpers';
import { getGoals, createGoal } from '@/lib/repos';
import { validateBody, CreateGoalSchema } from '@/lib/schemas';
import { toGoalDTO } from '@/lib/dtos';

type RouteContext = { params: Promise<{ budgetId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { budgetId: budgetIdStr } = await params;
    const budgetId = parseInt(budgetIdStr, 10);

    const access = await requireBudgetAccess(budgetId);
    if (!access.ok) return access.response;

    const goals = await getGoals(budgetId);
    return NextResponse.json(goals.map(toGoalDTO));
  } catch (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { budgetId: budgetIdStr } = await params;
    const budgetId = parseInt(budgetIdStr, 10);

    const access = await requireBudgetAccess(budgetId);
    if (!access.ok) return access.response;

    const body = await request.json();
    const validation = validateBody(CreateGoalSchema, body);
    if (!validation.success) return validation.response;

    const goal = await createGoal({ ...validation.data, budgetId });
    return NextResponse.json(toGoalDTO(goal), { status: 201 });
  } catch (error) {
    console.error('Error creating goal:', error);
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
  }
}
