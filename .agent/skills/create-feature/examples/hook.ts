/**
 * Example: React Query hooks (useQuery + useMutation).
 *
 * Every hook file exports:
 * - useX()          → useQuery for listing
 * - useCreateX()    → useMutation with optimistic update
 * - useUpdateX()    → useMutation with optimistic update
 *
 * Rules (see rule 06):
 * - All mutations have mutationKey + meta
 * - Optimistic updates use snapshot/rollback pattern
 * - cancelQueries before cache manipulation
 * - invalidateQueries in onSettled (not just onSuccess)
 * - Toasts via meta (never direct toast() calls)
 */
'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import type { GoalDTO } from '@/lib/dtos';

// ─── Fetch ───────────────────────────────────────────────────────────

async function fetchGoals(budgetId: number): Promise<GoalDTO[]> {
  const res = await fetch(`/api/budgets/${budgetId}/goals`);
  if (!res.ok) throw new Error('Failed to fetch goals');
  return res.json();
}

// ─── Query ───────────────────────────────────────────────────────────

export function useGoals(budgetId?: number) {
  return useQuery<GoalDTO[]>({
    queryKey: ['goals', budgetId],
    queryFn: () => fetchGoals(budgetId!),
    staleTime: 30 * 1000,
    enabled: !!budgetId,
  });
}

// ─── Mutation ────────────────────────────────────────────────────────

export function useCreateGoal(budgetId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['goal-create', budgetId],
    meta: {
      successMessage: 'Meta creada',
      errorMessage: 'Error al crear meta',
    },

    mutationFn: async (data: { categoryId: number; targetAmount: number; targetDate?: string }) => {
      const res = await fetch(`/api/budgets/${budgetId}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create goal');
      return res.json() as Promise<GoalDTO>;
    },

    // ── Optimistic update ──────────────────────────────────────────
    onMutate: async (vars) => {
      // 1. Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['goals', budgetId] });

      // 2. Snapshot for rollback
      const previous = queryClient.getQueryData<GoalDTO[]>(['goals', budgetId]);

      // 3. Optimistic insert
      queryClient.setQueryData<GoalDTO[]>(['goals', budgetId], (old) => [
        ...(old ?? []),
        { id: -1, budgetId, ...vars, targetDate: vars.targetDate ?? null },
      ]);

      // 4. Return snapshot
      return { previous };
    },

    onError: (_err, _vars, context) => {
      // 5. Rollback on failure
      if (context?.previous) {
        queryClient.setQueryData(['goals', budgetId], context.previous);
      }
    },

    onSettled: () => {
      // 6. Always refetch authoritative data
      queryClient.invalidateQueries({ queryKey: ['goals', budgetId] });
    },
  });
}
