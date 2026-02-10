import { NextResponse } from 'next/server';
import { updateCategoryName, createCategory, getCategoriesWithGroups } from '@/lib/repos';
import { validateBody, CreateCategorySchema, UpdateCategoryNameSchema } from '@/lib/schemas';
import { toCategoryDTO } from '@/lib/dtos';
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

        const categories = (await getCategoriesWithGroups(budgetId)).map(toCategoryDTO);
        return NextResponse.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
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
        const validation = validateBody(CreateCategorySchema, body);
        if (!validation.success) return validation.response;
        const { name, categoryGroupId } = validation.data;

        const result = await createCategory({ name, category_group_id: categoryGroupId });
        return NextResponse.json({ success: true, id: result.id });
    } catch (error) {
        console.error('Error creating category:', error);
        return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr } = await params;
        const budgetId = parseInt(budgetIdStr, 10);

        const access = await requireBudgetAccess(budgetId);
        if (!access.ok) return access.response;

        const body = await request.json();
        const validation = validateBody(UpdateCategoryNameSchema, body);
        if (!validation.success) return validation.response;
        const { id, name } = validation.data;

        await updateCategoryName(id, name);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating category name:', error);
        return NextResponse.json({ error: 'Failed to update category name' }, { status: 500 });
    }
}
