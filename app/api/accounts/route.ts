import { NextResponse } from 'next/server';
import { getAccounts, createAccount, ensureCreditCardPaymentCategory } from '@/lib/repos';
import { validateBody, CreateAccountSchema } from '@/lib/schemas';
import { toAccountDTO } from '@/lib/dtos';

export async function GET() {
    try {
        const accounts = (await getAccounts()).map(toAccountDTO);
        return NextResponse.json(accounts);
    } catch (error) {
        console.error('Error fetching accounts:', error);
        return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const validation = validateBody(CreateAccountSchema, body);
        if (!validation.success) return validation.response;
        const { name, type, balance } = validation.data;

        const result = await createAccount({ name, type, balance });
        const accountId = result.id;

        // Auto-create CC Payment category for credit card accounts
        if (type === 'credit') {
            await ensureCreditCardPaymentCategory(accountId, name);
        }

        return NextResponse.json(toAccountDTO({
            id: accountId, name, type, balance: balance ?? 0,
            clearedBalance: balance ?? 0, unclearedBalance: 0,
            note: null, closed: false,
        }), { status: 201 });
    } catch (error) {
        console.error('Error creating account:', error);
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }
}
