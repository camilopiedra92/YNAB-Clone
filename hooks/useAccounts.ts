'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import type { AccountDTO } from '@/lib/dtos';

async function fetchAccounts(): Promise<AccountDTO[]> {
    const res = await fetch('/api/accounts');
    if (!res.ok) throw new Error('Failed to fetch accounts');
    return res.json();
}

export function useAccounts() {
    return useQuery<AccountDTO[]>({
        queryKey: ['accounts'],
        queryFn: fetchAccounts,
        staleTime: 30 * 1000,
    });
}

export function useAccount(id: number) {
    const queryClient = useQueryClient();
    return useQuery<AccountDTO | undefined>({
        queryKey: ['accounts', id],
        queryFn: async () => {
            const res = await fetch(`/api/accounts/${id}`);
            if (!res.ok) throw new Error('Failed to fetch account');
            return res.json();
        },
        initialData: () => {
            const accounts = queryClient.getQueryData<AccountDTO[]>(['accounts']);
            return accounts?.find(a => a.id === id);
        },
        staleTime: 30 * 1000,
    });
}

export function useUpdateAccount() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ['account-update'],
        meta: { errorMessage: 'Error al actualizar cuenta', broadcastKeys: ['accounts'] },

        mutationFn: async ({ id, ...updates }: { id: number; name?: string; note?: string; closed?: boolean }) => {
            const res = await fetch(`/api/accounts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!res.ok) throw new Error('Failed to update account');
            return res.json();
        },

        onMutate: async ({ id, ...updates }) => {
            await queryClient.cancelQueries({ queryKey: ['accounts'] });

            // Snapshot for rollback
            const previousAccounts = queryClient.getQueryData<AccountDTO[]>(['accounts']);
            const previousAccount = queryClient.getQueryData<AccountDTO>(['accounts', id]);

            // Optimistic update on list
            const coerced: Partial<AccountDTO> = {};
            if (updates.name !== undefined) coerced.name = updates.name;
            if (updates.note !== undefined) coerced.note = updates.note;
            if (updates.closed !== undefined) coerced.closed = updates.closed;

            queryClient.setQueryData<AccountDTO[]>(['accounts'], (old) =>
                old?.map((a) => (a.id === id ? { ...a, ...coerced } : a)),
            );

            // Optimistic update on individual query
            queryClient.setQueryData<AccountDTO>(['accounts', id], (old) =>
                old ? { ...old, ...coerced } : old,
            );

            return { previousAccounts, previousAccount };
        },

        onError: (_err, { id }, context) => {
            if (context?.previousAccounts) {
                queryClient.setQueryData(['accounts'], context.previousAccounts);
            }
            if (context?.previousAccount) {
                queryClient.setQueryData(['accounts', id], context.previousAccount);
            }
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
        },
    });
}

export type { AccountDTO as Account };
