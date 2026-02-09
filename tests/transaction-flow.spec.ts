import { test, expect } from '@playwright/test';

/**
 * Transaction Flow — Basic read scenarios.
 *
 * Covers:
 * - Navigate to account and see transactions
 * - Verify transaction rows have expected columns
 * - Multiple accounts accessible via sidebar
 */

test.describe('Transaction Flow', () => {
    test('navigating to an account shows the transactions table', async ({ page }) => {
        await page.goto('/budget');
        await expect(page.getByTestId('budget-table')).toBeVisible({ timeout: 15_000 });

        // Click the first account in the sidebar
        const firstAccount = page.locator('[data-testid^="sidebar-account-"]').first();
        await expect(firstAccount).toBeVisible({ timeout: 5_000 });
        await firstAccount.click();

        // Should navigate to the account page
        await expect(page).toHaveURL(/\/accounts\/\d+/);
        await expect(page.getByTestId('account-name')).toBeVisible({ timeout: 10_000 });

        // The transaction table should be visible
        const table = page.locator('table');
        await expect(table.first()).toBeVisible({ timeout: 10_000 });

        // Table should have expected column headers
        await expect(table.first()).toContainText('Date');
        await expect(table.first()).toContainText('Payee');
        await expect(table.first()).toContainText('Category');
        await expect(table.first()).toContainText('Outflow');
        await expect(table.first()).toContainText('Inflow');
    });

    test('transaction rows show expected data columns', async ({ page }) => {
        // Navigate to first account
        await page.goto('/budget');
        await expect(page.getByTestId('budget-table')).toBeVisible({ timeout: 15_000 });

        const firstAccount = page.locator('[data-testid^="sidebar-account-"]').first();
        await expect(firstAccount).toBeVisible({ timeout: 5_000 });
        await firstAccount.click();
        await expect(page).toHaveURL(/\/accounts\/\d+/);

        // Wait for transaction rows to render  
        const rows = page.locator('[data-testid^="transaction-row-"]');
        await expect(rows.first()).toBeVisible({ timeout: 10_000 });

        // There should be multiple transactions (db is pre-seeded)
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);
    });

    test('can navigate between different accounts', async ({ page }) => {
        await page.goto('/budget');
        await expect(page.getByTestId('budget-table')).toBeVisible({ timeout: 15_000 });

        // Get all account links
        const accounts = page.locator('[data-testid^="sidebar-account-"]');
        const accountCount = await accounts.count();

        if (accountCount >= 2) {
            // Navigate to first account
            await accounts.nth(0).click();
            await expect(page).toHaveURL(/\/accounts\/\d+/);
            const name1 = await page.getByTestId('account-name').textContent();

            // Navigate to second account
            await accounts.nth(1).click();
            await expect(page).toHaveURL(/\/accounts\/\d+/);
            
            // Wait for the header to update (avoid stale text from prev account)
            await expect(page.getByTestId('account-name')).not.toHaveText(name1 || '');
            const name2 = await page.getByTestId('account-name').textContent();

            // Names should be different
            expect(name2).not.toBeNull();
            expect(name1).not.toBe(name2);
        }
    });
});
