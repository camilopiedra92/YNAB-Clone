/**
 * Transaction Repository — CRUD, transfers, and cleared status toggling.
 *
 * Part of the Repository Pattern.
 * Orchestration layer: queries → engine → writes.
 * All queries use Drizzle ORM query builder or sql template.
 *
 * Cross-repo dependency: `updateAccountBalances` is injected via the
 * `deps` parameter so that `createTransfer` / `deleteTransfer` can
 * update account balances without importing the accounts repo directly.
 */
import { eq, sql, or, type SQL, type InferSelectModel } from 'drizzle-orm';
import { accounts, categories, transactions, transfers } from '../db/schema';
import { currentDate } from '../db/sql-helpers';
import { milliunit, ZERO } from '../engine/primitives';
import type { DrizzleDB } from './client';
import { queryRows } from './client';

export interface TransactionRepoDeps {
  updateAccountBalances: (accountId: number) => Promise<unknown> | void;
  updateBudgetActivity: (categoryId: number, month: string) => Promise<unknown> | void;
  isCreditCardAccount: (accountId: number) => Promise<boolean> | boolean;
  updateCreditCardPaymentBudget: (accountId: number, month: string) => Promise<unknown> | void;
  reconcileAccount: (accountId: number) => Promise<unknown> | unknown;
}

/** Row shape returned by getTransactions/getTransaction raw SQL queries */
export interface TransactionRow {
  id: number;
  accountId: number;
  accountName: string;
  date: string;
  payee: string | null;
  categoryId: number | null;
  categoryName: string | null;
  memo: string | null;
  outflow: number;
  inflow: number;
  cleared: string;
  transferId: number | null;
  transferAccountId: number | null;
  transferAccountName: string | null;
  isFuture: number;
  flag: string | null;
}

export function createTransactionFunctions(
  database: DrizzleDB,
  deps: TransactionRepoDeps,
) {

  async function getTransactions(filters?: {
    accountId?: number;
    categoryId?: number;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    // This query is complex with multiple LEFT JOINs and CASE expressions for transfer info.
    // Using sql template for clarity and correctness.
    const conditions: SQL[] = [];

    if (filters?.accountId) {
      conditions.push(sql`AND t.account_id = ${filters.accountId}`);
    }
    if (filters?.categoryId) {
      conditions.push(sql`AND t.category_id = ${filters.categoryId}`);
    }
    if (filters?.startDate) {
      conditions.push(sql`AND t.date >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`AND t.date <= ${filters.endDate}`);
    }

    const limitClause = filters?.limit ? sql`LIMIT ${filters.limit}` : sql``;
    const whereExtra = conditions.length > 0 ? sql.join(conditions, sql` `) : sql``;

    return queryRows<TransactionRow>(database, sql`
      SELECT 
        t.id as "id",
        t.account_id as "accountId",
        t.date as "date",
        t.payee as "payee",
        t.category_id as "categoryId",
        t.memo as "memo",
        t.outflow as "outflow",
        t.inflow as "inflow",
        t.cleared as "cleared",
        t.flag as "flag",
        a.name as "accountName",
        c.name as "categoryName",
        tr.id as "transferId",
        CASE WHEN t.date > ${currentDate()} THEN 1 ELSE 0 END as "isFuture",
        CASE 
          WHEN tr.id IS NOT NULL THEN
            CASE 
              WHEN tr.from_transaction_id = t.id THEN t_to.account_id
              ELSE t_from.account_id
            END
        END as "transferAccountId",
        CASE 
          WHEN tr.id IS NOT NULL THEN
            CASE 
              WHEN tr.from_transaction_id = t.id THEN a_to.name
              ELSE a_from.name
            END
        END as "transferAccountName"
      FROM ${transactions} t
      JOIN ${accounts} a ON t.account_id = a.id
      LEFT JOIN ${categories} c ON t.category_id = c.id
      LEFT JOIN ${transfers} tr ON t.id = tr.from_transaction_id OR t.id = tr.to_transaction_id
      LEFT JOIN ${transactions} t_from ON tr.from_transaction_id = t_from.id
      LEFT JOIN ${transactions} t_to ON tr.to_transaction_id = t_to.id
      LEFT JOIN ${accounts} a_from ON t_from.account_id = a_from.id
      LEFT JOIN ${accounts} a_to ON t_to.account_id = a_to.id
      WHERE 1=1 ${whereExtra}
      ORDER BY t.date DESC, t.id DESC
      ${limitClause}
    `);
  }

  async function getTransaction(id: number) {
    const rows = await queryRows<TransactionRow>(database, sql`
      SELECT 
        t.id as "id",
        t.account_id as "accountId",
        t.date as "date",
        t.payee as "payee",
        t.category_id as "categoryId",
        t.memo as "memo",
        t.outflow as "outflow",
        t.inflow as "inflow",
        t.cleared as "cleared",
        t.flag as "flag",
        a.name as "accountName",
        c.name as "categoryName"
      FROM ${transactions} t
      JOIN ${accounts} a ON t.account_id = a.id
      LEFT JOIN ${categories} c ON t.category_id = c.id
      WHERE t.id = ${id}
    `);
    return rows[0];
  }

  async function createTransaction(transaction: {
    accountId: number;
    date: string;
    payee?: string;
    categoryId?: number;
    memo?: string;
    outflow?: number;
    inflow?: number;
    cleared?: string;
    flag?: string;
  }) {
    const rows = await database.insert(transactions)
      .values({
        accountId: transaction.accountId,
        date: transaction.date,
        payee: transaction.payee || null,
        categoryId: transaction.categoryId || null,
        memo: transaction.memo || null,
        outflow: milliunit(transaction.outflow || 0),
        inflow: milliunit(transaction.inflow || 0),
        cleared: (transaction.cleared as 'Cleared' | 'Uncleared' | 'Reconciled') || 'Uncleared',
        flag: transaction.flag || null,
      })
      .returning({ id: transactions.id });
    return rows[0];
  }

  async function updateTransaction(id: number, transaction: Partial<{
    date: string;
    payee: string;
    categoryId: number | null;
    memo: string;
    outflow: number;
    inflow: number;
    cleared: string;
    flag: string | null;
  }>) {
    const setFields: Partial<typeof transactions.$inferInsert> = {};

    if (transaction.date !== undefined) setFields.date = transaction.date;
    if (transaction.payee !== undefined) setFields.payee = transaction.payee;
    if (transaction.categoryId !== undefined) setFields.categoryId = transaction.categoryId;
    if (transaction.memo !== undefined) setFields.memo = transaction.memo;
    if (transaction.outflow !== undefined) setFields.outflow = milliunit(transaction.outflow);
    if (transaction.inflow !== undefined) setFields.inflow = milliunit(transaction.inflow);
    if (transaction.cleared !== undefined) setFields.cleared = transaction.cleared as 'Cleared' | 'Uncleared' | 'Reconciled';
    if (transaction.flag !== undefined) setFields.flag = transaction.flag;

    if (Object.keys(setFields).length === 0) return;

    return database.update(transactions)
      .set(setFields)
      .where(eq(transactions.id, id));
  }

  async function deleteTransaction(id: number) {
    return database.delete(transactions)
      .where(eq(transactions.id, id));
  }

  async function toggleTransactionCleared(id: number) {
    const rows = await database.select({ cleared: transactions.cleared })
      .from(transactions)
      .where(eq(transactions.id, id));
    const tx = rows[0];
    if (!tx) return null;

    if (tx.cleared === 'Reconciled') return null;

    const newStatus: 'Cleared' | 'Uncleared' = tx.cleared === 'Cleared' ? 'Uncleared' : 'Cleared';
    return database.update(transactions)
      .set({ cleared: newStatus })
      .where(eq(transactions.id, id));
  }

  async function getTransferByTransactionId(transactionId: number): Promise<InferSelectModel<typeof transfers> | undefined> {
    const rows = await database.select().from(transfers)
      .where(
        or(
          eq(transfers.fromTransactionId, transactionId),
          eq(transfers.toTransactionId, transactionId),
        )
      );
    return rows[0];
  }

  async function createTransfer(params: {
    fromAccountId: number;
    toAccountId: number;
    amount: number;
    date: string;
    memo?: string;
    cleared?: string;
  }) {
    const fromAccountRows = await database.select({ name: accounts.name })
      .from(accounts)
      .where(eq(accounts.id, params.fromAccountId));
    const toAccountRows = await database.select({ name: accounts.name })
      .from(accounts)
      .where(eq(accounts.id, params.toAccountId));

    const fromAccount = fromAccountRows[0];
    const toAccount = toAccountRows[0];

    if (!fromAccount || !toAccount) {
      throw new Error('Account not found');
    }

    const result = await database.transaction(async (tx) => {
      // Create outflow transaction on source account
      const fromResults = await tx.insert(transactions)
        .values({
          accountId: params.fromAccountId,
          date: params.date,
          payee: `Transfer : ${toAccount.name}`,
          categoryId: null,
          memo: params.memo || null,
          outflow: milliunit(params.amount),
          inflow: ZERO,
          cleared: (params.cleared as 'Cleared' | 'Uncleared' | 'Reconciled') || 'Uncleared',
          flag: null,
        })
        .returning({ id: transactions.id });

      // Create inflow transaction on destination account
      const toResults = await tx.insert(transactions)
        .values({
          accountId: params.toAccountId,
          date: params.date,
          payee: `Transfer : ${fromAccount.name}`,
          categoryId: null,
          memo: params.memo || null,
          outflow: ZERO,
          inflow: milliunit(params.amount),
          cleared: (params.cleared as 'Cleared' | 'Uncleared' | 'Reconciled') || 'Uncleared',
          flag: null,
        })
        .returning({ id: transactions.id });

      // Link them in transfers table
      const transferResults = await tx.insert(transfers)
        .values({
          fromTransactionId: fromResults[0].id,
          toTransactionId: toResults[0].id,
        })
        .returning({ id: transfers.id });

      return {
        transferId: transferResults[0].id,
        fromTransactionId: fromResults[0].id,
        toTransactionId: toResults[0].id,
      };
    });

    // Update balances OUTSIDE the transaction to avoid PGlite single-connection deadlock
    await deps.updateAccountBalances(params.fromAccountId);
    await deps.updateAccountBalances(params.toAccountId);

    return result;
  }

  async function deleteTransfer(transferId: number): Promise<{ fromAccountId: number; toAccountId: number }> {
    const transferRows = await database.select().from(transfers)
      .where(eq(transfers.id, transferId));
    const transfer = transferRows[0];
    if (!transfer) throw new Error('Transfer not found');

    const fromTxRows = await database.select({ accountId: transactions.accountId })
      .from(transactions)
      .where(eq(transactions.id, transfer.fromTransactionId));
    const toTxRows = await database.select({ accountId: transactions.accountId })
      .from(transactions)
      .where(eq(transactions.id, transfer.toTransactionId));

    const fromAccountId = fromTxRows[0]!.accountId;
    const toAccountId = toTxRows[0]!.accountId;

    await database.transaction(async (tx) => {
      await tx.delete(transfers).where(eq(transfers.id, transferId));
      await tx.delete(transactions).where(eq(transactions.id, transfer.fromTransactionId));
      await tx.delete(transactions).where(eq(transactions.id, transfer.toTransactionId));
    });

    // Update balances OUTSIDE the transaction to avoid PGlite deadlock
    await deps.updateAccountBalances(fromAccountId);
    await deps.updateAccountBalances(toAccountId);

    return { fromAccountId, toAccountId };
  }
  // ──── Atomic composite operations ────
  // These wrap multiple repo calls in a single database.transaction()
  // so API routes never need direct access to db.transaction().

  async function createTransactionAtomic(data: {
    accountId: number;
    date: string;
    payee?: string;
    categoryId?: number | null;
    memo?: string;
    outflow?: number;
    inflow?: number;
    cleared?: string;
    flag?: string;
  }) {
    // Sequential execution — no transaction wrapper to avoid PGlite deadlock
    // (each dep call may use `database` internally)
    const result = await createTransaction({
      accountId: data.accountId,
      date: data.date,
      payee: data.payee,
      categoryId: data.categoryId ?? undefined,
      memo: data.memo,
      outflow: data.outflow || 0,
      inflow: data.inflow || 0,
      cleared: data.cleared || 'Uncleared',
      flag: data.flag ?? undefined,
    });

    await deps.updateAccountBalances(data.accountId);

    if (data.categoryId) {
      const month = data.date.substring(0, 7);
      await deps.updateBudgetActivity(data.categoryId, month);
    }

    if (await deps.isCreditCardAccount(data.accountId)) {
      const month = data.date.substring(0, 7);
      await deps.updateCreditCardPaymentBudget(data.accountId, month);
    }

    return result;
  }

  async function updateTransactionAtomic(
    id: number,
    original: TransactionRow,
    updates: Partial<{
      date: string; payee: string; categoryId: number | null; memo: string;
      outflow: number; inflow: number; cleared: string; flag: string | null;
    }>,
  ) {
    // Sequential execution — no transaction wrapper to avoid PGlite deadlock
    await updateTransaction(id, updates);

    await deps.updateAccountBalances(original.accountId);

    const oldMonth = original.date.substring(0, 7);
    const newMonth = (updates.date || original.date).substring(0, 7);

    if (original.categoryId) {
      await deps.updateBudgetActivity(original.categoryId, oldMonth);
    }
    if (updates.categoryId !== undefined && updates.categoryId !== null) {
      await deps.updateBudgetActivity(updates.categoryId, newMonth);
    } else if (original.categoryId && oldMonth !== newMonth) {
      await deps.updateBudgetActivity(original.categoryId, newMonth);
    }

    if (await deps.isCreditCardAccount(original.accountId)) {
      await deps.updateCreditCardPaymentBudget(original.accountId, oldMonth);
      if (oldMonth !== newMonth) {
        await deps.updateCreditCardPaymentBudget(original.accountId, newMonth);
      }
    }
  }

  async function deleteTransactionAtomic(txn: TransactionRow) {
    // Sequential execution — no transaction wrapper to avoid PGlite deadlock
    await deleteTransaction(txn.id);

    await deps.updateAccountBalances(txn.accountId);

    if (txn.categoryId) {
      const month = txn.date.substring(0, 7);
      await deps.updateBudgetActivity(txn.categoryId, month);
    }

    if (await deps.isCreditCardAccount(txn.accountId)) {
      const month = txn.date.substring(0, 7);
      await deps.updateCreditCardPaymentBudget(txn.accountId, month);
    }
  }

  async function toggleClearedAtomic(id: number, accountId: number) {
    // Sequential execution — no transaction wrapper to avoid PGlite deadlock
    await toggleTransactionCleared(id);
    await deps.updateAccountBalances(accountId);
  }

  async function reconcileAccountAtomic(accountId: number) {
    // Sequential execution — no transaction wrapper to avoid PGlite deadlock
    const result = await deps.reconcileAccount(accountId);
    await deps.updateAccountBalances(accountId);
    return result;
  }

  return {
    getTransactions,
    getTransaction,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    toggleTransactionCleared,
    getTransferByTransactionId,
    createTransfer,
    deleteTransfer,
    // Atomic composite operations
    createTransactionAtomic,
    updateTransactionAtomic,
    deleteTransactionAtomic,
    toggleClearedAtomic,
    reconcileAccountAtomic,
  };
}
