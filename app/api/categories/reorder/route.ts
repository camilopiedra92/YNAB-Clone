import { NextResponse } from 'next/server';
import { updateCategoryGroupOrder, updateCategoryOrder } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, items } = body;

        if (type === 'group') {
            updateCategoryGroupOrder(items);
        } else if (type === 'category') {
            updateCategoryOrder(items);
        } else {
            return NextResponse.json({ error: 'Invalid reorder type' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error reordering categories:', error);
        return NextResponse.json({ error: 'Failed to reorder categories' }, { status: 500 });
    }
}
