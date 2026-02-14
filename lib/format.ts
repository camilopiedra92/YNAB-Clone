/**
 * Shared currency formatting utilities.
 *
 * All monetary values in the app are stored and transmitted as Milliunits
 * (integer × 1000). These functions handle the conversion for UI display.
 */
import { fromMilliunits, type Milliunit } from './engine/primitives';
import { DEFAULT_LOCALE, DEFAULT_CURRENCY } from './constants';

/**
 * Format a Milliunit value as a human-readable currency string.
 *
 * Converts from milliunits (÷1000) before applying locale formatting.
 * Accepts optional locale and currency for i18n support;
 * falls back to DEFAULT_LOCALE and DEFAULT_CURRENCY.
 *
 * @example formatCurrency(1500000000)                 // => "$ 1.500.000" (COP, es-CO)
 * @example formatCurrency(1500000, 'en-US', 'USD')    // => "$1,500.00"
 * @example formatCurrency(0)                          // => "$ 0"
 */
export function formatCurrency(
  amount: number,
  locale: string = DEFAULT_LOCALE,
  currency: string = DEFAULT_CURRENCY,
  minimumFractionDigits = 2,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits: minimumFractionDigits,
  }).format(fromMilliunits(amount as Milliunit));
}

/**
 * Format a Milliunit value as a currency string, returning empty for zero.
 *
 * Useful for CurrencyInput display where zero should show as empty.
 */
export function formatCurrencyOrEmpty(
  amount: number,
  locale: string = DEFAULT_LOCALE,
  currency: string = DEFAULT_CURRENCY,
): string {
  if (amount === 0) return '';
  return formatCurrency(amount, locale, currency);
}
