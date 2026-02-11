import { NextResponse } from 'next/server';
import { getBudgets, createBudget } from '@/lib/repos';
import { validateBody, CreateBudgetSchema } from '@/lib/schemas';
import { requireAuth } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-error';

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;

  try {
    const budgets = await getBudgets(authResult.userId);
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

    const budget = await createBudget(authResult.userId, validation.data);
    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    logger.error('Error creating budget:', error);
    return apiError('Failed to create budget', 500);
  }
}
