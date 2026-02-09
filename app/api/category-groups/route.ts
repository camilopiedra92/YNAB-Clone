import { NextResponse } from 'next/server';
import { createCategoryGroup } from '@/lib/repos';
import { validateBody, CreateCategoryGroupSchema } from '@/lib/schemas';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validation = validateBody(CreateCategoryGroupSchema, body);
        if (!validation.success) return validation.response;
        const { name } = validation.data;

        const result = await createCategoryGroup(name);
        return NextResponse.json({ success: true, id: result.id });
    } catch (error) {
        console.error('Error creating category group:', error);
        return NextResponse.json({ error: 'Failed to create category group' }, { status: 500 });
    }
}
