/**
 * Auth Setup — Playwright authentication fixture.
 *
 * Logs in as the test user, pins the test locale via cookie,
 * and saves the browser session state so all subsequent E2E
 * specs run as authenticated with a deterministic locale.
 */
import { test as setup, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import { TEST_USER } from './test-constants';
import { t, TEST_LOCALE } from './i18n-helpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, '..', '.auth', 'user.json');

setup('authenticate', async ({ page }) => {
  // Pin locale BEFORE navigating so the first server render uses it
  await page.context().addCookies([{
    name: 'NEXT_LOCALE',
    value: TEST_LOCALE,
    domain: 'localhost',
    path: '/',
  }]);

  // Navigate to login page
  await page.goto('/auth/login');

  // Fill in credentials (locale-independent via i18n keys)
  await page.getByLabel(t('auth.email')).fill(TEST_USER.email);
  await page.getByLabel(t('auth.password')).fill(TEST_USER.password);

  // Submit
  await page.getByRole('button', { name: new RegExp(t('auth.login'), 'i') }).click();

  // Wait for redirect to budget page (successful login)
  await expect(page).toHaveURL(/\/budget/, { timeout: 15_000 });

  // Save auth state (includes NEXT_LOCALE cookie) for reuse in all tests
  await page.context().storageState({ path: AUTH_FILE });
});
