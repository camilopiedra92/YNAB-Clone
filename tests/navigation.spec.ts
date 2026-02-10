import { test, expect } from '@playwright/test';
import { gotoBudgetPage, allAccountsUrl } from './e2e-helpers';

test.describe('Navigation', () => {
    test('sidebar budget link navigates to budget page', async ({ page, request }) => {
        // Start on the budget page (ensures sidebar is loaded)
        const budgetId = await gotoBudgetPage(page, request);

        // Navigate away first — go to all accounts
        await page.goto(allAccountsUrl(budgetId));
        await page.waitForTimeout(2000);

        // Click the Plan link in the sidebar
        const planLink = page.getByTestId('sidebar-nav-plan');
        await expect(planLink).toBeVisible({ timeout: 10_000 });
        await planLink.click();

        // Should be on the budget page
        await expect(page).toHaveURL(/\/budget/);
        await expect(page.getByTestId('budget-table')).toBeVisible({ timeout: 15_000 });
    });

    test('sidebar account link navigates to account page', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        // Click the first account link
        const firstAccount = page.locator('[data-testid^="sidebar-account-"]').first();
        await expect(firstAccount).toBeVisible({ timeout: 5_000 });
        await firstAccount.click();

        // Should navigate to account page
        await expect(page).toHaveURL(/\/accounts\/\d+/);

        // Verify we can navigate back to budget
        await page.getByTestId('sidebar-nav-plan').click();
        await expect(page).toHaveURL(/\/budget/);
        await expect(page.getByTestId('budget-table')).toBeVisible({ timeout: 15_000 });
    });

    test('all accounts link navigates correctly', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        // Click the All Accounts link
        const allAccountsLink = page.getByTestId('sidebar-nav-all-accounts');
        await expect(allAccountsLink).toBeVisible();
        await allAccountsLink.click();

        // Should navigate to all accounts page
        await expect(page).toHaveURL(/\/accounts/);
    });
});
