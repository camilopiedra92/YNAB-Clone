import { NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import { validateBody, MoveMoneySchema } from '@/lib/schemas';
import { toBudgetItemDTO } from '@/lib/dtos';
import type { BudgetRowWithOverspending } from '@/lib/dtos/budget.dto';
import { milliunit } from '@/lib/engine/primitives';
import { withBudgetAccess, type TransactionRepos } from '@/lib/with-budget-access';

type RouteContext = { params: Promise<{ budgetId: string }> };

/**
 * Build the full budget response for a given month.
 * Reuses the same pattern as the parent budget route.
 */
async function buildBudgetResponse(repos: TransactionRepos, budgetId: number, month: string) {
    const [rawBudget, readyToAssign, rtaBreakdown, overspendingTypes, monthRange] = await Promise.all([
        repos.getBudgetForMonth(budgetId, month),
        repos.getReadyToAssign(budgetId, month),
        repos.getReadyToAssignBreakdown(budgetId, month),
        repos.getOverspendingTypes(budgetId, month),
        repos.getMonthRange(budgetId),
    ]);

    const inspectorData = await repos.getBudgetInspectorData(budgetId, month, {
        budgetRows: rawBudget,
        rtaBreakdown,
    });

    const budget = rawBudget.map((row) => {
        const enriched: BudgetRowWithOverspending = {
            ...row,
            overspendingType: row.categoryId ? (overspendingTypes[row.categoryId] || null) : null,
        };
        return toBudgetItemDTO(enriched);
    });

    return { budget, readyToAssign, monthRange, rtaBreakdown, overspendingTypes, inspectorData };
}

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
