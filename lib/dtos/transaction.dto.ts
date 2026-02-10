/**
 * Transaction DTOs — stable API contract for transaction data.
 */
import type { TransactionRow } from '../repos/transactions';

/** Input type for DTO conversion — core fields required, rest optional for partial/test usage */
export type TransactionRowInput = Pick<TransactionRow, 'id' | 'budgetId' | 'accountId' | 'date'> & Partial<Omit<TransactionRow, 'id' | 'budgetId' | 'accountId' | 'date'>>;

// ─── DTOs ────────────────────────────────────────────────────────────

export interface TransactionDTO {
  id: number;
  budgetId: number;
  accountId: number;
  accountName: string;
  date: string;
  payee: string;
  categoryId: number | null;
  categoryName: string | null;
  memo: string;
  outflow: number;
  inflow: number;
  cleared: 'Cleared' | 'Uncleared' | 'Reconciled';
  transferId: number | null;
  transferAccountId: number | null;
  transferAccountName: string | null;
  isFuture: boolean;
  flag: string | null;
}

// ─── Mappers ─────────────────────────────────────────────────────────

export function toTransactionDTO(row: TransactionRowInput | undefined): TransactionDTO {
  if (!row) throw new Error('Transaction not found');
  return {
    id: row.id,
    budgetId: row.budgetId!,
    accountId: row.accountId,
    accountName: row.accountName ?? '',
    date: row.date,
    payee: row.payee ?? '',
    categoryId: row.categoryId ?? null,
    categoryName: row.categoryName ?? null,
    memo: row.memo ?? '',
    outflow: Number(row.outflow) || 0,
    inflow: Number(row.inflow) || 0,
    cleared: row.cleared as 'Cleared' | 'Uncleared' | 'Reconciled' ?? 'Uncleared',
    transferId: row.transferId ?? null,
    transferAccountId: row.transferAccountId ?? null,
    transferAccountName: row.transferAccountName ?? null,
    isFuture: !!row.isFuture,
    flag: row.flag ?? null,
  };
}


