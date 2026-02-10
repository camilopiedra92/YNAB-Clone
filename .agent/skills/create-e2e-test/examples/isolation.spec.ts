/**
 * Example: Tenant isolation test (testing cross-user access denial).
 *
 * Uses ISOLATION_USER (different from the default TEST_USER).
 * Must log in manually since auth.setup.ts only covers TEST_USER.
 */
import { test, expect } from '@playwright/test';
import { ISOLATION_USER, TEST_BASE_URL } from './test-constants';
import { getTestBudgetId } from './e2e-helpers';

test.describe('Tenant Isolation', () => {

  test('cannot access another user budget via API', async ({ page, request }) => {
    // Get the test user's budget ID (from default auth session)
    const testBudgetId = await getTestBudgetId(request);

    // Log in as isolation user
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(ISOLATION_USER.email);
    await page.getByLabel('Contraseña').fill(ISOLATION_USER.password);
    await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
    await expect(page).toHaveURL(/\/budget/, { timeout: 15_000 });

    // Try to access test user's budget — should be denied
    const res = await page.request.get(
      `${TEST_BASE_URL}/api/budgets/${testBudgetId}/transactions`
    );
    expect(res.status()).toBe(403);
  });
});
