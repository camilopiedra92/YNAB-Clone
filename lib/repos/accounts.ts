/**
 * Account Repository — CRUD, balance calculations, reconciliation, and payees.
 *
 * Part of the Repository Pattern.
 * Orchestration layer: queries → engine → writes.
 * All queries use Drizzle ORM query builder.
 */
import { eq, sql, ne, and, isNotNull } from 'drizzle-orm';
import { accounts, transactions } from '../db/schema';
import { notFutureDate } from '../db/sql-helpers';
import { milliunit, ZERO } from '../engine/primitives';
import type { DrizzleDB } from '../db/helpers';
import { queryRows } from '../db/helpers';

export interface ReconciliationInfo {
  clearedBalance: number;
  reconciledBalance: number;
  pendingClearedBalance: number;
  pendingClearedCount: number;
}

export function createAccountFunctions(database: DrizzleDB) {

  async function getAccounts(budgetId: number) {
    return database.select().from(accounts)
      .where(eq(accounts.budgetId, budgetId))
      .orderBy(accounts.name);
  }

  async function getAccount(budgetId: number, id: number) {
    const rows = await database.select().from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.budgetId, budgetId)));
    return rows[0];
  }

  async function createAccount(account: {
    name: string;
    type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'tracking';
    balance?: number;
    budgetId?: number;
  }) {
    const bal = milliunit(account.balance || 0);
    const rows = await database.insert(accounts)
      .values({
        name: account.name,
        type: account.type,
        balance: bal,
        clearedBalance: bal,
        unclearedBalance: ZERO,
        budgetId: account.budgetId as number, // Cast needed because of partial schema update vs Drizzle infers
      })
      .returning();
    return rows[0];
  }

  async function updateAccount(budgetId: number, id: number, updates: {
    name?: string;
    note?: string;
    closed?: boolean;
  }) {
    const setFields: Partial<typeof accounts.$inferInsert> = {};

    if (updates.name !== undefined) setFields.name = updates.name;
    if (updates.note !== undefined) setFields.note = updates.note;
    if (updates.closed !== undefined) setFields.closed = updates.closed;

    if (Object.keys(setFields).length === 0) return;

    return database.update(accounts)
      .set(setFields)
      .where(and(eq(accounts.id, id), eq(accounts.budgetId, budgetId)));
  }

  async function getAccountType(accountId: number): Promise<string | null> {
    const rows = await database.select({ type: accounts.type })
      .from(accounts)
      .where(eq(accounts.id, accountId));
    return rows[0]?.type || null;
  }

  async function isCreditCardAccount(accountId: number): Promise<boolean> {
    return (await getAccountType(accountId)) === 'credit';
  }

  async function updateAccountBalances(budgetId: number, accountId: number): Promise<{ accountType: string }> {
    const rows = await queryRows<{
      balance: number;
      clearedBalance: number;
      unclearedBalance: number;
      type: string;
    }>(database, sql`
      SELECT 
        COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0) as balance,
        COALESCE(SUM(CASE WHEN ${transactions.cleared} IN ('Cleared', 'Reconciled') THEN ${transactions.inflow} - ${transactions.outflow} ELSE 0 END), 0) as "clearedBalance",
        COALESCE(SUM(CASE WHEN ${transactions.cleared} = 'Uncleared' THEN ${transactions.inflow} - ${transactions.outflow} ELSE 0 END), 0) as "unclearedBalance",
        ${accounts.type} as "type"
      FROM ${transactions}
      JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
      WHERE ${transactions.accountId} = ${accountId} 
        AND ${accounts.budgetId} = ${budgetId}
        AND ${notFutureDate(transactions.date)}
      GROUP BY ${accounts.type}
    `);

    // When no transactions exist yet, the aggregate returns no rows.
    // Fall back to the account's type directly.
    if (!rows[0]) {
      const accRows = await database.select({ type: accounts.type })
        .from(accounts)
        .where(eq(accounts.id, accountId));
      const accountType = accRows[0]?.type || 'checking';

      await database.update(accounts)
        .set({
          balance: ZERO,
          clearedBalance: ZERO,
          unclearedBalance: ZERO,
        })
        .where(eq(accounts.id, accountId));

      return { accountType };
    }

    const result = rows[0];
    await database.update(accounts)
      .set({
        balance: milliunit(Number(result.balance)),
        clearedBalance: milliunit(Number(result.clearedBalance)),
        unclearedBalance: milliunit(Number(result.unclearedBalance)),
      })
      .where(eq(accounts.id, accountId));

    return { accountType: result.type };
  }

  async function getReconciliationInfo(budgetId: number, accountId: number): Promise<ReconciliationInfo> {
    const rows = await queryRows<ReconciliationInfo>(database, sql`
      SELECT 
        CAST(COALESCE(SUM(CASE WHEN ${transactions.cleared} IN ('Cleared', 'Reconciled') THEN ${transactions.inflow} - ${transactions.outflow} ELSE 0 END), 0) AS BIGINT) as "clearedBalance",
        CAST(COALESCE(SUM(CASE WHEN ${transactions.cleared} = 'Reconciled' THEN ${transactions.inflow} - ${transactions.outflow} ELSE 0 END), 0) AS BIGINT) as "reconciledBalance",
        CAST(COALESCE(SUM(CASE WHEN ${transactions.cleared} = 'Cleared' THEN ${transactions.inflow} - ${transactions.outflow} ELSE 0 END), 0) AS BIGINT) as "pendingClearedBalance",
        COUNT(CASE WHEN ${transactions.cleared} = 'Cleared' THEN 1 END) as "pendingClearedCount"
      FROM ${transactions}
      JOIN ${accounts} ON ${transactions.accountId} = ${accounts.id}
      WHERE ${transactions.accountId} = ${accountId} 
        AND ${accounts.budgetId} = ${budgetId}
        AND ${notFutureDate(transactions.date)}
    `);
    // Aggregate query with COALESCE always returns exactly 1 row
    return rows[0];
  }

  async function reconcileAccount(budgetId: number, accountId: number): Promise<{ rowCount: number }> {
    const result = await database.update(transactions)
      .set({ cleared: 'Reconciled' })
      .from(accounts)
      .where(and(
        eq(transactions.accountId, accountId),
        eq(accounts.budgetId, budgetId),
        eq(transactions.cleared, 'Cleared'),
        sql`${notFutureDate(transactions.date)}`,
        eq(transactions.accountId, accounts.id) // Join condition
      ));
    return { rowCount: result.length ?? 0 };
  }

  async function getPayees(budgetId: number) {
    const rows = await database.selectDistinct({ payee: transactions.payee })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(
        isNotNull(transactions.payee), 
        ne(transactions.payee, ''),
        eq(accounts.budgetId, budgetId)
      ))
      .orderBy(transactions.payee);
    return rows.map(row => row.payee as string);
  }

  return {
    getAccounts,
    getAccount,
    createAccount,
    updateAccount,
    getAccountType,
    isCreditCardAccount,
    updateAccountBalances,
    getReconciliationInfo,
    reconcileAccount,
    getPayees,
  };
}
