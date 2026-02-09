'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BudgetItem } from './useBudget';
import {
    parseLocaleNumber,
    MAX_ASSIGNED_VALUE,
    validateAssignment,
    calculateAssignment,
    computeCarryforward,
    toMilliunits,
    type Milliunit,
} from '@/lib/engine';



// ─── Types ───────────────────────────────────────────────────────────
interface UpdateAssignedParams {
    categoryId: number;
    month: string;
    value: string;
    currentBudgetData: BudgetItem[];
}

interface UpdateCategoryNameParams {
    categoryId: number;
    newName: string;
    currentName: string | null;
}

interface ReorderParams {
    type: 'group' | 'category';
    items: { id: number | null; sortOrder: number; categoryGroupId?: number }[];
}

// ─── Hooks ───────────────────────────────────────────────────────────

export function useUpdateAssigned(currentMonth: string) {
    const queryClient = useQueryClient();

    return useMutation({
        // Per-category mutationKey prevents rapid edits on different categories from colliding
        mutationKey: ['budget-update-assigned'],
        meta: { errorMessage: 'Error al guardar la asignación', broadcastKeys: ['budget', 'accounts'] },
        mutationFn: async ({ categoryId, value, currentBudgetData }: UpdateAssignedParams) => {
            const parsed = parseLocaleNumber(value);
            let numericValue = toMilliunits(parsed);

            if (Math.abs(numericValue) > MAX_ASSIGNED_VALUE) {
                numericValue = toMilliunits(Math.sign(parsed) * (MAX_ASSIGNED_VALUE / 1000));
            }

            // Skip if value unchanged
            const currentItem = currentBudgetData.find(i => i.categoryId === categoryId);
            if (currentItem && currentItem.assigned === numericValue) {
                return { skipped: true, numericValue };
            }

            const res = await fetch('/api/budget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categoryId,
                    month: currentMonth,
                    assigned: numericValue,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Error al guardar la asignación');
            }

            const responseData = await res.json();
            return { skipped: false, numericValue, serverData: responseData };
        },

        retry: 1,

        onMutate: async ({ categoryId, value, currentBudgetData }) => {
            // Cancel any outgoing refetches so they don't overwrite our optimistic update
            await queryClient.cancelQueries({ queryKey: ['budget', currentMonth] });

            // Snapshot previous data for rollback
            const previous = queryClient.getQueryData(['budget', currentMonth]);

            // ── Use engine for EXACT optimistic calculation ──
            const parsed = parseLocaleNumber(value);
            let numericValue = toMilliunits(parsed);
            const validation = validateAssignment(numericValue);
            numericValue = validation.clamped;

            const currentItem = currentBudgetData.find(i => i.categoryId === categoryId);
            if (currentItem && currentItem.assigned === numericValue) {
                return { previous, skipped: true };
            }

            // Build engine input from cached data
            const existing = currentItem
                ? { assigned: currentItem.assigned, available: currentItem.available }
                : null;

            // Compute carryforward from the category's previous available
            // const prevAvailable = existing ? existing.available - existing.assigned : 0;
            const isCCPayment = !!currentItem?.linkedAccountId;
            const carryforward = computeCarryforward(
                (existing ? existing.available - (currentItem?.activity || 0) - existing.assigned + (currentItem?.assigned || 0) : null) as Milliunit | null,
                isCCPayment
            );

            // Get exact result from engine
            const result = calculateAssignment({
                existing: existing
                    ? { assigned: existing.assigned as Milliunit, available: existing.available as Milliunit }
                    : null,
                carryforward,
                newAssigned: numericValue,
            });

            // Optimistic update with exact engine-computed values
            // Past months always show RTA=0 (RTA is cumulative, only applies to current/future)
            const now = new Date();
            const calendarMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const isPastMonth = currentMonth < calendarMonth;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            queryClient.setQueryData(['budget', currentMonth], (old: any) => {
                if (!old) return old;
                return {
                    ...old,
                    budget: old.budget.map((item: BudgetItem) =>
                        item.categoryId === categoryId
                            ? { ...item, assigned: numericValue, available: existing ? existing.available + result.delta : result.newAvailable }
                            : item
                    ),
                    readyToAssign: isPastMonth ? 0 : old.readyToAssign - result.delta,
                };
            });

            return { previous, skipped: false };
        },

        onSuccess: (data) => {
            // Immediately update cache with accurate server-calculated values
            // This replaces the optimistic approximation with the real RTA, available, etc.
            if (!data.skipped && data.serverData) {
                const { budget, readyToAssign, rtaBreakdown, overspendingTypes, inspectorData } = data.serverData;
                if (budget && readyToAssign !== undefined) {
                    // Server now returns DTOs with overspendingType already merged
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    queryClient.setQueryData(['budget', currentMonth], (old: any) => {
                        if (!old) return old;
                        return {
                            ...old,
                            budget,
                            readyToAssign,
                            rtaBreakdown,
                            overspendingTypes,
                            inspectorData,
                        };
                    });
                }
            }
        },

        onError: (_error, _variables, context) => {
            // Rollback to previous state
            if (context?.previous) {
                queryClient.setQueryData(['budget', currentMonth], context.previous);
            }
            // Error toast handled by global MutationCache via meta.errorMessage
        },

        onSettled: (_data, _error, _variables, context) => {
            if (context?.skipped) return;

            // Only refetch when THIS is the last pending budget-update-assigned mutation.
            // This prevents a completed mutation's refetch from overwriting the optimistic
            // update of a still-in-flight rapid edit on a different category.
            const stillPending = queryClient.isMutating({
                mutationKey: ['budget-update-assigned'],
            });

            if (stillPending <= 1) {
                // Invalidate ALL budget months, not just currentMonth.
                // RTA is cumulative — assigning in Feb affects March's RTA too.
                queryClient.invalidateQueries({ queryKey: ['budget'] });
                // Remove stale prefetched months so navigation forces a fresh fetch
                // instead of serving cached data with wrong RTA values.
                // Active queries (currentMonth) are protected — removeQueries
                // only evicts inactive cache entries.
                queryClient.removeQueries({
                    queryKey: ['budget'],
                    predicate: (query) => query.queryKey[1] !== currentMonth,
                });
            }
        },
    });
}

export function useUpdateCategoryName() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ['budget-update-category-name'],
        meta: { errorMessage: 'Error al renombrar categoría', broadcastKeys: ['budget', 'categories'] },
        mutationFn: async ({ categoryId, newName, currentName }: UpdateCategoryNameParams) => {
            if (!newName.trim() || newName === currentName) {
                return { skipped: true };
            }

            const res = await fetch('/api/categories', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: categoryId, name: newName }),
            });

            if (!res.ok) throw new Error('Error al renombrar categoría');
            return { skipped: false };
        },

        retry: 1,

        // Error toast handled by global MutationCache via meta.errorMessage

        onSettled: (_data) => {
            if (!_data?.skipped) {
                queryClient.invalidateQueries({ queryKey: ['budget'] });
            }
        },
    });
}

export function useReorderCategories() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ['budget-reorder'],
        meta: { errorMessage: 'Error al reordenar', broadcastKeys: ['budget', 'categories'] },
        mutationFn: async ({ type, items }: ReorderParams) => {
            const res = await fetch('/api/categories/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, items }),
            });

            if (!res.ok) throw new Error('Error al reordenar');
            return res.json();
        },

        retry: 2,

        onError: () => {
            // Error toast handled by global MutationCache via meta.errorMessage
            queryClient.invalidateQueries({ queryKey: ['budget'] });
        },
    });
}

// ─── Create Category Group ───────────────────────────────────────────
export function useCreateCategoryGroup() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ['budget-create-category-group'],
        meta: { errorMessage: 'Error al crear grupo de categorías', broadcastKeys: ['budget', 'categories', 'category-groups'] },
        mutationFn: async (name: string) => {
            const res = await fetch('/api/category-groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Error al crear grupo de categorías');
            }

            return res.json();
        },

        retry: 1,

        onError: () => {
            // Error toast handled by global MutationCache via meta.errorMessage
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budget'] });
        },
    });
}

// ─── Create Category ─────────────────────────────────────────────────
export function useCreateCategory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ['budget-create-category'],
        meta: { errorMessage: 'Error al crear categoría', broadcastKeys: ['budget', 'categories'] },
        mutationFn: async ({ name, categoryGroupId }: { name: string; categoryGroupId: number }) => {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, categoryGroupId }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Error al crear categoría');
            }

            return res.json();
        },

        retry: 1,

        onError: () => {
            // Error toast handled by global MutationCache via meta.errorMessage
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budget'] });
        },
    });
}

// Re-export for convenience
export { parseLocaleNumber, MAX_ASSIGNED_VALUE };
