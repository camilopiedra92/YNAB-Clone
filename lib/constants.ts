/**
 * Application Constants — single source of truth for magic numbers.
 *
 * Centralizes values that were previously scattered across hooks, routes,
 * and components. Grouped by domain for easy discovery.
 */

// ── React Query Stale Times ─────────────────────────────────────────
// How long cached data is considered "fresh" before React Query refetches.

export const STALE_TIME = {
  /** Accounts — changes on transaction create/update/delete */
  ACCOUNTS: 30_000,          // 30 seconds
  /** Transactions — most volatile data in the app */
  TRANSACTIONS: 15_000,      // 15 seconds
  /** Budget table — changes on assignment edits */
  BUDGET: 5 * 60_000,        // 5 minutes
  /** Categories — rarely changes (rename, create, reorder) */
  CATEGORIES: 5 * 60_000,    // 5 minutes
  /** Default — used in global QueryClient config */
  DEFAULT: 60_000,           // 1 minute
} as const;

// ── Upload Limits ───────────────────────────────────────────────────

/** Maximum file size for CSV imports (bytes) */
export const UPLOAD_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Locale & Currency Defaults ──────────────────────────────────────
// These are derived from the centralized i18n config.
// Prefer importing from `@/lib/i18n/config` directly for new code.
// These re-exports exist for backward compatibility.

import { toIntlLocale, defaultLocale } from '@/lib/i18n/config';

/** Default Intl locale for number/date formatting (derived from i18n config) */
export const DEFAULT_LOCALE = toIntlLocale(defaultLocale);

/** Default currency code (ISO 4217) */
export const DEFAULT_CURRENCY = 'COP';
