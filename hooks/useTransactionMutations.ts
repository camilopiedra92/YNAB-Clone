'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Types ───────────────────────────────────────────────────────────
interface TransactionPayload {
    id?: number;
    account_id: number;
    date: string;
    payee: string;
    category_id: number | null;
    memo: string;
    outflow: number;
    inflow: number;
    cleared: 'Cleared' | 'Uncleared' | 'Reconciled';
    is_transfer?: boolean;
    transfer_account_id?: number;
}

interface ToggleClearedParams {
    transactionId: number;
    clearedStatus: string;
}

interface Transaction {
    id: number;
    account_id: number;
    account_name?: string;
    date: string;
    payee: string;
    category_id: number | null;
    category_name: string | null;
    memo: string;
    outflow: number;
    inflow: number;
    cleared: 'Cleared' | 'Uncleared' | 'Reconciled';
    transfer_id?: number | null;
    transfer_account_id?: number | null;
    transfer_account_name?: string | null;
    is_future?: number;
}

// ─── Shared invalidation helper ──────────────────────────────────────
function useInvalidateAll() {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        queryClient.invalidateQueries({ queryKey: ['budget'] });
    };
}

// ─── Create Transaction ──────────────────────────────────────────────
export function useCreateTransaction() {
    const queryClient = useQueryClient();
    const invalidateAll = useInvalidateAll();

    return useMutation({
        mutationKey: ['transaction-create'],
        meta: { errorMessage: 'Error al crear transacción', broadcastKeys: ['transactions', 'budget', 'accounts'] },

        mutationFn: async (payload: TransactionPayload) => {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Error al crear transacción');
            }

            return res.json();
        },

        retry: 1,

        onMutate: async (payload) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['transactions'] });

            // Snapshot all transaction query caches for rollback
            const previousQueries = queryClient.getQueriesData<Transaction[]>({
                queryKey: ['transactions'],
            });

            // Create optimistic transaction with temporary negative ID
            const optimistic: Transaction = {
                id: -Date.now(),
                account_id: payload.account_id,
                date: payload.date,
                payee: payload.payee,
                category_id: payload.category_id,
                category_name: null,
                memo: payload.memo,
                outflow: payload.outflow,
                inflow: payload.inflow,
                cleared: payload.cleared,
            };

            // Insert into all matching transaction lists
            queryClient.setQueriesData<Transaction[]>(
                { queryKey: ['transactions'] },
                (old) => (old ? [optimistic, ...old] : [optimistic]),
            );

            return { previousQueries };
        },

        onError: (_err, _vars, context) => {
            // Rollback all transaction caches
            if (context?.previousQueries) {
                for (const [queryKey, data] of context.previousQueries) {
                    queryClient.setQueryData(queryKey, data);
                }
            }
        },

        onSettled: () => {
            invalidateAll();
        },
    });
}

// ─── Update Transaction ──────────────────────────────────────────────
export function useUpdateTransaction() {
    const queryClient = useQueryClient();
    const invalidateAll = useInvalidateAll();

    return useMutation({
        mutationKey: ['transaction-update'],
        meta: { errorMessage: 'Error al actualizar transacción', broadcastKeys: ['transactions', 'budget', 'accounts'] },

        mutationFn: async (payload: TransactionPayload & { id: number }) => {
            const res = await fetch('/api/transactions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Error al actualizar transacción');
            }

            return res.json();
        },

        retry: 1,

        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: ['transactions'] });

            const previousQueries = queryClient.getQueriesData<Transaction[]>({
                queryKey: ['transactions'],
            });

            // Optimistically update the transaction in all cached lists
            queryClient.setQueriesData<Transaction[]>(
                { queryKey: ['transactions'] },
                (old) =>
                    old?.map((t) =>
                        t.id === payload.id
                            ? {
                                ...t,
                                ...payload,
                            }
                            : t,
                    ),
            );

            return { previousQueries };
        },

        onError: (_err, _vars, context) => {
            if (context?.previousQueries) {
                for (const [queryKey, data] of context.previousQueries) {
                    queryClient.setQueryData(queryKey, data);
                }
            }
        },

        onSettled: () => {
            invalidateAll();
        },
    });
}

// ─── Delete Transaction ──────────────────────────────────────────────
export function useDeleteTransaction() {
    const queryClient = useQueryClient();
    const invalidateAll = useInvalidateAll();

    return useMutation({
        mutationKey: ['transaction-delete'],
        meta: { errorMessage: 'Error al eliminar transacción', broadcastKeys: ['transactions', 'budget', 'accounts'] },

        mutationFn: async (transactionId: number) => {
            const res = await fetch(`/api/transactions?id=${transactionId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Error al eliminar transacción');
            }

            return res.json();
        },

        retry: 1,

        onMutate: async (transactionId) => {
            await queryClient.cancelQueries({ queryKey: ['transactions'] });

            const previousQueries = queryClient.getQueriesData<Transaction[]>({
                queryKey: ['transactions'],
            });

            // Find the transaction to check if it's a transfer
            let transferId: number | null | undefined = null;
            for (const [, data] of previousQueries) {
                const tx = data?.find((t) => t.id === transactionId);
                if (tx?.transfer_id) {
                    transferId = tx.transfer_id;
                    break;
                }
            }

            // Optimistically remove from all cached lists
            // If it's a transfer, also remove the paired transaction
            queryClient.setQueriesData<Transaction[]>(
                { queryKey: ['transactions'] },
                (old) => old?.filter((t) => {
                    if (t.id === transactionId) return false;
                    // Also remove paired transfer transaction
                    if (transferId && t.transfer_id === transferId) return false;
                    return true;
                }),
            );

            return { previousQueries };
        },

        onError: (_err, _vars, context) => {
            if (context?.previousQueries) {
                for (const [queryKey, data] of context.previousQueries) {
                    queryClient.setQueryData(queryKey, data);
                }
            }
        },

        onSettled: () => {
            invalidateAll();
        },
    });
}

// ─── Toggle Cleared Status ───────────────────────────────────────────
export function useToggleCleared() {
    const queryClient = useQueryClient();
    const invalidateAll = useInvalidateAll();

    return useMutation({
        mutationKey: ['transaction-toggle-cleared'],
        meta: { errorMessage: 'Error al cambiar estado', broadcastKeys: ['transactions', 'accounts'] },

        mutationFn: async ({ transactionId, clearedStatus }: ToggleClearedParams) => {
            if (clearedStatus === 'Reconciled') {
                return { skipped: true };
            }

            const res = await fetch('/api/transactions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: transactionId, action: 'toggle-cleared' }),
            });

            if (!res.ok) {
                if (res.status === 403) return { skipped: true };
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Error al cambiar estado');
            }

            return { skipped: false };
        },

        retry: 1,

        onMutate: async ({ transactionId, clearedStatus }) => {
            if (clearedStatus === 'Reconciled') return { skipped: true };

            await queryClient.cancelQueries({ queryKey: ['transactions'] });

            const previousQueries = queryClient.getQueriesData<Transaction[]>({
                queryKey: ['transactions'],
            });

            const newStatus = clearedStatus === 'Cleared' ? 'Uncleared' : 'Cleared';

            // Optimistically toggle in all cached lists
            queryClient.setQueriesData<Transaction[]>(
                { queryKey: ['transactions'] },
                (old) =>
                    old?.map((t) =>
                        t.id === transactionId
                            ? { ...t, cleared: newStatus as Transaction['cleared'] }
                            : t,
                    ),
            );

            return { previousQueries, skipped: false };
        },

        onError: (_err, _vars, context) => {
            if (context && 'previousQueries' in context && context.previousQueries) {
                for (const [queryKey, data] of context.previousQueries) {
                    queryClient.setQueryData(queryKey, data);
                }
            }
        },

        onSettled: (_data, _error, _vars, context) => {
            if (context && 'skipped' in context && context.skipped) return;
            invalidateAll();
        },
    });
}

// ─── Get Reconciliation Info ─────────────────────────────────────────
export function useGetReconciliationInfo() {
    return useMutation({
        mutationKey: ['reconciliation-info'],
        meta: { errorMessage: 'Error al obtener información de reconciliación' },

        mutationFn: async (accountId: number) => {
            const res = await fetch('/api/transactions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get-reconciliation-info', accountId }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Error al obtener información de reconciliación');
            }

            return res.json();
        },

        retry: 1,
    });
}

// ─── Reconcile Account ───────────────────────────────────────────────
export function useReconcileAccount() {
    const invalidateAll = useInvalidateAll();

    return useMutation({
        mutationKey: ['reconcile-account'],
        meta: { errorMessage: 'Error al reconciliar', broadcastKeys: ['transactions', 'accounts', 'budget'] },

        mutationFn: async ({ accountId, bankBalance }: { accountId: number; bankBalance: number }) => {
            const res = await fetch('/api/transactions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'reconcile',
                    accountId,
                    bankBalance,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 409) {
                    // Return the mismatch data so caller can handle it
                    return { success: false, mismatch: true, difference: data.difference };
                }
                throw new Error(data.error || 'Error al reconciliar');
            }

            return { success: true, reconciled_count: data.reconciled_count };
        },

        retry: 1,

        onSuccess: (data) => {
            if (data.success) {
                invalidateAll();
            }
        },
    });
}
