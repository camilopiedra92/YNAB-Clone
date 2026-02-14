/**
 * i18n Configuration — single source of truth for locale settings.
 *
 * All locale-related constants, mappings, and utilities live here.
 * No other file should hardcode locale strings (e.g., 'es-CO', 'en-US').
 *
 * Architecture:
 *  - `AppLocale` = the short locale sent to `next-intl` ('es', 'en')
 *  - `IntlLocale` = the full BCP 47 locale used by `Intl.*` APIs ('es-CO', 'en-US')
 */

// ── Supported Locales ───────────────────────────────────────────────
// Keep in sync with `messages/*.json` files.

export const locales = ['es', 'en'] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = 'es';

// ── Intl Locale Mapping ─────────────────────────────────────────────
// Maps short `next-intl` locale → full BCP 47 tag for `Intl.NumberFormat`,
// `Intl.DateTimeFormat`, and the `<html lang>` attribute.
//
// When adding a new locale:
//   1. Add the short locale to `locales` above.
//   2. Add the mapping here.
//   3. Create `messages/{locale}.json`.
//   4. The CI guard `check:i18n-keys` will enforce key parity.

const INTL_LOCALE_MAP: Record<AppLocale, string> = {
  es: 'es-CO',
  en: 'en-US',
} as const;

/**
 * Convert a short `next-intl` locale to a full BCP 47 `Intl` locale.
 *
 * @example toIntlLocale('es')  // → 'es-CO'
 * @example toIntlLocale('en')  // → 'en-US'
 */
export function toIntlLocale(locale: string): string {
  return INTL_LOCALE_MAP[locale as AppLocale] ?? INTL_LOCALE_MAP[defaultLocale];
}

/**
 * Check if a string is a valid AppLocale.
 */
export function isValidLocale(value: string): value is AppLocale {
  return locales.includes(value as AppLocale);
}

// ── date-fns Locale Mapping ─────────────────────────────────────────
// Centralizes the date-fns locale import so components don't need
// inline ternaries or per-component imports.

import type { Locale } from 'date-fns';
import { es } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';

const DATE_FNS_LOCALE_MAP: Record<AppLocale, Locale> = {
  es: es,
  en: enUS,
};

/**
 * Convert a short `next-intl` locale to a `date-fns` Locale object.
 *
 * @example toDateFnsLocale('es')  // → date-fns `es` locale
 * @example toDateFnsLocale('en')  // → date-fns `enUS` locale
 */
export function toDateFnsLocale(locale: string): Locale {
  return DATE_FNS_LOCALE_MAP[locale as AppLocale] ?? DATE_FNS_LOCALE_MAP[defaultLocale];
}

