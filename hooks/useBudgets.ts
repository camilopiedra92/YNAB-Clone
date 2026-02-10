import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BudgetMetadata } from '@/lib/repos/budgets';
import type { CreateBudgetInput, UpdateBudgetInput } from '@/lib/schemas';

export function useBudgets() {
  return useQuery<BudgetMetadata[]>({
    queryKey: ['budgets'],
    queryFn: async () => {
      const res = await fetch('/api/budgets');
      if (!res.ok) throw new Error('Failed to fetch budgets');
      return res.json();
    },
  });
}

export function useBudget(id?: number) {
  return useQuery<BudgetMetadata>({
    queryKey: ['budgets', id],
    queryFn: async () => {
      if (!id) throw new Error('Budget ID is required');
      const res = await fetch(`/api/budgets/${id}`);
      if (!res.ok) throw new Error('Failed to fetch budget');
      return res.json();
    },
    enabled: !!id,
  });
}

export function useBudgetMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: CreateBudgetInput) => {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create budget');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateBudgetInput }) => {
      const res = await fetch(`/api/budgets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update budget');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budgets', variables.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/budgets/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete budget');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });

  return {
    createBudget: createMutation,
    updateBudget: updateMutation,
    deleteBudget: deleteMutation,
  };
}
