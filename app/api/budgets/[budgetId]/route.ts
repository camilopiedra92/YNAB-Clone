import { NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { validateBody, UpdateBudgetSchema } from '@/lib/schemas';
import { withBudgetAccess } from '@/lib/with-budget-access';
import { parseId } from '@/lib/auth-helpers';
import { apiError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ budgetId: string }> };

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { budgetId: budgetIdStr } = await params;
    const budgetId = parseId(budgetIdStr);
    if (!budgetId) return apiError('Invalid budget ID', 400);

    return withBudgetAccess(budgetId, async (tenant, repos) => {
      const budget = await repos.getBudget(budgetId, tenant.userId);
      if (!budget) {
        return apiError('Budget not found', 404);
      }
      return NextResponse.json(budget);
    });
  } catch (error) {
    logger.error('Error fetching budget', error);
    return apiError('Failed to fetch budget', 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { budgetId: budgetIdStr } = await params;
    const budgetId = parseId(budgetIdStr);
    if (!budgetId) return apiError('Invalid budget ID', 400);

    return withBudgetAccess(budgetId, async (tenant, repos) => {
      const budget = await repos.getBudget(budgetId, tenant.userId);
      if (!budget || budget.role !== 'owner') {
        return apiError('Budget not found or unauthorized', 403);
      }

      const body = await request.json();
      const validation = validateBody(UpdateBudgetSchema, body);
      if (!validation.success) return validation.response;

      const result = await repos.updateBudget(budgetId, tenant.userId, validation.data);
      if (!result) {
        return apiError('Budget not found or unauthorized', 404);
      }
      return NextResponse.json(result);
    });
  } catch (error) {
    logger.error('Error updating budget', error);
    return apiError('Failed to update budget', 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { budgetId: budgetIdStr } = await params;
    const budgetId = parseId(budgetIdStr);
    if (!budgetId) return apiError('Invalid budget ID', 400);

    return withBudgetAccess(budgetId, async (tenant, repos) => {
      const budget = await repos.getBudget(budgetId, tenant.userId);
      if (!budget || budget.role !== 'owner') {
        return apiError('Budget not found or unauthorized', 403);
      }

      const result = await repos.deleteBudget(budgetId, tenant.userId);
      if (!result) {
        return apiError('Budget not found or unauthorized', 404);
      }
      return NextResponse.json({ success: true });
    });
  } catch (error) {
    logger.error('Error deleting budget', error);
    return apiError('Failed to delete budget', 500);
  }
}
