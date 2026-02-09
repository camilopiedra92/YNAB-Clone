/**
 * Account Repository — CRUD, balance calculations, reconciliation, and payees.
 *
 * Part of the Repository Pattern.
 * Orchestration layer: queries → engine → writes.
 * All queries use Drizzle ORM query builder.
 */
import { eq, sql, ne, and, isNotNull } from 'drizzle-orm';
import { accounts, transactions } from '../db/schema';
import { currentDate } from '../db/sql-helpers';
import { milliunit, ZERO } from '../engine/primitives';
import type { DrizzleDB } from './client';
import { queryRows } from './client';

export function createAccountFunctions(database: DrizzleDB) {

  async function getAccounts() {
    return database.select().from(accounts)
      .orderBy(accounts.name);
  }

  async function getAccount(id: number) {
    const rows = await database.select().from(accounts)
      .where(eq(accounts.id, id));
    return rows[0];
  }

  async function createAccount(account: {
    name: string;
    type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'tracking';
    balance?: number;
  }) {
    const bal = milliunit(account.balance || 0);
    const rows = await database.insert(accounts)
      .values({
        name: account.name,
        type: account.type,
        balance: bal,
        clearedBalance: bal,
        unclearedBalance: ZERO,
      })
      .returning();
    return rows[0];
  }

  async function updateAccount(id: number, updates: {
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
      .where(eq(accounts.id, id));
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

  async function updateAccountBalances(accountId: number) {
    const rows = await queryRows<{
      balance: number;
      clearedBalance: number;
      unclearedBalance: number;
    }>(database, sql`
      SELECT 
        COALESCE(SUM(${transactions.inflow} - ${transactions.outflow}), 0) as balance,
        COALESCE(SUM(CASE WHEN ${transactions.cleared} IN ('Cleared', 'Reconciled') THEN ${transactions.inflow} - ${transactions.outflow} ELSE 0 END), 0) as "clearedBalance",
        COALESCE(SUM(CASE WHEN ${transactions.cleared} = 'Uncleared' THEN ${transactions.inflow} - ${transactions.outflow} ELSE 0 END), 0) as "unclearedBalance"
      FROM ${transactions}
      WHERE ${transactions.accountId} = ${accountId} AND ${transactions.date} <= ${currentDate()}
    `);
    const result = rows[0];

    return database.update(accounts)
      .set({
        balance: milliunit(Number(result!.balance)),
        clearedBalance: milliunit(Number(result!.clearedBalance)),
        unclearedBalance: milliunit(Number(result!.unclearedBalance)),
      })
      .where(eq(accounts.id, accountId));
  }

  async function getReconciliationInfo(accountId: number) {
    const rows = await queryRows<{
      clearedBalance: number;
      reconciledBalance: number;
      pendingClearedBalance: number;
      pendingClearedCount: number;
    }>(database, sql`
      SELECT 
        COALESCE(SUM(CASE WHEN ${transactions.cleared} IN ('Cleared', 'Reconciled') THEN ${transactions.inflow} - ${transactions.outflow} ELSE 0 END), 0) as "clearedBalance",
        COALESCE(SUM(CASE WHEN ${transactions.cleared} = 'Reconciled' THEN ${transactions.inflow} - ${transactions.outflow} ELSE 0 END), 0) as "reconciledBalance",
        COALESCE(SUM(CASE WHEN ${transactions.cleared} = 'Cleared' THEN ${transactions.inflow} - ${transactions.outflow} ELSE 0 END), 0) as "pendingClearedBalance",
        COUNT(CASE WHEN ${transactions.cleared} = 'Cleared' THEN 1 END) as "pendingClearedCount"
      FROM ${transactions}
      WHERE ${transactions.accountId} = ${accountId} AND ${transactions.date} <= ${currentDate()}
    `);
    return rows[0];
  }

  async function reconcileAccount(accountId: number) {
    return database.update(transactions)
      .set({ cleared: 'Reconciled' })
      .where(and(
        eq(transactions.accountId, accountId),
        eq(transactions.cleared, 'Cleared'),
        sql`${transactions.date} <= ${currentDate()}`
      ));
  }

  async function getPayees() {
    const rows = await database.selectDistinct({ payee: transactions.payee })
      .from(transactions)
      .where(and(isNotNull(transactions.payee), ne(transactions.payee, '')))
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
