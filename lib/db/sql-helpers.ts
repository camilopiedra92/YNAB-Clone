/**
 * SQL Helpers — Centralized Database-Specific Functions
 *
 * This file centralizes ALL PostgreSQL-specific SQL constructs used across
 * repository queries. When migrating to another dialect, ONLY this file
 * needs to change.
 *
 * PostgreSQL version:
 *   currentDate()  → CURRENT_DATE
 *   yearMonth(col) → to_char(col, 'YYYY-MM')
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
