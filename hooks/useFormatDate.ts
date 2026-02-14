'use client';

import { useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { toIntlLocale } from '@/lib/i18n/config';

/**
 * Date formatting presets that cover all common patterns in the app.
 */
const DATE_PRESETS = {
  /** "14/02/2026" — transaction tables, standard date column */
  short: { day: '2-digit', month: '2-digit', year: 'numeric' } as const,

  /** "Feb 14" — dashboard, compact lists */
  compact: { day: 'numeric', month: 'short' } as const,

  /** "febrero" — month name only, used in BudgetInspector labels */
  monthLong: { month: 'long' } as const,

  /** "February 14, 2026" — profile page, verbose displays */
  long: { year: 'numeric', month: 'long', day: 'numeric' } as const,
} as const;

export type DatePreset = keyof typeof DATE_PRESETS;

/**
 * Hook that returns locale-aware date formatting functions.
 *
 * Reads the current locale from `next-intl` and maps it to the
 * full Intl locale via `toIntlLocale`.
 *
 * @example
 * const { formatDate, formatMonth } = useFormatDate();
 * formatDate('2026-02-14', 'short')   // → "14/02/2026" (es-CO) or "02/14/2026" (en-US)
 * formatDate('2026-02-14', 'compact') // → "14 feb" (es-CO) or "Feb 14" (en-US)
 * formatMonth('2026-02')              // → "febrero" (es-CO) or "February" (en-US)
 */
export function useFormatDate() {
  const locale = useLocale();
  const intlLocale = useMemo(() => toIntlLocale(locale), [locale]);

  const formatDate = useCallback(
    (dateStr: string, preset: DatePreset = 'short'): string => {
      const date = new Date(dateStr + (dateStr.length === 10 ? 'T12:00:00' : ''));
      return date.toLocaleDateString(intlLocale, DATE_PRESETS[preset]);
    },
    [intlLocale],
  );

  /**
   * Format a YYYY-MM string into just the month name (long form).
   *
   * @example formatMonth('2026-02') // → "febrero" (es-CO)
   */
  const formatMonth = useCallback(
    (monthStr: string): string => {
      const [year, month] = monthStr.split('-').map(Number);
      const date = new Date(year, month - 1);
      return date.toLocaleDateString(intlLocale, { month: 'long' });
    },
    [intlLocale],
  );

  /**
   * Format a YYYY-MM string into "Month Year" (capitalized).
   *
   * @example formatMonthYear('2026-02') // → "Febrero 2026"
   */
  const formatMonthYear = useCallback(
    (monthStr: string): string => {
      const [year, month] = monthStr.split('-').map(Number);
      const date = new Date(year, month - 1);
      const label = date.toLocaleDateString(intlLocale, { month: 'long' });
      return label.charAt(0).toUpperCase() + label.slice(1) + ' ' + year;
    },
    [intlLocale],
  );

  return { formatDate, formatMonth, formatMonthYear };
}
