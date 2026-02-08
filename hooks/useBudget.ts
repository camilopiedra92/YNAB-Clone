'use client';

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect } from 'react';

export interface BudgetItem {
    id: number | null;
    category_id: number | null;
    category_name: string | null;
    group_name: string;
    category_group_id: number;
    group_hidden: number;
    month: string;
    assigned: number;
    activity: number;
    available: number;
    linked_account_id: number | null;
    overspending_type?: 'cash' | 'credit' | null;
}

export interface InspectorData {
    summary: {
        leftOverFromLastMonth: number;
        assignedThisMonth: number;
        activity: number;
        available: number;
    };
    costToBeMe: {
        targets: number;
        expectedIncome: number;
    };
    autoAssign: {
        underfunded: number;
        assignedLastMonth: number;
        spentLastMonth: number;
        averageAssigned: number;
        averageSpent: number;
        reduceOverfunding: number;
        resetAvailableAmounts: number;
        resetAssignedAmounts: number;
    };
    futureAssignments: {
        total: number;
        months: { month: string; amount: number }[];
    };
}

interface BudgetResponse {
    budget: BudgetItem[];
    readyToAssign: number;
    overspendingTypes: Record<number, 'cash' | 'credit' | null>;
    inspectorData: InspectorData;
}

const fetchBudget = async (month: string): Promise<BudgetResponse> => {
    const res = await fetch(`/api/budget?month=${month}`);
    if (!res.ok) throw new Error('Failed to fetch budget');
    const data = await res.json();

    // Merge overspending types into budget items
    if (data.overspendingTypes) {
        data.budget = data.budget.map((item: BudgetItem) => ({
            ...item,
            overspending_type: item.category_id ? (data.overspendingTypes[item.category_id] || null) : null,
        }));
    }

    return data;
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
