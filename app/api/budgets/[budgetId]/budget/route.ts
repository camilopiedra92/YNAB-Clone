import { NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import { getBudgetForMonth, getReadyToAssign, getReadyToAssignBreakdown, getOverspendingTypes, getBudgetInspectorData, refreshAllBudgetActivity } from '@/lib/repos';
import { validateBody, BudgetAssignmentSchema } from '@/lib/schemas';
import { toBudgetItemDTO } from '@/lib/dtos';
import type { BudgetRowWithOverspending } from '@/lib/dtos/budget.dto';
import { milliunit } from '@/lib/engine/primitives';
import { requireBudgetAccess } from '@/lib/auth-helpers';

type RouteContext = { params: Promise<{ budgetId: string }> };

async function buildBudgetResponse(budgetId: number, month: string) {
    const rawBudget = await getBudgetForMonth(budgetId, month);
    const readyToAssign = await getReadyToAssign(budgetId, month);
    const rtaBreakdown = await getReadyToAssignBreakdown(budgetId, month);
    const overspendingTypes = await getOverspendingTypes(budgetId, month);
    const inspectorData = await getBudgetInspectorData(budgetId, month);

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

        const access = await requireBudgetAccess(budgetId);
        if (!access.ok) return access.response;

        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

        // Refresh stale activity values from scheduled transactions that are now current
        await refreshAllBudgetActivity(budgetId, month);

        return NextResponse.json(await buildBudgetResponse(budgetId, month));
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

        const access = await requireBudgetAccess(budgetId);
        if (!access.ok) return access.response;

        const body = await request.json();
        const validation = validateBody(BudgetAssignmentSchema, body);
        if (!validation.success) return validation.response;
        const { categoryId, month, assigned } = validation.data;

        const { updateBudgetAssignment } = await import('@/lib/repos');
        await updateBudgetAssignment(budgetId, categoryId, month, milliunit(assigned));

        return NextResponse.json({ success: true, ...(await buildBudgetResponse(budgetId, month)) });
    } catch (error) {
        logger.error('Error updating budget:', error);
        return apiError('Failed to update budget', 500);
    }
}
