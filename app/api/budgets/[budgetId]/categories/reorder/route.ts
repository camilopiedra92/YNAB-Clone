import { NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import { validateBody, ReorderSchema } from '@/lib/schemas';
import { withBudgetAccess } from '@/lib/with-budget-access';

type RouteContext = { params: Promise<{ budgetId: string }> };

export async function POST(
    request: Request,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr } = await params;
        const budgetId = parseInt(budgetIdStr, 10);

        return withBudgetAccess(budgetId, async (_tenant, repos) => {
            const body = await request.json();
            const validation = validateBody(ReorderSchema, body);
            if (!validation.success) return validation.response;
            const { type, items } = validation.data;

            if (type === 'group') {
                await repos.updateCategoryGroupOrder(budgetId, items);
            } else {
                await repos.updateCategoryOrder(budgetId, items);
            }

            return NextResponse.json({ success: true });
        });
    } catch (error) {
        logger.error('Error reordering categories:', error);
        return apiError('Failed to reorder categories', 500);
    }
}
