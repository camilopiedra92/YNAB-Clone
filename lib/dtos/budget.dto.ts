/**
 * Budget DTOs — stable API contract for budget data.
 */
import type { RTABreakdown } from '../engine/types';
import type { BudgetRow } from '../repos/budget';

// ─── Input Row Types ─────────────────────────────────────────────────

/** BudgetRow enriched with overspending classification before DTO conversion.
 *  Uses Partial for fields that may be missing in minimal/test contexts. */
export type BudgetRowWithOverspending = Pick<BudgetRow, 'categoryGroupId' | 'month'> &
  Partial<Omit<BudgetRow, 'categoryGroupId' | 'month'>> & {
    overspendingType?: 'cash' | 'credit' | null;
  };

// ─── DTOs ────────────────────────────────────────────────────────────

export interface BudgetItemDTO {
  id: number | null;
  categoryId: number | null;
  categoryName: string | null;
  groupName: string;
  categoryGroupId: number;
  groupHidden: boolean;
  month: string;
  assigned: number;
  activity: number;
  available: number;
  linkedAccountId: number | null;
  overspendingType?: 'cash' | 'credit' | null;
}

export interface InspectorDataDTO {
  summary: {
    leftOverFromLastMonth: number;
    assignedThisMonth: number;
    activity: number;
    available: number;
  };
  costToBeMe: {
    targets: number;
    expectedIncome: number;
  };
  autoAssign: {
    underfunded: number;
    assignedLastMonth: number;
    spentLastMonth: number;
    averageAssigned: number;
    averageSpent: number;
    reduceOverfunding: number;
    resetAvailableAmounts: number;
    resetAssignedAmounts: number;
  };
  futureAssignments: {
    total: number;
    months: { month: string; amount: number }[];
  };
}

export interface BudgetResponseDTO {
  budget: BudgetItemDTO[];
  readyToAssign: number;
  monthRange: { minMonth: string; maxMonth: string };
  rtaBreakdown: RTABreakdown;
  overspendingTypes: Record<number, 'cash' | 'credit' | null>;
  inspectorData: InspectorDataDTO;
}

// ─── Mappers ─────────────────────────────────────────────────────────

export function toBudgetItemDTO(row: BudgetRowWithOverspending): BudgetItemDTO {
  return {
    id: row.id ?? null,
    categoryId: row.categoryId ?? null,
    categoryName: row.categoryName ?? null,
    groupName: row.groupName ?? '',
    categoryGroupId: row.categoryGroupId,
    groupHidden: !!row.groupHidden,
    month: row.month,
    assigned: Number(row.assigned) || 0,
    activity: Number(row.activity) || 0,
    available: Number(row.available) || 0,
    linkedAccountId: row.linkedAccountId ?? null,
    overspendingType: row.overspendingType ?? null,
  };
}

