import { NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import { createCategoryGroup } from '@/lib/repos';
import { validateBody, CreateCategoryGroupSchema } from '@/lib/schemas';
import { requireBudgetAccess } from '@/lib/auth-helpers';

type RouteContext = { params: Promise<{ budgetId: string }> };

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
        const validation = validateBody(CreateCategoryGroupSchema, body);
        if (!validation.success) return validation.response;
        const { name } = validation.data;

        const result = await createCategoryGroup(name, budgetId);
        return NextResponse.json({ success: true, id: result.id });
    } catch (error) {
        logger.error('Error creating category group:', error);
        return apiError('Failed to create category group', 500);
    }
}
