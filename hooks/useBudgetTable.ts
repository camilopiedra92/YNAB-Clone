'use client';

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { BudgetItemDTO, InspectorDataDTO, BudgetResponseDTO } from '@/lib/dtos';
import { STALE_TIME } from '@/lib/constants';

export type { BudgetItemDTO as BudgetItem };
export type { InspectorDataDTO as InspectorData };

/**
 * Fetches budget table data for a given month.
 *
 * Accepts an optional AbortSignal from React Query so in-flight requests
 * are automatically cancelled when the queryKey changes (month navigation).
 * This prevents stale response pile-up during rapid navigation.
 */
const fetchBudgetTable = async (
    budgetId: number,
    month: string,
    signal?: AbortSignal,
): Promise<BudgetResponseDTO> => {
    const res = await fetch(`/api/budgets/${budgetId}/budget?month=${month}`, { signal });
    if (!res.ok) throw new Error('Failed to fetch budget');
    return res.json();
};

export function useBudgetTable(budgetId: number | undefined, currentMonth: string) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['budget', budgetId, currentMonth],
        // React Query provides `signal` — aborts automatically when queryKey changes
        queryFn: ({ signal }) => fetchBudgetTable(budgetId!, currentMonth, signal),
        placeholderData: keepPreviousData,
        staleTime: STALE_TIME.BUDGET,
        enabled: !!budgetId,
    });

    // Prefetch next and previous months
    useEffect(() => {
        if (!budgetId) return;

        const [year, month] = currentMonth.split('-').map(Number);

        // Next month
        const nextDate = new Date(year, month);
        const nextMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

        // Previous month
        const prevDate = new Date(year, month - 2);
        const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

        queryClient.prefetchQuery({
            queryKey: ['budget', budgetId, nextMonthStr],
            queryFn: ({ signal }) => fetchBudgetTable(budgetId, nextMonthStr, signal),
            staleTime: STALE_TIME.BUDGET,
        });

        queryClient.prefetchQuery({
            queryKey: ['budget', budgetId, prevMonthStr],
            queryFn: ({ signal }) => fetchBudgetTable(budgetId, prevMonthStr, signal),
            staleTime: STALE_TIME.BUDGET,
        });
    }, [budgetId, currentMonth, queryClient]);

    return {
        ...query,
        data: query.data?.budget,
        readyToAssign: query.data?.readyToAssign ?? 0,
        monthRange: query.data?.monthRange ?? null,
        inspectorData: query.data?.inspectorData ?? null,
    };
}
