import { useQuery } from '@tanstack/react-query';
import type { ReconciliationInfoDTO } from '@/lib/dtos/account.dto';

/**
 * Query hook for reconciliation info — replaces the former PATCH-based mutation.
 *
 * Fetches cleared/reconciled/pending balances for a given account.
 * Pass `enabled = false` to defer the query until the user opens
 * the reconciliation modal.
 */
export function useReconciliationInfo(
    budgetId: number | undefined,
    accountId: number | undefined,
    enabled: boolean,
) {
    return useQuery<ReconciliationInfoDTO>({
        queryKey: ['reconciliation-info', budgetId, accountId],
        queryFn: async () => {
            const res = await fetch(
                `/api/budgets/${budgetId}/accounts/${accountId}/reconciliation-info`,
            );
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Error al obtener información de reconciliación');
            }
            return res.json();
        },
        enabled: enabled && !!budgetId && !!accountId,
        staleTime: 0, // Always refetch when modal opens
    });
}
