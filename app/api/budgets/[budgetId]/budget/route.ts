import { NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import { validateBody, BudgetAssignmentSchema } from '@/lib/schemas';
import { toBudgetItemDTO } from '@/lib/dtos';
import type { BudgetRowWithOverspending } from '@/lib/dtos/budget.dto';
import { milliunit } from '@/lib/engine/primitives';
import { withBudgetAccess, type TransactionRepos } from '@/lib/with-budget-access';

type RouteContext = { params: Promise<{ budgetId: string }> };

/**
 * Build the full budget response for a given month.
 *
 * Runs independent repo queries in parallel via Promise.all, then passes
 * pre-computed data to getBudgetInspectorData to avoid redundant DB calls.
 *
 * Performance note: getBudgetInspectorData previously re-called
 * getBudgetForMonth + getReadyToAssignBreakdown internally. Now those
 * results are passed in as `precomputed`, eliminating duplicated queries.
 */
async function buildBudgetResponse(repos: TransactionRepos, budgetId: number, month: string) {
    // Phase 1: Independent queries run in parallel
    const [rawBudget, readyToAssign, rtaBreakdown, overspendingTypes, monthRange] = await Promise.all([
        repos.getBudgetForMonth(budgetId, month),
        repos.getReadyToAssign(budgetId, month),
        repos.getReadyToAssignBreakdown(budgetId, month),
        repos.getOverspendingTypes(budgetId, month),
        repos.getMonthRange(budgetId),
    ]);

    // Phase 2: Inspector uses pre-computed data (no redundant getBudgetForMonth/breakdown calls)
    const inspectorData = await repos.getBudgetInspectorData(budgetId, month, {
        budgetRows: rawBudget,
        rtaBreakdown,
    });

    // Merge overspending types into rows before DTO conversion
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
 * GET /api/budgets/[budgetId]/budget?month=YYYY-MM
 *
 * CQRS: Read path — NO writes. refreshAllBudgetActivity is called on the
 * write path (transaction mutations) where data actually changes, not here.
 * This makes month navigation near-instant.
 */
export async function GET(
    request: Request,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr } = await params;
        const budgetId = parseInt(budgetIdStr, 10);

        return withBudgetAccess(budgetId, async (_tenant, repos) => {
            const { searchParams } = new URL(request.url);
            const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

            return NextResponse.json(await buildBudgetResponse(repos, budgetId, month));
        });
    } catch (error) {
        logger.error('Error fetching budget:', error);
        return apiError('Failed to fetch budget', 500);
    }
}

/**
 * POST /api/budgets/[budgetId]/budget
 *
 * Write path — refreshes activity after assignment mutation.
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
            const validation = validateBody(BudgetAssignmentSchema, body);
            if (!validation.success) return validation.response;
            const { categoryId, month, assigned } = validation.data;

            await repos.updateBudgetAssignment(budgetId, categoryId, month, milliunit(assigned));

            // CQRS: Refresh activity on the write path where data changes
            await repos.refreshAllBudgetActivity(budgetId, month);

            return NextResponse.json({ success: true, ...(await buildBudgetResponse(repos, budgetId, month)) });
        });
    } catch (error) {
        logger.error('Error updating budget:', error);
        return apiError('Failed to update budget', 500);
    }
}
