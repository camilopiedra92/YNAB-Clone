import { NextRequest, NextResponse } from 'next/server';
import { getAccount, updateAccount } from '@/lib/repos';
import { validateBody, UpdateAccountSchema } from '@/lib/schemas';
import { toAccountDTO } from '@/lib/dtos';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const accountId = parseInt(id, 10);
        if (isNaN(accountId)) {
            return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
        }

        const account = await getAccount(accountId);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        return NextResponse.json(toAccountDTO(account));
    } catch (error) {
        console.error('Error fetching account:', error);
        return NextResponse.json({ error: 'Failed to fetch account' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const accountId = parseInt(id, 10);
        if (isNaN(accountId)) {
            return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
        }

        const body = await request.json();
        const validation = validateBody(UpdateAccountSchema, body);
        if (!validation.success) return validation.response;
        const { name, note, closed } = validation.data;

        await updateAccount(accountId, { name, note: note ?? undefined, closed });

        const updated = await getAccount(accountId);
        if (!updated) {
            return NextResponse.json({ error: 'Account not found after update' }, { status: 404 });
        }
        return NextResponse.json(toAccountDTO(updated));
    } catch (error) {
        console.error('Error updating account:', error);
        return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }
}
