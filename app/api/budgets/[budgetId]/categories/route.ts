import { NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import { validateBody, CreateCategorySchema, UpdateCategoryNameSchema } from '@/lib/schemas';
import { toCategoryDTO } from '@/lib/dtos';
import { withBudgetAccess } from '@/lib/with-budget-access';

type RouteContext = { params: Promise<{ budgetId: string }> };

export async function GET(
    _request: Request,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr } = await params;
        const budgetId = parseInt(budgetIdStr, 10);

        return withBudgetAccess(budgetId, async (_tenant, repos) => {
            const categories = (await repos.getCategoriesWithGroups(budgetId)).map(toCategoryDTO);
            return NextResponse.json(categories);
        });
    } catch (error) {
        logger.error('Error fetching categories:', error);
        return apiError('Failed to fetch categories', 500);
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
            const validation = validateBody(CreateCategorySchema, body);
            if (!validation.success) return validation.response;
            const { name, categoryGroupId } = validation.data;

            const result = await repos.createCategory({ name, category_group_id: categoryGroupId });
            return NextResponse.json({ success: true, id: result.id });
        });
    } catch (error) {
        logger.error('Error creating category:', error);
        return apiError('Failed to create category', 500);
    }
}

export async function PATCH(
    request: Request,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr } = await params;
        const budgetId = parseInt(budgetIdStr, 10);

        return withBudgetAccess(budgetId, async (_tenant, repos) => {
            const body = await request.json();
            const validation = validateBody(UpdateCategoryNameSchema, body);
            if (!validation.success) return validation.response;
            const { id, name } = validation.data;

            await repos.updateCategoryName(id, name);
            return NextResponse.json({ success: true });
        });
    } catch (error) {
        logger.error('Error updating category name:', error);
        return apiError('Failed to update category name', 500);
    }
}
