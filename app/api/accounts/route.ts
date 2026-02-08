import { NextResponse } from 'next/server';
import { getAccounts, createAccount, ensureCreditCardPaymentCategory } from '@/lib/db';

export async function GET() {
    try {
        const accounts = getAccounts();
        return NextResponse.json(accounts);
    } catch (error) {
        console.error('Error fetching accounts:', error);
        return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, type, balance } = body;

        const result = createAccount({ name, type, balance });
        const accountId = result.lastInsertRowid as number;

        // Auto-create CC Payment category for credit card accounts
        if (type === 'credit') {
            ensureCreditCardPaymentCategory(accountId, name);
        }

        return NextResponse.json({ id: accountId, name, type, balance }, { status: 201 });
    } catch (error) {
        console.error('Error creating account:', error);
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }
}
