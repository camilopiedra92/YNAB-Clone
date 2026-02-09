/**
 * Shared currency formatting utilities.
 *
 * All monetary values in the app are stored and transmitted as Milliunits
 * (integer × 1000). These functions handle the conversion for UI display.
 */
import { fromMilliunits, type Milliunit } from './engine/primitives';

/**
 * Format a Milliunit value as a human-readable currency string.
 *
 * Converts from milliunits (÷1000) before applying locale formatting.
 *
 * @example formatCurrency(1500000000) // => "$ 1.500.000" (COP)
 * @example formatCurrency(0)          // => "$ 0"
 */
export function formatCurrency(amount: number, minimumFractionDigits = 2): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits,
    maximumFractionDigits: minimumFractionDigits,
  }).format(fromMilliunits(amount as Milliunit));
}

/**
 * Format a Milliunit value as a currency string, returning empty for zero.
 *
 * Useful for CurrencyInput display where zero should show as empty.
 */
export function formatCurrencyOrEmpty(amount: number): string {
  if (amount === 0) return '';
  return formatCurrency(amount);
}
