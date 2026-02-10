'use client';

import { useQuery } from '@tanstack/react-query';
import type { CategoryDTO } from '@/lib/dtos';

async function fetchCategories(budgetId: number): Promise<CategoryDTO[]> {
    const res = await fetch(`/api/budgets/${budgetId}/categories`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
}

export function useCategories(budgetId: number | undefined) {
    return useQuery<CategoryDTO[]>({
        queryKey: ['categories', budgetId],
        queryFn: () => fetchCategories(budgetId!),
        staleTime: 5 * 60 * 1000, // categories rarely change
        enabled: !!budgetId,
    });
}

export type { CategoryDTO as Category };
