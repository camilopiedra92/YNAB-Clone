/**
 * Type-safe translations for next-intl.
 *
 * This augments the `IntlMessages` interface so that `useTranslations()`
 * and `getTranslations()` validate keys at compile time.
 *
 * Usage:
 *   const t = useTranslations('budget');
 *   t('assigned')      // ✅ compiles — key exists
 *   t('asigned')       // ❌ TypeScript error — typo caught
 *
 * When adding/removing keys in `messages/en.json`, TypeScript will
 * flag all broken `t()` calls across the codebase.
 */

import en from '../messages/en.json';

type Messages = typeof en;

declare global {
  // next-intl reads this interface to type `useTranslations` / `getTranslations`
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}
