'use client';

import { useQuery } from '@tanstack/react-query';

async function fetchPayees(budgetId: number): Promise<string[]> {
    const res = await fetch(`/api/budgets/${budgetId}/payees`);
    if (!res.ok) throw new Error('Failed to fetch payees');
    return res.json();
}

/**
 * Query hook for payee auto-complete suggestions.
 * Replaces the manual useEffect+fetch pattern in TransactionModal.
 */
export function usePayees(budgetId: number | undefined, enabled = true) {
    return useQuery<string[]>({
        queryKey: ['payees', budgetId],
        queryFn: () => fetchPayees(budgetId!),
        staleTime: 5 * 60 * 1000, // payees rarely change
        enabled: enabled && !!budgetId,
    });
}
