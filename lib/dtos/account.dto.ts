/**
 * Account DTOs — stable API contract for account data.
 *
 * Decouples the DB row shape from the API response shape.
 */

// ─── Input Row Types ─────────────────────────────────────────────────

/** Shape returned by accounts repo select queries or raw SQLite rows */
interface AccountRow {
  id: number;
  name: string;
  type: string;
  balance?: number;
  clearedBalance?: number;
  unclearedBalance?: number;
  note?: string | null;
  closed?: boolean | number;
}

/** Shape returned by getReconciliationInfo raw SQL query */
interface ReconciliationInfoRow {
  clearedBalance?: number;
  reconciledBalance?: number;
  pendingClearedBalance?: number;
  pendingClearedCount?: number;
}

// ─── DTOs ────────────────────────────────────────────────────────────

export interface AccountDTO {
  id: number;
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
    name: row.name,
    type: row.type,
    balance: Number(row.balance) || 0,
    clearedBalance: Number(row.clearedBalance) || 0,
    unclearedBalance: Number(row.unclearedBalance) || 0,
    note: row.note ?? null,
    closed: !!row.closed,
  };
}

export function toReconciliationInfoDTO(row: ReconciliationInfoRow): ReconciliationInfoDTO {
  return {
    clearedBalance: Number(row.clearedBalance) || 0,
    reconciledBalance: Number(row.reconciledBalance) || 0,
    pendingClearedBalance: Number(row.pendingClearedBalance) || 0,
    pendingClearedCount: Number(row.pendingClearedCount) || 0,
  };
}

