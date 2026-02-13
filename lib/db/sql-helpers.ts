/**
 * SQL Helpers — Centralized Database-Specific Functions
 *
 * This file centralizes ALL PostgreSQL-specific SQL constructs used across
 * repository queries. When migrating to another dialect, ONLY this file
 * needs to change.
 *
 * PostgreSQL version:
 *   currentDate()       → CURRENT_DATE
 *   yearMonth(col)      → to_char(col, 'YYYY-MM')
 *   notFutureDate(col)  → col <= CURRENT_DATE
 */
import { sql, type SQL, type Column } from 'drizzle-orm';

/**
 * Returns SQL expression for the current date (today).
 * PostgreSQL: CURRENT_DATE → YYYY-MM-DD date value
 */
export const currentDate = (): SQL => sql`CURRENT_DATE`;

/**
 * Extracts YYYY-MM from a date column.
 * PostgreSQL: to_char(column, 'YYYY-MM')
 * Works with native PG date columns.
 */
export const yearMonth = (column: Column): SQL => sql`to_char(${column}, 'YYYY-MM')`;

/**
 * Excludes future-dated rows: column <= CURRENT_DATE.
 *
 * MANDATORY for ALL financial transaction queries (MEMORY §4D).
 * Future transactions are excluded from balances, activity, overspending,
 * and every other financial calculation. YNAB only budgets money you have
 * right now.
 *
 * Usage:  WHERE ... AND ${notFutureDate(transactions.date)}
 */
export const notFutureDate = (column: Column): SQL => sql`${column} <= ${currentDate()}`;
