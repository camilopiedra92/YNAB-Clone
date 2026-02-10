'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TransactionDTO } from '@/lib/dtos';

// ─── Types ───────────────────────────────────────────────────────────

// TransactionPayload uses camelCase — matches the unified API contract
interface TransactionPayload {
    id?: number;
    budgetId: number;
    accountId: number;
    date: string;
    payee: string;
    categoryId: number | null;
    memo: string;
    outflow: number;
    inflow: number;
    cleared: 'Cleared' | 'Uncleared' | 'Reconciled';
    isTransfer?: boolean;
    transferAccountId?: number;
}

interface ToggleClearedParams {
    budgetId: number;
    transactionId: number;
    clearedStatus: string;
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
            const res = await fetch(`/api/budgets/${payload.budgetId}/transactions`, {
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
            const previousQueries = queryClient.getQueriesData<TransactionDTO[]>({
                queryKey: ['transactions'],
            });

            // Create optimistic transaction with temporary negative ID (camelCase DTO shape)
            const optimistic: TransactionDTO = {
                id: -Date.now(),
                budgetId: payload.budgetId,
                accountId: payload.accountId,
                accountName: '',
                date: payload.date,
                payee: payload.payee,
                categoryId: payload.categoryId,
                categoryName: null,
                memo: payload.memo,
                outflow: payload.outflow,
                inflow: payload.inflow,
                cleared: payload.cleared,
                transferId: null,
                transferAccountId: null,
                transferAccountName: null,
                isFuture: false,
                flag: null,
            };

            // Insert into all matching transaction lists
            queryClient.setQueriesData<TransactionDTO[]>(
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
            const res = await fetch(`/api/budgets/${payload.budgetId}/transactions`, {
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

            const previousQueries = queryClient.getQueriesData<TransactionDTO[]>({
                queryKey: ['transactions'],
            });

            // Optimistically update the transaction in all cached lists
            queryClient.setQueriesData<TransactionDTO[]>(
                { queryKey: ['transactions'] },
                (old) =>
                    old?.map((t) =>
                        t.id === payload.id
                            ? {
                                ...t,
                                accountId: payload.accountId,
                                date: payload.date,
                                payee: payload.payee,
                                categoryId: payload.categoryId,
                                memo: payload.memo,
                                outflow: payload.outflow,
                                inflow: payload.inflow,
                                cleared: payload.cleared,
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

        mutationFn: async ({ budgetId, transactionId }: { budgetId: number; transactionId: number }) => {
            const res = await fetch(`/api/budgets/${budgetId}/transactions?id=${transactionId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Error al eliminar transacción');
            }

            return res.json();
        },

        retry: 1,

        onMutate: async ({ transactionId }) => {
            await queryClient.cancelQueries({ queryKey: ['transactions'] });

            const previousQueries = queryClient.getQueriesData<TransactionDTO[]>({
                queryKey: ['transactions'],
            });

            // Find the transaction to check if it's a transfer
            let transferId: number | null | undefined = null;
            for (const [, data] of previousQueries) {
                const tx = data?.find((t) => t.id === transactionId);
                if (tx?.transferId) {
                    transferId = tx.transferId;
                    break;
                }
            }

            // Optimistically remove from all cached lists
            // If it's a transfer, also remove the paired transaction
            queryClient.setQueriesData<TransactionDTO[]>(
                { queryKey: ['transactions'] },
                (old) => old?.filter((t) => {
                    if (t.id === transactionId) return false;
                    // Also remove paired transfer transaction
                    if (transferId && t.transferId === transferId) return false;
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

        mutationFn: async ({ budgetId, transactionId, clearedStatus }: ToggleClearedParams) => {
            if (clearedStatus === 'Reconciled') {
                return { skipped: true };
            }

            const res = await fetch(`/api/budgets/${budgetId}/transactions`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: transactionId, budgetId, action: 'toggle-cleared' }),
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

            const previousQueries = queryClient.getQueriesData<TransactionDTO[]>({
                queryKey: ['transactions'],
            });

            const newStatus = clearedStatus === 'Cleared' ? 'Uncleared' : 'Cleared';

            // Optimistically toggle in all cached lists
            queryClient.setQueriesData<TransactionDTO[]>(
                { queryKey: ['transactions'] },
                (old) =>
                    old?.map((t) =>
                        t.id === transactionId
                            ? { ...t, cleared: newStatus as TransactionDTO['cleared'] }
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

        mutationFn: async ({ budgetId, accountId }: { budgetId: number; accountId: number }) => {
            const res = await fetch(`/api/budgets/${budgetId}/transactions`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get-reconciliation-info', budgetId, accountId }),
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

        mutationFn: async ({ budgetId, accountId, bankBalance }: { budgetId: number; accountId: number; bankBalance: number }) => {
            const res = await fetch(`/api/budgets/${budgetId}/transactions`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'reconcile',
                    budgetId,
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

            return { success: true, reconciledCount: data.reconciledCount };
        },

        retry: 1,

        onSuccess: (data) => {
            if (data.success) {
                invalidateAll();
            }
        },
    });
}
