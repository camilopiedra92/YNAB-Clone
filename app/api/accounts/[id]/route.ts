import { NextRequest, NextResponse } from 'next/server';
import { getAccount, updateAccount } from '@/lib/db';

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

        const account = getAccount(accountId);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        return NextResponse.json(account);
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
        const { name, note, closed } = body;

        updateAccount(accountId, { name, note, closed });

        const updated = getAccount(accountId);
        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating account:', error);
        return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }
}
