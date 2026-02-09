import { NextResponse } from 'next/server';
import { updateCategoryGroupOrder, updateCategoryOrder } from '@/lib/repos';
import { validateBody, ReorderSchema } from '@/lib/schemas';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validation = validateBody(ReorderSchema, body);
        if (!validation.success) return validation.response;
        const { type, items } = validation.data;

        // Map camelCase input to snake_case for DB layer
        const dbItems = items.map(item => ({
            id: item.id,
            sort_order: item.sortOrder,
            ...(item.categoryGroupId !== undefined ? { category_group_id: item.categoryGroupId } : {}),
        }));

        if (type === 'group') {
            await updateCategoryGroupOrder(dbItems);
        } else {
            await updateCategoryOrder(dbItems);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error reordering categories:', error);
        return NextResponse.json({ error: 'Failed to reorder categories' }, { status: 500 });
    }
}
