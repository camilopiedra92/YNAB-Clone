'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { AccountDTO } from '@/lib/dtos';
import { STALE_TIME } from '@/lib/constants';

async function fetchAccounts(budgetId: number): Promise<AccountDTO[]> {
    const res = await fetch(`/api/budgets/${budgetId}/accounts`);
    if (!res.ok) throw new Error('Failed to fetch accounts');
    return res.json();
}

export function useAccounts(budgetId?: number) {
    return useQuery<AccountDTO[]>({
        queryKey: ['accounts', budgetId],
        queryFn: () => fetchAccounts(budgetId!),
        staleTime: STALE_TIME.ACCOUNTS,
        enabled: !!budgetId,
    });
}

export function useAccount(budgetId: number | undefined, id: number) {
    const queryClient = useQueryClient();
    return useQuery<AccountDTO | undefined>({
        queryKey: ['accounts', budgetId, id],
        queryFn: async () => {
            const res = await fetch(`/api/budgets/${budgetId}/accounts/${id}`);
            if (!res.ok) throw new Error('Failed to fetch account');
            return res.json();
        },
        initialData: () => {
            const accounts = queryClient.getQueryData<AccountDTO[]>(['accounts', budgetId]);
            return accounts?.find(a => a.id === id);
        },
        staleTime: STALE_TIME.ACCOUNTS,
        enabled: !!budgetId,
    });
}
export function useUpdateAccount(budgetId: number) {
    const queryClient = useQueryClient();
    const t = useTranslations('toasts');
    return useMutation({
        mutationKey: ['account-update', budgetId],
        meta: { errorMessage: t('accountUpdateError'), broadcastKeys: ['accounts'] },
        mutationFn: async ({ id, ...updates }: { id: number; name?: string; note?: string; closed?: boolean }) => {
            const res = await fetch(`/api/budgets/${budgetId}/accounts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...updates, budgetId }),
            });
            if (!res.ok) throw new Error('Failed to update account');
            return res.json();
        },

        onMutate: async ({ id, ...updates }) => {
            await queryClient.cancelQueries({ queryKey: ['accounts', budgetId] });

            // Snapshot for rollback
            const previousAccounts = queryClient.getQueryData<AccountDTO[]>(['accounts', budgetId]);
            const previousAccount = queryClient.getQueryData<AccountDTO>(['accounts', budgetId, id]);
            // Optimistic update on list
            const coerced: Partial<AccountDTO> = {};
            if (updates.name !== undefined) coerced.name = updates.name;
            if (updates.note !== undefined) coerced.note = updates.note;
            if (updates.closed !== undefined) coerced.closed = updates.closed;

            queryClient.setQueryData<AccountDTO[]>(['accounts', budgetId], (old) =>
                old?.map((a) => (a.id === id ? { ...a, ...coerced } : a)),
            );

            // Optimistic update on individual query
            queryClient.setQueryData<AccountDTO>(['accounts', budgetId, id], (old) =>
                old ? { ...old, ...coerced } : old,
            );
            return { previousAccounts, previousAccount };
        },

        onError: (_err, { id }, context) => {
            if (context?.previousAccounts) {
                queryClient.setQueryData(['accounts', budgetId], context.previousAccounts);
            }
            if (context?.previousAccount) {
                queryClient.setQueryData(['accounts', budgetId, id], context.previousAccount);
            }
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts', budgetId] });
        },
    });
}

export function useCreateAccount(budgetId: number) {
    const queryClient = useQueryClient();
    const t = useTranslations('toasts');
    return useMutation({
        mutationKey: ['account-create', budgetId],
        meta: { errorMessage: t('accountCreateError'), broadcastKeys: ['accounts'] },
        mutationFn: async (data: { name: string; type: string; balance: number }) => {
            const res = await fetch(`/api/budgets/${budgetId}/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, budgetId }),
            });
            if (!res.ok) throw new Error('Failed to create account');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts', budgetId] });
        },
    });
}

export type { AccountDTO as Account };
