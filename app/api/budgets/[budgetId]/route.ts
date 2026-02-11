import { NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { getBudget, updateBudget, deleteBudget } from '@/lib/repos';
import { validateBody, UpdateBudgetSchema } from '@/lib/schemas';
import { requireBudgetAccess, parseId } from '@/lib/auth-helpers';
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

    const access = await requireBudgetAccess(budgetId);
    if (!access.ok) return access.response;

    const budget = await getBudget(budgetId, access.tenant.userId);
    if (!budget) {
      return apiError('Budget not found', 404);
    }
    return NextResponse.json(budget);
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

    const access = await requireBudgetAccess(budgetId);
    if (!access.ok) return access.response;

    // Only owner can update budget settings (name, currency)
    const budget = await getBudget(budgetId, access.tenant.userId);
    if (!budget || budget.role !== 'owner') {
      return apiError('Budget not found or unauthorized', 403);
    }

    const body = await request.json();
    const validation = validateBody(UpdateBudgetSchema, body);
    if (!validation.success) return validation.response;

    const result = await updateBudget(budgetId, access.tenant.userId, validation.data);
    if (!result) {
      return apiError('Budget not found or unauthorized', 404);
    }
    return NextResponse.json(result);
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

    const access = await requireBudgetAccess(budgetId);
    if (!access.ok) return access.response;

    // Only owner can delete a budget
    const budget = await getBudget(budgetId, access.tenant.userId);
    if (!budget || budget.role !== 'owner') {
      return apiError('Budget not found or unauthorized', 403);
    }

    const result = await deleteBudget(budgetId, access.tenant.userId);
    if (!result) {
      return apiError('Budget not found or unauthorized', 404);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting budget', error);
    return apiError('Failed to delete budget', 500);
  }
}
