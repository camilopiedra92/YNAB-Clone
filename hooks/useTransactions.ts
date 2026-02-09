'use client';

import { useQuery } from '@tanstack/react-query';
import type { TransactionDTO } from '@/lib/dtos';

async function fetchTransactions(accountId?: number): Promise<TransactionDTO[]> {
    const url = accountId
        ? `/api/transactions?accountId=${accountId}`
        : '/api/transactions';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
}

export function useTransactions(accountId?: number) {
    return useQuery<TransactionDTO[]>({
        queryKey: accountId ? ['transactions', accountId] : ['transactions'],
        queryFn: () => fetchTransactions(accountId),
        staleTime: 15 * 1000,
    });
}

export type { TransactionDTO as Transaction };
