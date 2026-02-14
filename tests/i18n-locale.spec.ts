import { test, expect } from '@playwright/test';
import { gotoBudgetPage } from './e2e-helpers';
import { tLocale, TEST_LOCALE, type MessageKey } from './i18n-helpers';

// Determine starting and alternate locales based on TEST_LOCALE
const startLocale = TEST_LOCALE; // 'es' or 'en'
const altLocale = startLocale === 'es' ? 'en' : 'es';
const start = (key: MessageKey) => tLocale(startLocale, key);
const alt = (key: MessageKey) => tLocale(altLocale, key);

/**
 * i18n E2E Tests — Locale Switching
 *
 * Validates locale switching via the persistent top-bar language toggle.
 * Tests are locale-aware: they start from whatever TEST_LOCALE is set to
 * and toggle to the alternate locale, then back.
 *
 * IMPORTANT: Playwright tests are isolated (separate browser contexts).
 * The DB locale persists across tests, but the NEXT_LOCALE cookie does not.
 * Each test must be self-contained — switch locale within the test if needed.
 *
 * This file intentionally asserts both Spanish AND English strings
 * to verify that locale switching works correctly. Uses tLocale()
 * to look up expected strings by locale rather than hardcoding them.
 */

test.describe('Internationalization (i18n)', () => {

  // Reset to the test's starting locale before each test via API
  test.beforeEach(async ({ request }) => {
    await request.patch('/api/user/locale', {
      data: { locale: startLocale },
    });
  });

  test('language switcher is visible in the top bar', async ({ page, request }) => {
    await gotoBudgetPage(page, request);

    // The language switcher should be visible without opening any modal
    const switcher = page.getByTestId('language-switcher');
    await expect(switcher).toBeVisible({ timeout: 5_000 });

    // Both locale buttons should be present
    await expect(page.getByTestId('locale-en')).toBeVisible();
    await expect(page.getByTestId('locale-es')).toBeVisible();
  });

  test('switching to alternate locale updates page text', async ({ page, request }) => {
    await gotoBudgetPage(page, request);

    // Verify starting locale sidebar text
    await expect(page.getByTestId('sidebar-nav-plan')).toContainText(start('sidebar.plan'));

    // Click the alternate language button
    await page.getByTestId(`locale-${altLocale}`).click();

    // Wait for the locale API call to complete
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/user/locale') && resp.status() === 200,
      { timeout: 10_000 },
    );

    // Wait for server component refresh
    await page.waitForTimeout(2_000);

    // Sidebar text should now be in the alternate locale
    await expect(page.getByTestId('sidebar-nav-plan')).toContainText(alt('sidebar.plan'), { timeout: 10_000 });
  });

  test('switching back to original locale restores text', async ({ page, request }) => {
    await gotoBudgetPage(page, request);

    // Switch to alternate locale
    await page.getByTestId(`locale-${altLocale}`).click();
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/user/locale') && resp.status() === 200,
      { timeout: 10_000 },
    );
    await page.waitForTimeout(2_000);

    // Verify alternate locale
    await expect(page.getByTestId('sidebar-nav-plan')).toContainText(alt('sidebar.plan'), { timeout: 10_000 });

    // Switch back to starting locale
    await page.getByTestId(`locale-${startLocale}`).click();
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/user/locale') && resp.status() === 200,
      { timeout: 10_000 },
    );
    await page.waitForTimeout(2_000);

    // Should be back in starting locale
    await expect(page.getByTestId('sidebar-nav-plan')).toContainText(start('sidebar.plan'), { timeout: 10_000 });
  });

  test('locale persists across page reloads', async ({ page, request }) => {
    await gotoBudgetPage(page, request);

    // Switch to alternate locale
    await page.getByTestId(`locale-${altLocale}`).click();
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/user/locale') && resp.status() === 200,
      { timeout: 10_000 },
    );
    await page.waitForTimeout(1_000);

    // Full page reload
    await page.reload();
    await expect(page.getByTestId('budget-table')).toBeVisible({ timeout: 15_000 });

    // Sidebar should still be in alternate locale after reload
    await expect(page.getByTestId('sidebar-nav-plan')).toContainText(alt('sidebar.plan'), { timeout: 10_000 });
  });
});
