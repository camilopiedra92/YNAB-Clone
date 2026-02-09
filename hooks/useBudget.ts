'use client';

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { BudgetItemDTO, InspectorDataDTO } from '@/lib/dtos';

export type { BudgetItemDTO as BudgetItem };
export type { InspectorDataDTO as InspectorData };

interface BudgetResponse {
    budget: BudgetItemDTO[];
    readyToAssign: number;
    overspendingTypes: Record<number, 'cash' | 'credit' | null>;
    inspectorData: InspectorDataDTO;
}

const fetchBudget = async (month: string): Promise<BudgetResponse> => {
    const res = await fetch(`/api/budget?month=${month}`);
    if (!res.ok) throw new Error('Failed to fetch budget');
    return res.json();
};

export function useBudget(currentMonth: string) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['budget', currentMonth],
        queryFn: () => fetchBudget(currentMonth),
        placeholderData: keepPreviousData,
        staleTime: 5 * 60 * 1000, // 5 minutes
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
            queryKey: ['budget', nextMonthStr],
            queryFn: () => fetchBudget(nextMonthStr),
            staleTime: 5 * 60 * 1000,
        });

        queryClient.prefetchQuery({
            queryKey: ['budget', prevMonthStr],
            queryFn: () => fetchBudget(prevMonthStr),
            staleTime: 5 * 60 * 1000,
        });
    }, [currentMonth, queryClient]);

    return {
        ...query,
        data: query.data?.budget,
        readyToAssign: query.data?.readyToAssign ?? 0,
        inspectorData: query.data?.inspectorData ?? null,
    };
}
