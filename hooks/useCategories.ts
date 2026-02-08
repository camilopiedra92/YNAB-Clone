'use client';

import { useQuery } from '@tanstack/react-query';

interface Category {
    id: number;
    name: string;
    group_name: string;
}

async function fetchCategories(): Promise<Category[]> {
    const res = await fetch('/api/categories');
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
}

export function useCategories() {
    return useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: fetchCategories,
        staleTime: 5 * 60 * 1000, // categories rarely change
    });
}

export type { Category };
