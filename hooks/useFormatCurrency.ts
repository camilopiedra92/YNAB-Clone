'use client';

import { useLocale } from 'next-intl';
import { useBudget } from './useBudgets';
import { formatCurrency as rawFormat, formatCurrencyOrEmpty as rawFormatOrEmpty } from '@/lib/format';

/**
 * Hook that returns a locale-aware formatCurrency function.
 *
 * Reads the current locale from next-intl and the budget's currency,
 * wrapping the raw formatCurrency utility with those values.
 *
 * @example
 * const fmt = useFormatCurrency(budgetId);
 * fmt(1500000) // => "$1,500.00" or "$ 1.500" depending on locale
 */
export function useFormatCurrency(budgetId?: number) {
  const locale = useLocale();
  const { data: budget } = useBudget(budgetId);

  const currencyCode = budget?.currencyCode;

  // Map next-intl locale ('es', 'en') to Intl locale ('es-CO', 'en-US')
  // This mapping can be extended as more locales are added
  const intlLocale = locale === 'en' ? 'en-US' : 'es-CO';

  return {
    formatCurrency: (amount: number, fractionDigits?: number) =>
      rawFormat(amount, intlLocale, currencyCode, fractionDigits),
    formatCurrencyOrEmpty: (amount: number) =>
      rawFormatOrEmpty(amount, intlLocale, currencyCode),
  };
}
