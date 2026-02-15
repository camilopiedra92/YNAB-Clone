import { NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import { validateBody, MoveMoneySchema } from '@/lib/schemas';
import { milliunit } from '@/lib/engine/primitives';
import { withBudgetAccess } from '@/lib/with-budget-access';
import { buildBudgetResponse } from '@/lib/repos/budget-response';

type RouteContext = { params: Promise<{ budgetId: string }> };

/**
 * POST /api/budgets/[budgetId]/budget/move
 *
 * Move money between two categories — adjusts `assigned` on both categories atomically.
 * Body: { sourceCategoryId, targetCategoryId, month, amount }
 */
export async function POST(
    request: Request,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr } = await params;
        const budgetId = parseInt(budgetIdStr, 10);

        return withBudgetAccess(budgetId, async (_tenant, repos) => {
            const body = await request.json();
            const validation = validateBody(MoveMoneySchema, body);
            if (!validation.success) return validation.response;
            const { sourceCategoryId, targetCategoryId, month, amount } = validation.data;

            await repos.moveMoney(budgetId, sourceCategoryId, targetCategoryId, month, milliunit(amount));

            return NextResponse.json({ success: true, ...(await buildBudgetResponse(repos, budgetId, month)) });
        });
    } catch (error) {
        logger.error('Error moving money:', error);
        return apiError('Failed to move money', 500);
    }
}
