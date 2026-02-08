'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

interface Account {
    id: number;
    name: string;
    type: string;
    balance: number;
    cleared_balance: number;
    uncleared_balance: number;
    note: string;
    closed: number;
}

async function fetchAccounts(): Promise<Account[]> {
    const res = await fetch('/api/accounts');
    if (!res.ok) throw new Error('Failed to fetch accounts');
    return res.json();
}

export function useAccounts() {
    return useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: fetchAccounts,
        staleTime: 30 * 1000,
    });
}

export function useAccount(id: number) {
    const queryClient = useQueryClient();
    return useQuery<Account | undefined>({
        queryKey: ['accounts', id],
        queryFn: async () => {
            const res = await fetch(`/api/accounts/${id}`);
            if (!res.ok) throw new Error('Failed to fetch account');
            return res.json();
        },
        initialData: () => {
            const accounts = queryClient.getQueryData<Account[]>(['accounts']);
            return accounts?.find(a => a.id === id);
        },
        staleTime: 30 * 1000,
    });
}

export function useUpdateAccount() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ['account-update'],
        meta: { errorMessage: 'Error al actualizar cuenta' },

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
            const previousAccounts = queryClient.getQueryData<Account[]>(['accounts']);
            const previousAccount = queryClient.getQueryData<Account>(['accounts', id]);

            // Coerce boolean closed to number for Account type compatibility
            const coerced: Partial<Account> = {};
            if (updates.name !== undefined) coerced.name = updates.name;
            if (updates.note !== undefined) coerced.note = updates.note;
            if (updates.closed !== undefined) coerced.closed = updates.closed ? 1 : 0;

            // Optimistic update on list
            queryClient.setQueryData<Account[]>(['accounts'], (old) =>
                old?.map((a) => (a.id === id ? { ...a, ...coerced } : a)),
            );

            // Optimistic update on individual query
            queryClient.setQueryData<Account>(['accounts', id], (old) =>
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

export type { Account };
