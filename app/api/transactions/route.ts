import { NextRequest, NextResponse } from 'next/server';
import {
    getTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    getTransaction,
    toggleTransactionCleared,
    updateAccountBalances,
    updateBudgetActivity,
    reconcileAccount,
    getReconciliationInfo,
    isCreditCardAccount,
    updateCreditCardPaymentBudget,
    createTransfer,
    deleteTransfer,
    getTransferByTransactionId,
    getAccountType,
} from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const accountId = searchParams.get('accountId');
        const categoryId = searchParams.get('categoryId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const limit = searchParams.get('limit');

        const filters: any = {};
        if (accountId) filters.accountId = parseInt(accountId);
        if (categoryId) filters.categoryId = parseInt(categoryId);
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;
        if (limit) filters.limit = parseInt(limit);

        const transactions = getTransactions(filters);
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
        if (body.is_transfer) {
            if (!body.transfer_account_id) {
                return NextResponse.json({ error: 'Transfer destination account is required' }, { status: 400 });
            }

            // Validate destination is not a credit card account
            const destType = getAccountType(body.transfer_account_id);
            if (destType === 'credit') {
                return NextResponse.json(
                    { error: 'No se pueden hacer transferencias directas a cuentas de crédito. Usa la función de pago de tarjeta.' },
                    { status: 400 }
                );
            }

            const amount = body.outflow || body.amount || 0;
            if (amount <= 0) {
                return NextResponse.json({ error: 'Transfer amount must be positive' }, { status: 400 });
            }

            const result = createTransfer({
                fromAccountId: body.account_id,
                toAccountId: body.transfer_account_id,
                amount,
                date: body.date,
                memo: body.memo,
                cleared: body.cleared || 'Uncleared',
            });

            const transaction = getTransaction(result.fromTransactionId as number);
            return NextResponse.json(transaction, { status: 201 });
        }

        // ──── Normal transaction creation ────
        const result = createTransaction({
            accountId: body.account_id,
            date: body.date,
            payee: body.payee,
            categoryId: body.category_id,
            memo: body.memo,
            outflow: body.outflow || 0,
            inflow: body.inflow || 0,
            cleared: body.cleared || 'Uncleared',
            flag: body.flag,
        });

        // Update account balances
        updateAccountBalances(body.account_id);

        // Update budget activity if category is specified
        if (body.category_id) {
            const month = body.date.substring(0, 7); // Extract YYYY-MM
            updateBudgetActivity(body.category_id, month);
        }

        // Credit card: auto-move money to CC Payment category
        if (isCreditCardAccount(body.account_id)) {
            const month = body.date.substring(0, 7);
            updateCreditCardPaymentBudget(body.account_id, month);
        }

        const transaction = getTransaction(result.lastInsertRowid as number);
        return NextResponse.json(transaction, { status: 201 });
    } catch (error) {
        console.error('Error creating transaction:', error);
        return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
        }

        // Get original transaction to know which account and category to update
        const original: any = getTransaction(id);
        if (!original) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        // Update transaction
        const updateData: any = {};
        if (updates.date !== undefined) updateData.date = updates.date;
        if (updates.payee !== undefined) updateData.payee = updates.payee;
        if (updates.category_id !== undefined) updateData.categoryId = updates.category_id;
        if (updates.memo !== undefined) updateData.memo = updates.memo;
        if (updates.outflow !== undefined) updateData.outflow = updates.outflow;
        if (updates.inflow !== undefined) updateData.inflow = updates.inflow;
        if (updates.cleared !== undefined) updateData.cleared = updates.cleared;
        if (updates.flag !== undefined) updateData.flag = updates.flag;

        updateTransaction(id, updateData);

        // Update account balances
        updateAccountBalances(original.account_id);

        // Update budget activity for old and new categories
        const oldMonth = original.date.substring(0, 7);
        const newMonth = (updates.date || original.date).substring(0, 7);

        if (original.category_id) {
            updateBudgetActivity(original.category_id, oldMonth);
        }
        if (updates.category_id !== undefined) {
            updateBudgetActivity(updates.category_id, newMonth);
        } else if (original.category_id && oldMonth !== newMonth) {
            updateBudgetActivity(original.category_id, newMonth);
        }

        // Credit card: recalculate CC Payment category
        if (isCreditCardAccount(original.account_id)) {
            updateCreditCardPaymentBudget(original.account_id, oldMonth);
            if (oldMonth !== newMonth) {
                updateCreditCardPaymentBudget(original.account_id, newMonth);
            }
        }

        const transaction = getTransaction(id);
        return NextResponse.json(transaction);
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
        const transaction: any = getTransaction(transactionId);

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        // Check if this transaction is part of a transfer
        const transfer = getTransferByTransactionId(transactionId);
        if (transfer) {
            // Delete both sides of the transfer atomically
            deleteTransfer(transfer.id);
            return NextResponse.json({ success: true, deletedTransfer: true });
        }

        // Regular transaction delete
        deleteTransaction(transactionId);

        // Update account balances
        updateAccountBalances(transaction.account_id);

        // Update budget activity
        if (transaction.category_id) {
            const month = transaction.date.substring(0, 7);
            updateBudgetActivity(transaction.category_id, month);
        }

        // Credit card: recalculate CC Payment category
        if (isCreditCardAccount(transaction.account_id)) {
            const month = transaction.date.substring(0, 7);
            updateCreditCardPaymentBudget(transaction.account_id, month);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, action, accountId, bankBalance } = body;

        if (action === 'toggle-cleared') {
            if (!id) {
                return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
            }

            const transaction: any = getTransaction(id);
            if (!transaction) {
                return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
            }

            // Prevent toggling reconciled transactions
            if (transaction.cleared === 'Reconciled') {
                return NextResponse.json({ error: 'Reconciled transactions cannot be modified' }, { status: 403 });
            }

            toggleTransactionCleared(id);
            updateAccountBalances(transaction.account_id);

            const updated = getTransaction(id);
            return NextResponse.json(updated);
        }

        if (action === 'get-reconciliation-info') {
            if (!accountId) {
                return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
            }
            const info = getReconciliationInfo(accountId);
            return NextResponse.json(info);
        }

        if (action === 'reconcile') {
            if (!accountId) {
                return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
            }
            if (bankBalance === undefined) {
                return NextResponse.json({ error: 'Bank balance is required' }, { status: 400 });
            }

            // Get current cleared balance to verify
            const info = getReconciliationInfo(accountId);
            const clearedBalance = info.cleared_balance;

            if (Math.abs(clearedBalance - bankBalance) > 0.01) {
                return NextResponse.json({
                    error: 'Balance mismatch',
                    cleared_balance: clearedBalance,
                    bank_balance: bankBalance,
                    difference: bankBalance - clearedBalance,
                }, { status: 409 });
            }

            // Mark all Cleared transactions as Reconciled
            const result = reconcileAccount(accountId);
            updateAccountBalances(accountId);

            return NextResponse.json({
                success: true,
                reconciled_count: result.changes,
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Error patching transaction:', error);
        return NextResponse.json({ error: 'Failed to patch transaction' }, { status: 500 });
    }
}
