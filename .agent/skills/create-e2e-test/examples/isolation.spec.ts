/**
 * Example: Tenant isolation test (testing cross-user access denial).
 *
 * Uses ISOLATION_USER (different from the default TEST_USER).
 * Must log in manually since auth.setup.ts only covers TEST_USER.
 *
 * Key conventions:
 * - Pin NEXT_LOCALE cookie for unauthenticated flows
 * - Use t() for ALL user-facing text (NEVER hardcode strings)
 */
import { test, expect } from '@playwright/test';
import { ISOLATION_USER, TEST_BASE_URL } from './test-constants';
import { getTestBudgetId } from './e2e-helpers';
import { t, TEST_LOCALE } from './i18n-helpers';

// Clear default auth — this test manages its own login
test.use({ storageState: { cookies: [], origins: [] } });

// Pin locale cookie for unauthenticated pages
test.beforeEach(async ({ page }) => {
    await page.context().addCookies([{
        name: 'NEXT_LOCALE',
        value: TEST_LOCALE,
        domain: 'localhost',
        path: '/',
    }]);
});

test.describe('Tenant Isolation', () => {

  test('cannot access another user budget via API', async ({ page, request }) => {
    // Get the test user's budget ID (from default auth session)
    const testBudgetId = await getTestBudgetId(request);

    // Log in as isolation user — use t() for locale-independent selectors
    await page.goto('/auth/login');
    await page.getByLabel(t('auth.email')).fill(ISOLATION_USER.email);
    await page.getByLabel(t('auth.password')).fill(ISOLATION_USER.password);
    await page.getByRole('button', { name: new RegExp(t('auth.login'), 'i') }).click();
    await expect(page).toHaveURL(/\/budgets/, { timeout: 15_000 });

    // Try to access test user's budget — should be denied
    const res = await page.request.get(
      `${TEST_BASE_URL}/api/budgets/${testBudgetId}/transactions`
    );
    expect(res.status()).toBe(403);
  });
});
