import { NextResponse } from 'next/server';
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
        console.error('Error creating category group:', error);
        return NextResponse.json({ error: 'Failed to create category group' }, { status: 500 });
    }
}
