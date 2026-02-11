import { NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import { validateBody, BudgetAssignmentSchema } from '@/lib/schemas';
import { toBudgetItemDTO } from '@/lib/dtos';
import type { BudgetRowWithOverspending } from '@/lib/dtos/budget.dto';
import { milliunit } from '@/lib/engine/primitives';
import { withBudgetAccess, type TransactionRepos } from '@/lib/with-budget-access';

type RouteContext = { params: Promise<{ budgetId: string }> };

async function buildBudgetResponse(repos: TransactionRepos, budgetId: number, month: string) {
    const rawBudget = await repos.getBudgetForMonth(budgetId, month);
    const readyToAssign = await repos.getReadyToAssign(budgetId, month);
    const rtaBreakdown = await repos.getReadyToAssignBreakdown(budgetId, month);
    const overspendingTypes = await repos.getOverspendingTypes(budgetId, month);
    const inspectorData = await repos.getBudgetInspectorData(budgetId, month);

    // Merge overspending types into rows before DTO conversion
    const budget = rawBudget.map((row) => {
        const enriched: BudgetRowWithOverspending = {
            ...row,
            overspendingType: row.categoryId ? (overspendingTypes[row.categoryId] || null) : null,
        };
        return toBudgetItemDTO(enriched);
    });

    return { budget, readyToAssign, rtaBreakdown, overspendingTypes, inspectorData };
}

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

            // Refresh stale activity values from scheduled transactions that are now current
            await repos.refreshAllBudgetActivity(budgetId, month);

            return NextResponse.json(await buildBudgetResponse(repos, budgetId, month));
        });
    } catch (error) {
        logger.error('Error fetching budget:', error);
        return apiError('Failed to fetch budget', 500);
    }
}

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

            return NextResponse.json({ success: true, ...(await buildBudgetResponse(repos, budgetId, month)) });
        });
    } catch (error) {
        logger.error('Error updating budget:', error);
        return apiError('Failed to update budget', 500);
    }
}
