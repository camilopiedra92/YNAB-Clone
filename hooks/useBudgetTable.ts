'use client';

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { BudgetItemDTO, InspectorDataDTO, BudgetResponseDTO } from '@/lib/dtos';
import { STALE_TIME } from '@/lib/constants';

export type { BudgetItemDTO as BudgetItem };
export type { InspectorDataDTO as InspectorData };

const fetchBudgetTable = async (budgetId: number, month: string): Promise<BudgetResponseDTO> => {
    const res = await fetch(`/api/budgets/${budgetId}/budget?month=${month}`);
    if (!res.ok) throw new Error('Failed to fetch budget');
    return res.json();
};

export function useBudgetTable(budgetId: number | undefined, currentMonth: string) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['budget', budgetId, currentMonth],
        queryFn: () => fetchBudgetTable(budgetId!, currentMonth),
        placeholderData: keepPreviousData,
        staleTime: STALE_TIME.BUDGET,
        enabled: !!budgetId,
    });

    // Prefetch next and previous months
    useEffect(() => {
        const [year, month] = currentMonth.split('-').map(Number);

        // Next month
        const nextDate = new Date(year, month);
        const nextMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

        // Previous month
        const prevDate = new Date(year, month - 2);
        const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

        queryClient.prefetchQuery({
            queryKey: ['budget', budgetId, nextMonthStr],
            queryFn: () => fetchBudgetTable(budgetId!, nextMonthStr),
            staleTime: STALE_TIME.BUDGET,
        });

        queryClient.prefetchQuery({
            queryKey: ['budget', budgetId, prevMonthStr],
            queryFn: () => fetchBudgetTable(budgetId!, prevMonthStr),
            staleTime: STALE_TIME.BUDGET,
        });
    }, [budgetId, currentMonth, queryClient]);

    return {
        ...query,
        data: query.data?.budget,
        readyToAssign: query.data?.readyToAssign ?? 0,
        inspectorData: query.data?.inspectorData ?? null,
    };
}
