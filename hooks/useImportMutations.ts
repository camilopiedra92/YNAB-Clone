'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface ImportStats {
    accounts: number;
    transactions: number;
    transfers: number;
    budgetEntries: number;
    categoryGroups: number;
}

export interface ImportResponse {
    success: boolean;
    stats: ImportStats;
}

export interface ImportBudgetParams {
    budgetId: string;
    registerFile: File;
    planFile: File;
}

export function useImportBudgetMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ['import-budget'],
        meta: { errorMessage: 'No se pudo importar el presupuesto' },
        mutationFn: async ({ budgetId, registerFile, planFile }: ImportBudgetParams) => {
            const formData = new FormData();
            formData.append('register', registerFile);
            formData.append('plan', planFile);

            const res = await fetch(`/api/budgets/${budgetId}/import`, {
                method: 'POST',
                body: formData,
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || 'Import failed');
            }

            return json as ImportResponse;
        },
        onSuccess: () => {
             // Invalidate all caches to reflect the imported data (same as before)
             queryClient.invalidateQueries({ queryKey: ['accounts'] });
             queryClient.invalidateQueries({ queryKey: ['budget'] });
             queryClient.invalidateQueries({ queryKey: ['transactions'] });
             queryClient.invalidateQueries({ queryKey: ['categories'] });
             queryClient.invalidateQueries({ queryKey: ['payees'] });
        },
        retry: 0,
    });
}
