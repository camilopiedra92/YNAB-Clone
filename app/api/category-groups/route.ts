import { NextResponse } from 'next/server';
import { createCategoryGroup } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { name } = await request.json();

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const result = createCategoryGroup(name);
        return NextResponse.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Error creating category group:', error);
        return NextResponse.json({ error: 'Failed to create category group' }, { status: 500 });
    }
}
