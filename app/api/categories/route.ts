import { NextResponse } from 'next/server';
import { updateCategoryName, createCategory, getCategories } from '@/lib/db';

export async function GET() {
    try {
        const categories = getCategories();
        return NextResponse.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name, category_group_id } = await request.json();

        if (!name || !category_group_id) {
            return NextResponse.json({ error: 'Missing name or category_group_id' }, { status: 400 });
        }

        const result = createCategory({ name, category_group_id });
        return NextResponse.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Error creating category:', error);
        return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const { id, name } = await request.json();

        if (!id || !name) {
            return NextResponse.json({ error: 'Missing id or name' }, { status: 400 });
        }

        updateCategoryName(id, name);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating category name:', error);
        return NextResponse.json({ error: 'Failed to update category name' }, { status: 500 });
    }
}
