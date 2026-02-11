import { NextRequest, NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import { toReconciliationInfoDTO } from '@/lib/dtos';
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
            const info = await repos.getReconciliationInfo(budgetId, accountId);
            return NextResponse.json(toReconciliationInfoDTO(info));
        });
    } catch (error) {
        logger.error('Error fetching reconciliation info:', error);
        return apiError('Failed to fetch reconciliation info', 500);
    }
}
