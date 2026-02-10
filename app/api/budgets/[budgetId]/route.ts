import { NextResponse } from 'next/server';
import { getBudget, updateBudget, deleteBudget } from '@/lib/repos';
import { validateBody, UpdateBudgetSchema } from '@/lib/schemas';
import { requireAuth } from '@/lib/auth-helpers';

type RouteContext = { params: Promise<{ budgetId: string }> };

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  try {
    const { budgetId: budgetIdStr } = await params;
    const budget = await getBudget(parseInt(budgetIdStr), authResult.userId);
    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }
    return NextResponse.json(budget);
  } catch (error) {
    console.error('Error fetching budget:', error);
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  try {
    const { budgetId: budgetIdStr } = await params;
    const body = await request.json();
    const validation = validateBody(UpdateBudgetSchema, body);
    if (!validation.success) return validation.response;

    const result = await updateBudget(parseInt(budgetIdStr), authResult.userId, validation.data);
    if (!result) {
      return NextResponse.json({ error: 'Budget not found or unauthorized' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating budget:', error);
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  try {
    const { budgetId: budgetIdStr } = await params;
    const result = await deleteBudget(parseInt(budgetIdStr), authResult.userId);
    if (!result) {
      return NextResponse.json({ error: 'Budget not found or unauthorized' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting budget:', error);
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 });
  }
}
