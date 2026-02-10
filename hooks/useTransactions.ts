'use client';

import { useQuery } from '@tanstack/react-query';
import type { TransactionDTO } from '@/lib/dtos';

async function fetchTransactions(budgetId: number, accountId?: number): Promise<TransactionDTO[]> {
    const url = accountId
        ? `/api/budgets/${budgetId}/transactions?accountId=${accountId}`
        : `/api/budgets/${budgetId}/transactions`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
}

export function useTransactions(budgetId: number | undefined, accountId?: number) {
    return useQuery<TransactionDTO[]>({
        queryKey: accountId ? ['transactions', budgetId, accountId] : ['transactions', budgetId],
        queryFn: () => fetchTransactions(budgetId!, accountId),
        staleTime: 15 * 1000,
        enabled: !!budgetId,
    });
}

export type { TransactionDTO as Transaction };
