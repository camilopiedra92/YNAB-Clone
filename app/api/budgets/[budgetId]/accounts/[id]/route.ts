import { NextRequest, NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import { validateBody, UpdateAccountSchema } from '@/lib/schemas';
import { toAccountDTO } from '@/lib/dtos';
import { withBudgetAccess } from '@/lib/with-budget-access';

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

        return withBudgetAccess(budgetId, async (_tenant, repos) => {
            const account = await repos.getAccount(budgetId, accountId);
            if (!account) {
                return apiError('Account not found', 404);
            }

            return NextResponse.json(toAccountDTO(account));
        });
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

        return withBudgetAccess(budgetId, async (_tenant, repos) => {
            const body = await request.json();
            const validation = validateBody(UpdateAccountSchema, body);
            if (!validation.success) return validation.response;
            const { name, note, closed } = validation.data;

            await repos.updateAccount(budgetId, accountId, { name, note: note ?? undefined, closed });

            const updated = await repos.getAccount(budgetId, accountId);
            if (!updated) {
                return apiError('Account not found', 404);
            }
            return NextResponse.json(toAccountDTO(updated));
        });
    } catch (error) {
        logger.error('Error updating account:', error);
        return apiError('Failed to update account', 500);
    }
}
