/**
 * Share DTOs — stable API contract for budget share data.
 *
 * Decouples the DB row shape from the API response shape.
 *
 * Two shapes:
 *   - ShareDTO: raw share row (from insert/update returning) — no user info
 *   - ShareInfoDTO: enriched with user name/email (from getShares join)
 */
import type { BudgetShareInfo } from '../repos/budgets';

// ─── Input Row Types ─────────────────────────────────────────────────

/** Shape returned by budgetShares insert/update .returning() */
interface ShareRow {
  id: number;
  budgetId: number;
  userId: string;
  role: string;
  createdAt: Date | null;
}

// ─── DTOs ────────────────────────────────────────────────────────────

/** Minimal share DTO — returned from create/update operations */
export interface ShareDTO {
  id: number;
  budgetId: number;
  userId: string;
  role: string;
  createdAt: string | null;
}

/** Enriched share DTO — returned from list operations (includes user info) */
export interface ShareInfoDTO {
  id: number;
  budgetId: number;
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  createdAt: string | null;
}

// ─── Mappers ─────────────────────────────────────────────────────────

/** Map a raw budgetShares row to a stable ShareDTO. */
export function toShareDTO(row: ShareRow): ShareDTO {
  return {
    id: row.id,
    budgetId: row.budgetId,
    userId: row.userId,
    role: row.role,
    createdAt: row.createdAt?.toISOString() ?? null,
  };
}

/** Map a BudgetShareInfo (with user join) to a stable ShareInfoDTO. */
export function toShareInfoDTO(row: BudgetShareInfo): ShareInfoDTO {
  return {
    id: row.id,
    budgetId: row.budgetId,
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    role: row.role,
    createdAt: row.createdAt?.toISOString() ?? null,
  };
}
