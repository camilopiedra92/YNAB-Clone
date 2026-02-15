/**
 * Budget Response Builder — Shared utility for API routes.
 *
 * Eliminates duplication between budget/route.ts and budget/move/route.ts.
 * Both routes now import this single function.
 *
 * Performance: Runs independent queries in Phase 1 via Promise.all,
 * then passes pre-computed data to Phase 2 + Phase 3 to avoid redundant DB calls.
 */
import { toBudgetItemDTO } from '@/lib/dtos';
import type { BudgetRowWithOverspending } from '@/lib/dtos/budget.dto';
import type { TransactionRepos } from '@/lib/with-budget-access';

export async function buildBudgetResponse(repos: TransactionRepos, budgetId: number, month: string) {
    // Phase 1: Independent queries run in parallel (RTA computed once, overspending unified)
    const [rawBudget, rtaResult, overspendingData, monthRange] = await Promise.all([
        repos.getBudgetForMonth(budgetId, month),
        repos.getReadyToAssign(budgetId, month),
        repos.getOverspendingData(budgetId, month),
        repos.getMonthRange(budgetId),
    ]);

    const readyToAssign = rtaResult.rta;
    const { overspendingTypes } = overspendingData;

    // Phase 2: Breakdown reuses pre-computed RTA + CC balances (eliminates duplicate queries)
    const rtaBreakdown = await repos.getReadyToAssignBreakdown(budgetId, month, {
        rta: readyToAssign,
        positiveCCBalances: rtaResult.positiveCCBalances,
    });

    // Phase 3: Inspector uses pre-computed data (no redundant getBudgetForMonth/breakdown calls)
    const inspectorData = await repos.getBudgetInspectorData(budgetId, month, {
        budgetRows: rawBudget,
        rtaBreakdown,
    });

    // Merge overspending types into rows before DTO conversion
    const budget = rawBudget.map((row) => {
        const enriched: BudgetRowWithOverspending = {
            ...row,
            overspendingType: row.categoryId ? (overspendingTypes[row.categoryId] || null) : null,
        };
        return toBudgetItemDTO(enriched);
    });

    return { budget, readyToAssign, monthRange, rtaBreakdown, overspendingTypes, inspectorData };
}
