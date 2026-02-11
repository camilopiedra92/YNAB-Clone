import { NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import { validateBody, CreateAccountSchema } from '@/lib/schemas';
import { toAccountDTO } from '@/lib/dtos';
import { withBudgetAccess } from '@/lib/with-budget-access';

type RouteContext = { params: Promise<{ budgetId: string }> };

export async function GET(
    _request: Request,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr } = await params;
        const budgetId = parseInt(budgetIdStr, 10);

        return withBudgetAccess(budgetId, async (_tenant, repos) => {
            const accounts = (await repos.getAccounts(budgetId)).map(toAccountDTO);
            return NextResponse.json(accounts);
        });
    } catch (error) {
        logger.error('Error fetching accounts:', error);
        return apiError('Failed to fetch accounts', 500);
    }
}

export async function POST(
    request: Request,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr } = await params;
        const budgetId = parseInt(budgetIdStr, 10);

        return withBudgetAccess(budgetId, async (_tenant, repos) => {
            const body = await request.json();
            const validation = validateBody(CreateAccountSchema, body);
            if (!validation.success) return validation.response;
            const { name, type, balance } = validation.data;

            const result = await repos.createAccount({ budgetId, name, type, balance });
            const accountId = result.id;

            // Auto-create CC Payment category for credit card accounts
            if (type === 'credit') {
                await repos.ensureCreditCardPaymentCategory(accountId, name);
            }

            return NextResponse.json(toAccountDTO({
                id: accountId, budgetId, name, type, balance: balance ?? 0,
                clearedBalance: balance ?? 0, unclearedBalance: 0,
                note: null, closed: false,
            }), { status: 201 });
        });
    } catch (error) {
        logger.error('Error creating account:', error);
        return apiError('Failed to create account', 500);
    }
}
