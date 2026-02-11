import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-error';
import { getShares, addShare, getBudget, getUserByEmail } from '@/lib/repos';
import { validateBody, AddShareSchema } from '@/lib/schemas';
import { requireBudgetAccess, parseId } from '@/lib/auth-helpers';
import { toShareInfoDTO, toShareDTO } from '@/lib/dtos';

type RouteContext = { params: Promise<{ budgetId: string }> };

/**
 * GET /api/budgets/:budgetId/shares — List all shared members.
 * Any member (owner, editor, viewer) can view the shares list.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  const { budgetId: budgetIdStr } = await params;
  const budgetId = parseId(budgetIdStr);
  if (!budgetId) return apiError('Invalid budget ID', 400);

  const access = await requireBudgetAccess(budgetId);
  if (!access.ok) return access.response;

  try {
    const shares = await getShares(budgetId);
    return NextResponse.json(shares.map(toShareInfoDTO));
  } catch (error) {
    logger.error('Error fetching shares:', error);
    return apiError('Failed to fetch shares', 500);
  }
}

/**
 * POST /api/budgets/:budgetId/shares — Invite a user by email.
 * Only the budget owner can add shares.
 */
export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  const { budgetId: budgetIdStr } = await params;
  const budgetId = parseId(budgetIdStr);
  if (!budgetId) return apiError('Invalid budget ID', 400);

  const access = await requireBudgetAccess(budgetId);
  if (!access.ok) return access.response;

  // Only owner can invite
  const budget = await getBudget(budgetId, access.tenant.userId);
  if (!budget || budget.role !== 'owner') {
    return apiError('Solo el propietario puede compartir el presupuesto', 403);
  }

  try {
    const body = await request.json();
    const validation = validateBody(AddShareSchema, body);
    if (!validation.success) return validation.response;

    const { email, role } = validation.data;

    // Look up user by email
    const targetUser = await getUserByEmail(email);
    if (!targetUser) {
      return apiError('No se encontró un usuario con ese email', 404);
    }

    // Cannot share with yourself
    if (targetUser.id === access.tenant.userId) {
      return apiError('No puedes compartir el presupuesto contigo mismo', 400);
    }

    const share = await addShare(budgetId, targetUser.id, role);
    return NextResponse.json(toShareDTO(share), { status: 201 });
  } catch (error: unknown) {
    // Handle unique constraint violation (duplicate share)
    if (error instanceof Error && error.message?.includes('budget_shares_budget_user')) {
      return apiError('Este usuario ya tiene acceso al presupuesto', 409);
    }
    logger.error('Error adding share:', error);
    return apiError('Failed to add share', 500);
  }
}
