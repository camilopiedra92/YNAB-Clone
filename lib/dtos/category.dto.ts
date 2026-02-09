/**
 * Category DTOs — stable API contract for category data.
 */

// ─── Input Row Types ─────────────────────────────────────────────────

/** Shape returned by getCategories() without groupId (joined with groups) */
interface CategoryRow {
  id: number;
  name: string;
  groupName?: string;
  categoryGroupId: number;
  sortOrder?: number;
  linkedAccountId?: number | null;
}

/** Shape returned by getCategoryGroups() */
interface CategoryGroupRow {
  id: number;
  name: string;
  hidden: boolean | number;
  sortOrder?: number;
  isIncome: boolean | number;
}

// ─── DTOs ────────────────────────────────────────────────────────────

export interface CategoryDTO {
  id: number;
  name: string;
  groupName: string;
  categoryGroupId: number;
  sortOrder: number;
  linkedAccountId: number | null;
}

export interface CategoryGroupDTO {
  id: number;
  name: string;
  hidden: boolean;
  sortOrder: number;
  isIncome: boolean;
}

// ─── Mappers ─────────────────────────────────────────────────────────

export function toCategoryDTO(row: CategoryRow): CategoryDTO {
  return {
    id: row.id,
    name: row.name,
    groupName: row.groupName ?? '',
    categoryGroupId: row.categoryGroupId,
    sortOrder: row.sortOrder ?? 0,
    linkedAccountId: row.linkedAccountId ?? null,
  };
}

export function toCategoryGroupDTO(row: CategoryGroupRow): CategoryGroupDTO {
  return {
    id: row.id,
    name: row.name,
    hidden: !!row.hidden,
    sortOrder: row.sortOrder ?? 0,
    isIncome: !!row.isIncome,
  };
}

