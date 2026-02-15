import { NextRequest, NextResponse } from 'next/server';
import { logger } from "@/lib/logger";
import { apiError } from '@/lib/api-error';
import {
    validateBody,
    CreateTransactionSchema,
    CreateTransferSchema,
    UpdateTransactionSchema,
    TransactionPatchSchema,
} from '@/lib/schemas';
import { toTransactionDTO } from '@/lib/dtos';
import { withBudgetAccess } from '@/lib/with-budget-access';

type RouteContext = { params: Promise<{ budgetId: string }> };

export async function GET(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr } = await params;
        const budgetId = parseInt(budgetIdStr, 10);

        return withBudgetAccess(budgetId, async (_tenant, repos) => {
            const searchParams = request.nextUrl.searchParams;
            const accountId = searchParams.get('accountId');
            const categoryId = searchParams.get('categoryId');
            const startDate = searchParams.get('startDate');
            const endDate = searchParams.get('endDate');
            const limit = searchParams.get('limit');

            const filters: { budgetId: number; accountId?: number; categoryId?: number; startDate?: string; endDate?: string; limit?: number } = { budgetId };
            if (accountId) filters.accountId = parseInt(accountId);
            if (categoryId) filters.categoryId = parseInt(categoryId);
            if (startDate) filters.startDate = startDate;
            if (endDate) filters.endDate = endDate;
            if (limit) filters.limit = parseInt(limit);
            const transactions = (await repos.getTransactions(filters)).map(toTransactionDTO);
            return NextResponse.json(transactions);
        });
    } catch (error) {
        logger.error('Error fetching transactions:', error);
        return apiError('Failed to fetch transactions', 500);
    }
}

export async function POST(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr } = await params;
        const budgetId = parseInt(budgetIdStr, 10);

        return withBudgetAccess(budgetId, async (_tenant, repos) => {
            const body = await request.json();

            // ──── Transfer creation ────
            if (body.isTransfer) {
                const validation = validateBody(CreateTransferSchema, body);
                if (!validation.success) return validation.response;
                const data = validation.data;

                // Validate destination is not a credit card account
                const destType = await repos.getAccountType(data.transferAccountId);
                if (destType === 'credit') {
                    return apiError('Direct transfers to credit card accounts are not allowed. Use the card payment feature.', 400);
                }

                const amount = data.outflow || data.amount || 0;

                const result = await repos.createTransfer(budgetId, {
                    fromAccountId: data.accountId,
                    toAccountId: data.transferAccountId,
                    amount,
                    date: data.date,
                    memo: data.memo,
                    cleared: data.cleared || 'Uncleared',
                });

                const transaction = await repos.getTransaction(budgetId, result.fromTransactionId);

                // CQRS: refresh budget activity on the write path
                const txMonth = data.date.slice(0, 7);
                await repos.refreshAllBudgetActivity(budgetId, txMonth);

                return NextResponse.json(toTransactionDTO(transaction), { status: 201 });
            }

            // ──── Normal transaction creation (atomic) ────
            const validation = validateBody(CreateTransactionSchema, body);
            if (!validation.success) return validation.response;
            const data = validation.data;

            const result = await repos.createTransactionAtomic(budgetId, {
                accountId: data.accountId,
                date: data.date,
                payee: data.payee,
                categoryId: data.categoryId,
                memo: data.memo,
                outflow: data.outflow || 0,
                inflow: data.inflow || 0,
                cleared: data.cleared || 'Uncleared',
                flag: data.flag ?? undefined,
            });

            const transaction = await repos.getTransaction(budgetId, result.id);

            // CQRS: refresh budget activity on the write path
            const txMonth = data.date.slice(0, 7);
            await repos.refreshAllBudgetActivity(budgetId, txMonth);

            return NextResponse.json(toTransactionDTO(transaction), { status: 201 });
        });
    } catch (error) {
        logger.error('Error creating transaction:', error);
        return apiError('Failed to create transaction', 500);
    }
}

export async function PUT(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr } = await params;
        const budgetId = parseInt(budgetIdStr, 10);

        return withBudgetAccess(budgetId, async (_tenant, repos) => {
            const body = await request.json();

            const validation = validateBody(UpdateTransactionSchema, body);
            if (!validation.success) return validation.response;
            const { id, ...updates } = validation.data;

            // Get original transaction to know which account and category to update
            const original = await repos.getTransaction(budgetId, id);
            if (!original) {
                return apiError('Transaction not found or budget mismatch', 404);
            }

            // Build update payload
            const updateData: Partial<{
                date: string; payee: string; categoryId: number | null; memo: string;
                outflow: number; inflow: number; cleared: string; flag: string | null;
            }> = {};
            if (updates.date !== undefined) updateData.date = updates.date;
            if (updates.payee !== undefined) updateData.payee = updates.payee;
            if (updates.categoryId !== undefined) updateData.categoryId = updates.categoryId;
            if (updates.memo !== undefined) updateData.memo = updates.memo;
            if (updates.outflow !== undefined) updateData.outflow = updates.outflow;
            if (updates.inflow !== undefined) updateData.inflow = updates.inflow;
            if (updates.cleared !== undefined) updateData.cleared = updates.cleared;
            if (updates.flag !== undefined) updateData.flag = updates.flag;

            // Atomic: update transaction + balances + budget + CC payment
            await repos.updateTransactionAtomic(budgetId, id, original, updateData);

            const transaction = await repos.getTransaction(budgetId, id);

            // CQRS: refresh budget activity on the write path
            // Deduplicate months and parallelize when date crosses month boundaries
            const txMonth = (updates.date ?? original.date).slice(0, 7);
            const monthsToRefresh = new Set([txMonth]);
            if (updates.date && updates.date.slice(0, 7) !== original.date.slice(0, 7)) {
                monthsToRefresh.add(original.date.slice(0, 7));
            }
            await Promise.all([...monthsToRefresh].map(m => repos.refreshAllBudgetActivity(budgetId, m)));

            return NextResponse.json(toTransactionDTO(transaction));
        });
    } catch (error) {
        logger.error('Error updating transaction:', error);
        return apiError('Failed to update transaction', 500);
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr } = await params;
        const budgetId = parseInt(budgetIdStr, 10);

        return withBudgetAccess(budgetId, async (_tenant, repos) => {
            const searchParams = request.nextUrl.searchParams;
            const id = searchParams.get('id');

            if (!id) {
                return apiError('Transaction ID is required', 400);
            }

            const transactionId = parseInt(id);

            const transaction = await repos.getTransaction(budgetId, transactionId);

            if (!transaction) {
                return apiError('Transaction not found or budget mismatch', 404);
            }

            // Check if this transaction is part of a transfer
            const transfer = await repos.getTransferByTransactionId(budgetId, transactionId);
            if (transfer) {
                await repos.deleteTransfer(budgetId, transfer.id);
                return NextResponse.json({ success: true, deletedTransfer: true });
            }

            // Atomic: delete transaction + update balances + budget + CC payment
            await repos.deleteTransactionAtomic(budgetId, transaction);

            // CQRS: refresh budget activity on the write path
            const txMonth = transaction.date.slice(0, 7);
            await repos.refreshAllBudgetActivity(budgetId, txMonth);

            return NextResponse.json({ success: true });
        });
    } catch (error) {
        logger.error('Error deleting transaction:', error);
        return apiError('Failed to delete transaction', 500);
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext
) {
    try {
        const { budgetId: budgetIdStr } = await params;
        const budgetId = parseInt(budgetIdStr, 10);

        return withBudgetAccess(budgetId, async (_tenant, repos) => {
            const body = await request.json();

            const validation = validateBody(TransactionPatchSchema, body);
            if (!validation.success) return validation.response;
            const data = validation.data;

            if (data.action === 'toggle-cleared') {
                const transaction = await repos.getTransaction(budgetId, data.id);
                if (!transaction) {
                    return apiError('Transaction not found or budget mismatch', 404);
                }

                // Prevent toggling reconciled transactions
                if (transaction.cleared === 'Reconciled') {
                    return apiError('Reconciled transactions cannot be modified', 403);
                }

                // Atomic: toggle cleared + update balances
                await repos.toggleClearedAtomic(budgetId, data.id, transaction.accountId);

                const updated = await repos.getTransaction(budgetId, data.id);
                return NextResponse.json(toTransactionDTO(updated));
            }

            if (data.action === 'reconcile') {
                // Get current cleared balance to verify
                const info = await repos.getReconciliationInfo(budgetId, data.accountId);
                if (!info) {
                    return apiError('Reconciliation info not found for this account', 404);
                }
                const clearedBalance = info.clearedBalance;

                if (Math.abs(Number(clearedBalance) - data.bankBalance) > 0.01) {
                    return apiError('Balance mismatch', 409);
                }

                // Atomic: reconcile + update balances
                const result = await repos.reconcileAccountAtomic(budgetId, data.accountId);

                return NextResponse.json({
                    success: true,
                    reconciledCount: result.reconciledCount,
                });
            }

            return apiError('Invalid action', 400);
        });
    } catch (error) {
        logger.error('Error patching transaction:', error);
        return apiError('Failed to patch transaction', 500);
    }
}
