/**
 * E2E i18n Test Helpers — Locale-Independent Assertions
 *
 * Loads the message files at build time and provides a `t(key)` helper
 * that resolves dot-separated i18n keys to the translated string for
 * the current TEST_LOCALE.
 *
 * Usage in spec files:
 *   import { t } from './i18n-helpers';
 *   await page.getByLabel(t('auth.password')).fill('...');
 *   await page.getByRole('button', { name: t('auth.login') }).click();
 *
 * The TEST_LOCALE defaults to 'es' but can be overridden via env var
 * to verify locale-independence: TEST_LOCALE=en npx playwright test
 */

// Load message files at module init — uses readFileSync for ESM/CJS compatibility
// (Playwright runs in ESM mode where `import ... from '*.json'` requires `with { type: 'json' }`)
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const esMessages = JSON.parse(readFileSync(resolve(__dirname, '../messages/es.json'), 'utf-8'));
const enMessages = JSON.parse(readFileSync(resolve(__dirname, '../messages/en.json'), 'utf-8'));

// ─────────────────────────────────────────────────────────────────────
// Test Locale Configuration
// ─────────────────────────────────────────────────────────────────────

export const TEST_LOCALE = (process.env.TEST_LOCALE || 'es') as 'es' | 'en';

const messagesByLocale: Record<string, Record<string, unknown>> = {
  es: esMessages,
  en: enMessages,
};

// ─────────────────────────────────────────────────────────────────────
// Translation Helper
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolve a dot-separated i18n key to its translated string.
 *
 * @param key   Dot-separated path, e.g. 'auth.password' or 'sidebar.signOut'
 * @param params  Optional interpolation params, e.g. { name: 'Checking' }
 * @returns The translated string for TEST_LOCALE
 * @throws If the key is missing or doesn't resolve to a string
 *
 * @example
 *   t('auth.login')                    // "Iniciar Sesión" (es) / "Sign In" (en)
 *   t('sidebar.editAccount', { name: 'Checking' })  // "Editar Checking"
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const parts = key.split('.');
  let value: unknown = messagesByLocale[TEST_LOCALE];

  for (const part of parts) {
    if (value == null || typeof value !== 'object') {
      throw new Error(
        `i18n key "${key}" not found: segment "${part}" is not an object (locale: ${TEST_LOCALE})`,
      );
    }
    value = (value as Record<string, unknown>)[part];
  }

  if (typeof value !== 'string') {
    throw new Error(
      `i18n key "${key}" did not resolve to a string (got ${typeof value}, locale: ${TEST_LOCALE})`,
    );
  }

  if (params) {
    return Object.entries(params).reduce(
      (str, [k, v]) => str.replace(`{${k}}`, String(v)),
      value,
    );
  }

  return value;
}

// ─────────────────────────────────────────────────────────────────────
// Locale-Specific Helpers (for i18n-locale.spec.ts only)
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolve a key for a SPECIFIC locale (not the test default).
 * Only use this in i18n-locale.spec.ts where you need to assert
 * both Spanish AND English strings in the same test.
 */
export function tLocale(
  locale: 'es' | 'en',
  key: string,
  params?: Record<string, string | number>,
): string {
  const parts = key.split('.');
  let value: unknown = messagesByLocale[locale];

  for (const part of parts) {
    if (value == null || typeof value !== 'object') {
      throw new Error(
        `i18n key "${key}" not found: segment "${part}" is not an object (locale: ${locale})`,
      );
    }
    value = (value as Record<string, unknown>)[part];
  }

  if (typeof value !== 'string') {
    throw new Error(
      `i18n key "${key}" did not resolve to a string (got ${typeof value}, locale: ${locale})`,
    );
  }

  if (params) {
    return Object.entries(params).reduce(
      (str, [k, v]) => str.replace(`{${k}}`, String(v)),
      value,
    );
  }

  return value;
}
