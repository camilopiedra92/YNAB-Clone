/**
 * Example: DTO (Data Transfer Object) with Row → DTO mapper.
 *
 * - Row interface matches the DB result shape (snake_case or Drizzle camelCase)
 * - DTO interface is the stable API contract (camelCase)
 * - Mapper converts types (bigint → number, milliunits → display, boolean coercion)
 * - Re-export mapper and DTO type from lib/dtos/index.ts barrel
 */

// ─── Input Row Type ──────────────────────────────────────────────────

interface GoalRow {
  id: number;
  budgetId: number;
  categoryId: number;
  targetAmount: number;   // bigint from DB
  targetDate: string | null;
}

// ─── DTO ─────────────────────────────────────────────────────────────

export interface GoalDTO {
  id: number;
  budgetId: number;
  categoryId: number;
  targetAmount: number;   // converted from milliunits
  targetDate: string | null;
}

// ─── Mapper ──────────────────────────────────────────────────────────

export function toGoalDTO(row: GoalRow): GoalDTO {
  return {
    id: row.id,
    budgetId: row.budgetId,
    categoryId: row.categoryId,
    targetAmount: Number(row.targetAmount) / 1000,  // milliunits → display
    targetDate: row.targetDate,
  };
}
