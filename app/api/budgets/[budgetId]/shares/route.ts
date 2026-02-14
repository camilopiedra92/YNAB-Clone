import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-error';
import { validateBody, AddShareSchema } from '@/lib/schemas';
import { withBudgetAccess } from '@/lib/with-budget-access';
import { parseId } from '@/lib/auth-helpers';
import { toShareInfoDTO, toShareDTO } from '@/lib/dtos';

type RouteContext = { params: Promise<{ budgetId: string }> };

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  const { budgetId: budgetIdStr } = await params;
  const budgetId = parseId(budgetIdStr);
  if (!budgetId) return apiError('Invalid budget ID', 400);

  return withBudgetAccess(budgetId, async (_tenant, repos) => {
    try {
      const shares = await repos.getShares(budgetId);
      return NextResponse.json(shares.map(toShareInfoDTO));
    } catch (error) {
      logger.error('Error fetching shares:', error);
      return apiError('Failed to fetch shares', 500);
    }
  });
}

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  const { budgetId: budgetIdStr } = await params;
  const budgetId = parseId(budgetIdStr);
  if (!budgetId) return apiError('Invalid budget ID', 400);

  return withBudgetAccess(budgetId, async (tenant, repos) => {
    const budget = await repos.getBudget(budgetId, tenant.userId);
    if (!budget || budget.role !== 'owner') {
      return apiError('Only the owner can share the budget', 403);
    }

    try {
      const body = await request.json();
      const validation = validateBody(AddShareSchema, body);
      if (!validation.success) return validation.response;

      const { email, role } = validation.data;

      const targetUser = await repos.getUserByEmail(email);
      if (!targetUser) {
        return apiError('User not found with that email', 404);
      }

      if (targetUser.id === tenant.userId) {
        return apiError('Cannot share budget with yourself', 400);
      }

      const share = await repos.addShare(budgetId, targetUser.id, role);
      return NextResponse.json(toShareDTO(share), { status: 201 });
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes('budget_shares_budget_user')) {
        return apiError('User already has access to this budget', 409);
      }
      logger.error('Error adding share:', error);
      return apiError('Failed to add share', 500);
    }
  });
}
