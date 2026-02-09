'use client';

import { useQuery } from '@tanstack/react-query';
import type { CategoryDTO } from '@/lib/dtos';

async function fetchCategories(): Promise<CategoryDTO[]> {
    const res = await fetch('/api/categories');
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
}

export function useCategories() {
    return useQuery<CategoryDTO[]>({
        queryKey: ['categories'],
        queryFn: fetchCategories,
        staleTime: 5 * 60 * 1000, // categories rarely change
    });
}

export type { CategoryDTO as Category };
