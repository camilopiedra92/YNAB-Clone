/**
 * Example: Playwright E2E test spec.
 *
 * Location: tests/<feature-name>.spec.ts
 *
 * Key conventions:
 * - Use helpers from e2e-helpers.ts for navigation
 * - Use data-testid selectors (not CSS)
 * - Wait for server roundtrip after mutations
 * - Auth is automatic via auth.setup.ts dependency
 */
import { test, expect } from '@playwright/test';
import { gotoBudgetPage } from './e2e-helpers';

test.describe('Goals Feature', () => {

  test('can view goals on budget page', async ({ page, request }) => {
    // Navigate (authenticated, waits for budget-table)
    await gotoBudgetPage(page, request);

    // Interact
    await page.getByTestId('goals-tab').click();

    // Assert
    await expect(page.getByTestId('goals-list')).toBeVisible({ timeout: 10_000 });
  });

  test('can create a new goal', async ({ page, request }) => {
    const budgetId = await gotoBudgetPage(page, request);

    // Open modal
    await page.getByTestId('add-goal-button').click();
    await expect(page.getByTestId('goal-modal')).toBeVisible();

    // Fill form
    await page.getByTestId('goal-amount').fill('500000');
    await page.getByTestId('goal-date').fill('2026-12');

    // Submit and wait for roundtrip
    await page.getByTestId('goal-save').click();
    await page.waitForResponse(resp =>
      resp.url().includes(`/api/budgets/${budgetId}/goals`) && resp.status() === 201
    );

    // Verify
    await expect(page.getByTestId('goal-item')).toBeVisible();
  });

  test('handles animated values correctly', async ({ page, request }) => {
    await gotoBudgetPage(page, request);

    // Poll for animated value stability (RTA uses useAnimatedNumber)
    const rtaLocator = page.getByTestId('rta-amount');
    let stableValue = '';
    let lastValue = '';
    let stableCount = 0;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(250);
      const current = await rtaLocator.textContent() ?? '';
      if (current === lastValue) {
        stableCount++;
        if (stableCount >= 2) { stableValue = current; break; }
      } else {
        stableCount = 0;
        lastValue = current;
      }
    }
    expect(stableValue).not.toBe('');
  });
});
