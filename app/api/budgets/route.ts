import { NextResponse } from 'next/server';
import { getBudgets, createBudget } from '@/lib/repos';
import { validateBody, CreateBudgetSchema } from '@/lib/schemas';
import { requireAuth } from '@/lib/auth-helpers';

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  try {
    const budgets = await getBudgets(authResult.userId);
    return NextResponse.json(budgets);
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  try {
    const body = await request.json();
    const validation = validateBody(CreateBudgetSchema, body);
    if (!validation.success) return validation.response;

    const budget = await createBudget(authResult.userId, validation.data);
    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    console.error('Error creating budget:', error);
    return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 });
  }
}
