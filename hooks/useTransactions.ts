'use client';

import { useQuery } from '@tanstack/react-query';

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

async function fetchTransactions(accountId?: number): Promise<Transaction[]> {
    const url = accountId
        ? `/api/transactions?accountId=${accountId}`
        : '/api/transactions';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
}

export function useTransactions(accountId?: number) {
    return useQuery<Transaction[]>({
        queryKey: accountId ? ['transactions', accountId] : ['transactions'],
        queryFn: () => fetchTransactions(accountId),
        staleTime: 15 * 1000,
    });
}

export type { Transaction };
