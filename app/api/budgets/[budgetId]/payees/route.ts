import { NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import { getPayees } from '@/lib/repos';
import { requireBudgetAccess } from '@/lib/auth-helpers';

type RouteContext = { params: Promise<{ budgetId: string }> };

export async function GET(
    _request: Request,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr } = await params;
        const budgetId = parseInt(budgetIdStr, 10);

        const access = await requireBudgetAccess(budgetId);
        if (!access.ok) return access.response;

        const payees = await getPayees(budgetId);
        return NextResponse.json(payees);
    } catch (error) {
        logger.error('Error fetching payees:', error);
        return apiError('Failed to fetch payees', 500);
    }
}
