import { NextRequest, NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import { getAccount, updateAccount } from '@/lib/repos';
import { validateBody, UpdateAccountSchema } from '@/lib/schemas';
import { toAccountDTO } from '@/lib/dtos';
import { requireBudgetAccess } from '@/lib/auth-helpers';

type RouteContext = { params: Promise<{ budgetId: string; id: string }> };

export async function GET(
    _request: NextRequest,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr, id } = await params;
        const budgetId = parseInt(budgetIdStr, 10);
        const accountId = parseInt(id, 10);
        if (isNaN(accountId)) {
            return apiError('Invalid account ID', 400);
        }

        const access = await requireBudgetAccess(budgetId);
        if (!access.ok) return access.response;

        const account = await getAccount(budgetId, accountId);
        if (!account) {
            return apiError('Account not found', 404);
        }

        return NextResponse.json(toAccountDTO(account));
    } catch (error) {
        logger.error('Error fetching account:', error);
        return apiError('Failed to fetch account', 500);
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr, id } = await params;
        const budgetId = parseInt(budgetIdStr, 10);
        const accountId = parseInt(id, 10);
        if (isNaN(accountId)) {
            return apiError('Invalid account ID', 400);
        }

        const access = await requireBudgetAccess(budgetId);
        if (!access.ok) return access.response;

        const body = await request.json();
        const validation = validateBody(UpdateAccountSchema, body);
        if (!validation.success) return validation.response;
        const { name, note, closed } = validation.data;

        await updateAccount(budgetId, accountId, { name, note: note ?? undefined, closed });

        const updated = await getAccount(budgetId, accountId);
        if (!updated) {
            return apiError('Account not found', 404);
        }
        return NextResponse.json(toAccountDTO(updated));
    } catch (error) {
        logger.error('Error updating account:', error);
        return apiError('Failed to update account', 500);
    }
}
