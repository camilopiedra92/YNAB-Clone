import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-error';
import { validateBody, UpdateShareRoleSchema } from '@/lib/schemas';
import { withBudgetAccess } from '@/lib/with-budget-access';
import { parseId } from '@/lib/auth-helpers';
import { toShareDTO } from '@/lib/dtos';

type RouteContext = { params: Promise<{ budgetId: string; shareId: string }> };

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  const { budgetId: budgetIdStr, shareId: shareIdStr } = await params;
  const budgetId = parseId(budgetIdStr);
  const shareId = parseId(shareIdStr);
  if (!budgetId || !shareId) return apiError('Invalid ID', 400);

  return withBudgetAccess(budgetId, async (tenant, repos) => {
    const budget = await repos.getBudget(budgetId, tenant.userId);
    if (!budget || budget.role !== 'owner') {
      return apiError('Solo el propietario puede modificar roles', 403);
    }

    try {
      const body = await request.json();
      const validation = validateBody(UpdateShareRoleSchema, body);
      if (!validation.success) return validation.response;

      const result = await repos.updateShareRole(shareId, validation.data.role);
      if (!result) {
        return apiError('Share not found', 404);
      }
      return NextResponse.json(toShareDTO(result));
    } catch (error) {
      logger.error('Error updating share role:', error);
      return apiError('Failed to update share role', 500);
    }
  });
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
) {
  const { budgetId: budgetIdStr, shareId: shareIdStr } = await params;
  const budgetId = parseId(budgetIdStr);
  const shareId = parseId(shareIdStr);
  if (!budgetId || !shareId) return apiError('Invalid ID', 400);

  return withBudgetAccess(budgetId, async (tenant, repos) => {
    const budget = await repos.getBudget(budgetId, tenant.userId);
    if (!budget) {
      return apiError('Budget not found', 404);
    }

    try {
      const result = await repos.removeShare(shareId);
      if (!result) {
        return apiError('Share not found', 404);
      }
      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error('Error removing share:', error);
      return apiError('Failed to remove share', 500);
    }
  });
}
