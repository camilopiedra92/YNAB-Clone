/**
 * Account DTOs — stable API contract for account data.
 *
 * Decouples the DB row shape from the API response shape.
 */
import type { ReconciliationInfo } from '../repos/accounts';

// ─── Input Row Types ─────────────────────────────────────────────────

/** Shape returned by accounts repo select queries or raw SQLite rows */
interface AccountRow {
  id: number;
  budgetId: number;
  name: string;
  type: string;
  balance?: number;
  clearedBalance?: number;
  unclearedBalance?: number;
  note?: string | null;
  closed?: boolean | number;
}



// ─── DTOs ────────────────────────────────────────────────────────────

export interface AccountDTO {
  id: number;
  budgetId: number;
  name: string;
  type: string;
  balance: number;
  clearedBalance: number;
  unclearedBalance: number;
  note: string | null;
  closed: boolean;
}

export interface ReconciliationInfoDTO {
  clearedBalance: number;
  reconciledBalance: number;
  pendingClearedBalance: number;
  pendingClearedCount: number;
}

// ─── Mappers ─────────────────────────────────────────────────────────

export function toAccountDTO(row: AccountRow): AccountDTO {
  return {
    id: row.id,
    budgetId: row.budgetId,
    name: row.name,
    type: row.type,
    balance: Number(row.balance) || 0,
    clearedBalance: Number(row.clearedBalance) || 0,
    unclearedBalance: Number(row.unclearedBalance) || 0,
    note: row.note ?? null,
    closed: !!row.closed,
  };
}

export function toReconciliationInfoDTO(row: ReconciliationInfo): ReconciliationInfoDTO {
  return {
    clearedBalance: Number(row.clearedBalance) || 0,
    reconciledBalance: Number(row.reconciledBalance) || 0,
    pendingClearedBalance: Number(row.pendingClearedBalance) || 0,
    pendingClearedCount: Number(row.pendingClearedCount) || 0,
  };
}

