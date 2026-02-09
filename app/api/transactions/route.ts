import { NextRequest, NextResponse } from 'next/server';
import {
    getTransactions,
    getTransaction,
    getReconciliationInfo,
    getTransferByTransactionId,
    createTransfer,
    deleteTransfer,
    getAccountType,
    // Atomic composite operations
    createTransactionAtomic,
    updateTransactionAtomic,
    deleteTransactionAtomic,
    toggleClearedAtomic,
    reconcileAccountAtomic,
} from '@/lib/repos';
import {
    validateBody,
    CreateTransactionSchema,
    CreateTransferSchema,
    UpdateTransactionSchema,
    TransactionPatchSchema,
} from '@/lib/schemas';
import { toTransactionDTO, toReconciliationInfoDTO } from '@/lib/dtos';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const accountId = searchParams.get('accountId');
        const categoryId = searchParams.get('categoryId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const limit = searchParams.get('limit');

        const filters: { accountId?: number; categoryId?: number; startDate?: string; endDate?: string; limit?: number } = {};
        if (accountId) filters.accountId = parseInt(accountId);
        if (categoryId) filters.categoryId = parseInt(categoryId);
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;
        if (limit) filters.limit = parseInt(limit);

        const transactions = (await getTransactions(filters)).map(toTransactionDTO);
        return NextResponse.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // ──── Transfer creation ────
        if (body.isTransfer) {
            const validation = validateBody(CreateTransferSchema, body);
            if (!validation.success) return validation.response;
            const data = validation.data;

            // Validate destination is not a credit card account
            const destType = await getAccountType(data.transferAccountId);
            if (destType === 'credit') {
                return NextResponse.json(
                    { error: 'No se pueden hacer transferencias directas a cuentas de crédito. Usa la función de pago de tarjeta.' },
                    { status: 400 }
                );
            }

            const amount = data.outflow || data.amount || 0;

            // createTransfer already uses database.transaction() internally
            const result = await createTransfer({
                fromAccountId: data.accountId,
                toAccountId: data.transferAccountId,
                amount,
                date: data.date,
                memo: data.memo,
                cleared: data.cleared || 'Uncleared',
            });

            const transaction = await getTransaction(result.fromTransactionId);
            return NextResponse.json(toTransactionDTO(transaction), { status: 201 });
        }

        // ──── Normal transaction creation (atomic) ────
        const validation = validateBody(CreateTransactionSchema, body);
        if (!validation.success) return validation.response;
        const data = validation.data;

        const result = await createTransactionAtomic({
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

        const transaction = await getTransaction(result.id);
        return NextResponse.json(toTransactionDTO(transaction), { status: 201 });
    } catch (error) {
        console.error('Error creating transaction:', error);
        return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = validateBody(UpdateTransactionSchema, body);
        if (!validation.success) return validation.response;
        const { id, ...updates } = validation.data;

        // Get original transaction to know which account and category to update
        const original = await getTransaction(id);
        if (!original) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
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
        await updateTransactionAtomic(id, original, updateData);

        const transaction = await getTransaction(id);
        return NextResponse.json(toTransactionDTO(transaction));
    } catch (error) {
        console.error('Error updating transaction:', error);
        return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
        }

        const transactionId = parseInt(id);
        const transaction = await getTransaction(transactionId);

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        // Check if this transaction is part of a transfer
        const transfer = await getTransferByTransactionId(transactionId);
        if (transfer) {
            // deleteTransfer already uses database.transaction() internally
            await deleteTransfer(transfer.id);
            return NextResponse.json({ success: true, deletedTransfer: true });
        }

        // Atomic: delete transaction + update balances + budget + CC payment
        await deleteTransactionAtomic(transaction);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = validateBody(TransactionPatchSchema, body);
        if (!validation.success) return validation.response;
        const data = validation.data;

        if (data.action === 'toggle-cleared') {
            const transaction = await getTransaction(data.id);
            if (!transaction) {
                return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
            }

            // Prevent toggling reconciled transactions
            if (transaction.cleared === 'Reconciled') {
                return NextResponse.json({ error: 'Reconciled transactions cannot be modified' }, { status: 403 });
            }

            // Atomic: toggle cleared + update balances
            await toggleClearedAtomic(data.id, transaction.accountId);

            const updated = await getTransaction(data.id);
            return NextResponse.json(toTransactionDTO(updated));
        }

        if (data.action === 'get-reconciliation-info') {
            const info = await getReconciliationInfo(data.accountId);
            return NextResponse.json(toReconciliationInfoDTO(info));
        }

        if (data.action === 'reconcile') {
            // Get current cleared balance to verify
            const info = await getReconciliationInfo(data.accountId);
            const clearedBalance = info!.clearedBalance;

            if (Math.abs(Number(clearedBalance) - data.bankBalance) > 0.01) {
                return NextResponse.json({
                    error: 'Balance mismatch',
                    clearedBalance: clearedBalance,
                    bankBalance: data.bankBalance,
                    difference: data.bankBalance - Number(clearedBalance),
                }, { status: 409 });
            }

            // Atomic: reconcile + update balances
            const result = await reconcileAccountAtomic(data.accountId);

            return NextResponse.json({
                success: true,
                reconciledCount: (result as { changes?: number })?.changes,
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Error patching transaction:', error);
        return NextResponse.json({ error: 'Failed to patch transaction' }, { status: 500 });
    }
}
