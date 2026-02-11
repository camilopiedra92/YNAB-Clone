'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useCreateTransaction, useUpdateTransaction, useDeleteTransaction } from '@/hooks/useTransactionMutations';
import { usePayees } from '@/hooks/usePayees';
import type { SelectOption } from '@/components/ui/Select';

/** Returns today's date in YYYY-MM-DD format using LOCAL timezone (not UTC). */
function getLocalToday(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

interface Account {
    id: number;
    name: string;
    type?: string;
}

interface Category {
    id: number;
    name: string;
    groupName: string;
}

// API response shape (camelCase DTO)
interface Transaction {
    id?: number;
    accountId: number;
    date: string;
    payee: string;
    categoryId: number | null;
    memo: string;
    outflow: number;
    inflow: number;
    cleared: 'Cleared' | 'Uncleared' | 'Reconciled';
    transferId?: number | null;
    transferAccountId?: number | null;
    transferAccountName?: string | null;
}

// Form state uses camelCase — matches API input payload
interface FormState {
    accountId: number;
    date: string;
    payee: string;
    categoryId: number | null;
    memo: string;
    outflow: number;
    inflow: number;
    cleared: 'Cleared' | 'Uncleared' | 'Reconciled';
}

export interface UseTransactionFormProps {
    budgetId: number;
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    transaction?: Transaction | null;
    accounts: Account[];
    categories: Category[];
    currentAccountId?: number;
}

export type TransactionType = 'outflow' | 'inflow' | 'transfer';

export function useTransactionForm({
    budgetId,
    isOpen,
    onClose,
    onSave,
    transaction,
    accounts,
    categories,
    currentAccountId,
}: UseTransactionFormProps) {
    const [formData, setFormData] = useState<FormState>({
        accountId: 0,
        date: getLocalToday(),
        payee: '',
        categoryId: null,
        memo: '',
        outflow: 0,
        inflow: 0,
        cleared: 'Uncleared',
    });
    const [transactionType, setTransactionType] = useState<TransactionType>('outflow');
    const [amount, setAmount] = useState(0);
    const [transferAccountId, setTransferAccountId] = useState<number | ''>('');

    const createTransaction = useCreateTransaction();
    const updateTransaction = useUpdateTransaction();
    const deleteTransaction = useDeleteTransaction();
    const loading = createTransaction.isPending || updateTransaction.isPending || deleteTransaction.isPending;

    const isEditingTransfer = !!transaction?.transferId;

    useEffect(() => {
        const timer = setTimeout(() => {
            if (transaction) {
                setFormData({
                    accountId: transaction.accountId,
                    date: transaction.date,
                    payee: transaction.payee,
                    categoryId: transaction.categoryId,
                    memo: transaction.memo,
                    outflow: transaction.outflow,
                    inflow: transaction.inflow,
                    cleared: transaction.cleared,
                });
                if (transaction.transferId) {
                    setTransactionType('transfer');
                    setAmount(transaction.outflow > 0 ? transaction.outflow : transaction.inflow);
                    setTransferAccountId(transaction.transferAccountId || '');
                } else if (transaction.outflow > 0) {
                    setTransactionType('outflow');
                    setAmount(transaction.outflow);
                } else {
                    setTransactionType('inflow');
                    setAmount(transaction.inflow);
                }
            } else {
                setFormData({
                    accountId: currentAccountId || accounts[0]?.id || 0,
                    date: getLocalToday(),
                    payee: '',
                    categoryId: null,
                    memo: '',
                    outflow: 0,
                    inflow: 0,
                    cleared: 'Uncleared',
                });
                setTransactionType('outflow');
                setAmount(0);
                setTransferAccountId('');
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [transaction, accounts, currentAccountId]);

    const { data: payees = [] } = usePayees(budgetId, isOpen);

    const accountOptions: SelectOption[] = accounts.map(acc => ({
        value: acc.id,
        label: acc.name,
    }));

    // Transfer destination: exclude current account and credit card accounts
    const transferAccountOptions: SelectOption[] = useMemo(() => {
        const sourceAccountId = formData.accountId || currentAccountId;
        return accounts
            .filter(acc => acc.id !== sourceAccountId && acc.type !== 'credit')
            .map(acc => ({
                value: acc.id,
                label: acc.name,
            }));
    }, [accounts, formData.accountId, currentAccountId]);

    const categoryOptions: SelectOption[] = [
        { value: '', label: 'Sin categoría' },
        ...categories.map(cat => ({
            value: cat.id,
            label: cat.name,
            group: cat.groupName,
        })),
    ];

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();

        const onSuccessCallback = () => {
            onSave();
            onClose();
        };

        if (transactionType === 'transfer') {
            if (!transferAccountId) return;

            if (transaction?.id) {
                // Editing a transfer: only allow date, amount, memo changes
                updateTransaction.mutate(
                    {
                        id: transaction.id,
                        budgetId,
                        accountId: formData.accountId,
                        date: formData.date,
                        payee: formData.payee,
                        categoryId: null,
                        memo: formData.memo,
                        outflow: transaction.outflow > 0 ? amount : 0,
                        inflow: transaction.inflow > 0 ? amount : 0,
                        cleared: formData.cleared,
                    },
                    { onSuccess: onSuccessCallback },
                );
            } else {
                // Creating a new transfer
                createTransaction.mutate(
                    {
                        budgetId,
                        accountId: formData.accountId,
                        date: formData.date,
                        payee: '',
                        categoryId: null,
                        memo: formData.memo,
                        outflow: amount,
                        inflow: 0,
                        cleared: formData.cleared,
                        isTransfer: true,
                        transferAccountId: transferAccountId as number,
                    },
                    { onSuccess: onSuccessCallback },
                );
            }
            return;
        }

        // Normal transaction
        const payload = {
            ...formData,
            outflow: transactionType === 'outflow' ? amount : 0,
            inflow: transactionType === 'inflow' ? amount : 0,
            categoryId: formData.categoryId || null,
        };

        if (transaction?.id) {
            updateTransaction.mutate(
                { id: transaction.id, budgetId, ...payload },
                { onSuccess: onSuccessCallback },
            );
        } else {
            createTransaction.mutate(
                { budgetId, ...payload },
                { onSuccess: onSuccessCallback },
            );
        }
    }, [formData, transactionType, amount, transferAccountId, transaction, budgetId, onSave, onClose, createTransaction, updateTransaction]);

    const handleDelete = useCallback(() => {
        if (transaction?.id && window.confirm('¿Estás seguro de que deseas eliminar esta transacción?')) {
            deleteTransaction.mutate({ budgetId, transactionId: transaction.id }, {
                onSuccess: () => {
                    onSave();
                    onClose();
                },
            });
        }
    }, [transaction, budgetId, onSave, onClose, deleteTransaction]);

    const setOutflowType = useCallback(() => {
        setTransactionType('outflow');
        setTransferAccountId('');
    }, []);

    const setInflowType = useCallback(() => {
        setTransactionType('inflow');
        setTransferAccountId('');
    }, []);

    const setTransferType = useCallback(() => {
        setTransactionType('transfer');
    }, []);

    return {
        // Form state
        formData,
        setFormData,
        transactionType,
        amount,
        setAmount,
        transferAccountId,
        setTransferAccountId,

        // Derived state
        loading,
        isEditingTransfer,

        // Options
        payees,
        accountOptions,
        transferAccountOptions,
        categoryOptions,

        // Handlers
        handleSubmit,
        handleDelete,
        setOutflowType,
        setInflowType,
        setTransferType,
    };
}
