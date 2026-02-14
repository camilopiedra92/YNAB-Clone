import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('toasts');

  const createMutation = useMutation({
    mutationKey: ['budget-create'],
    meta: { errorMessage: t('budgetCreateError') },
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
    mutationKey: ['budget-update'],
    meta: { errorMessage: t('budgetUpdateError') },
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
    mutationKey: ['budget-delete'],
    meta: { errorMessage: t('budgetDeleteError') },
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

// ── Shares ──

export type ShareInfo = {
  id: number;
  budgetId: number;
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  createdAt: string | null;
};

export function useShares(budgetId?: number) {
  return useQuery<ShareInfo[]>({
    queryKey: ['shares', budgetId],
    queryFn: async () => {
      if (!budgetId) throw new Error('Budget ID is required');
      const res = await fetch(`/api/budgets/${budgetId}/shares`);
      if (!res.ok) throw new Error('Failed to fetch shares');
      return res.json();
    },
    enabled: !!budgetId,
  });
}

export function useShareMutations(budgetId: number) {
  const queryClient = useQueryClient();
  const t = useTranslations('toasts');

  const addShare = useMutation({
    mutationKey: ['share-add'],
    retry: false, // 4xx errors (user not found, duplicate, etc.) are not transient
    meta: {
      successMessage: t('shareAddSuccess'),
      errorMessage: t('shareAddError'),
    },
    mutationFn: async (data: { email: string; role?: string }) => {
      const res = await fetch(`/api/budgets/${budgetId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add share');
      }
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', budgetId] });
    },
  });

  const updateRole = useMutation({
    mutationKey: ['share-update-role'],
    meta: {
      successMessage: t('shareUpdateSuccess'),
      errorMessage: t('shareUpdateError'),
    },
    mutationFn: async ({ shareId, role }: { shareId: number; role: string }) => {
      const res = await fetch(`/api/budgets/${budgetId}/shares/${shareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', budgetId] });
    },
  });

  const removeShareMutation = useMutation({
    mutationKey: ['share-remove'],
    meta: {
      successMessage: t('shareRemoveSuccess'),
      errorMessage: t('shareRemoveError'),
    },
    mutationFn: async (shareId: number) => {
      const res = await fetch(`/api/budgets/${budgetId}/shares/${shareId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove share');
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', budgetId] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });

  return {
    addShare,
    updateRole,
    removeShare: removeShareMutation,
  };
}

