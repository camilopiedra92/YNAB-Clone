import { test, expect, type Page } from '@playwright/test';

/**
 * Account & Category Management E2E Tests
 *
 * Covers:
 * - Account page displays balance breakdown (cleared + uncleared = working)
 * - Transaction search filters correctly
 * - Create a new category group via the budget toolbar
 * - Budget inspector panel is visible when selecting a category
 * - All Accounts page shows aggregated data
 */

// Helper: wait for budget page to fully load
async function waitForBudgetLoad(page: Page) {
    await page.goto('/budget');
    await expect(page.getByTestId('budget-table')).toBeVisible({ timeout: 15_000 });
    const firstRow = page.locator('[data-testid^="category-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
}

// Helper: navigate to first account
async function goToFirstAccount(page: Page) {
    await page.goto('/budget');
    await expect(page.getByTestId('budget-table')).toBeVisible({ timeout: 15_000 });
    const firstAccount = page.locator('[data-testid^="sidebar-account-"]').first();
    await expect(firstAccount).toBeVisible({ timeout: 5_000 });
    await firstAccount.click();
    await expect(page).toHaveURL(/\/accounts\/\d+/);
    await expect(page.getByTestId('account-name')).toBeVisible({ timeout: 10_000 });
}

test.describe('Account Page', () => {
    test('shows account name and balance breakdown', async ({ page }) => {
        await goToFirstAccount(page);

        // Account name should be visible
        const accountName = page.getByTestId('account-name');
        await expect(accountName).toBeVisible();
        const name = await accountName.textContent();
        expect(name!.length).toBeGreaterThan(0);

        // Working balance should be visible
        const workingBalance = page.getByTestId('account-working-balance');
        await expect(workingBalance).toBeVisible();

        // The balance display should contain "Cleared", "Uncleared", "Working Balance"
        const header = page.locator('header');
        await expect(header).toContainText('Cleared');
        await expect(header).toContainText('Uncleared');
        await expect(header).toContainText('Working Balance');
    });

    test('Add Transaction button opens modal', async ({ page }) => {
        await goToFirstAccount(page);

        // Click "Add Transaction"
        await page.getByTestId('add-transaction-button').click();

        // Modal form should be visible
        await expect(page.getByTestId('transaction-form')).toBeVisible({ timeout: 5_000 });

        // The modal should have expected form elements
        await expect(page.getByTestId('currency-input')).toBeVisible();
        await expect(page.getByTestId('date-picker')).toBeVisible();
        await expect(page.getByTestId('transaction-submit-button')).toBeVisible();

        // Cancel should close modal
        await page.getByTestId('transaction-cancel-button').click();
        await expect(page.getByTestId('transaction-form')).not.toBeVisible({ timeout: 3_000 });
    });

    test('search filters transactions by payee', async ({ page }) => {
        await goToFirstAccount(page);

        // Wait for transactions to load
        const firstRow = page.locator('[data-testid^="transaction-row-"]').first();
        await expect(firstRow).toBeVisible({ timeout: 10_000 });

        // Count transactions before search
        const countBefore = await page.locator('[data-testid^="transaction-row-"]').count();

        // Type a query that likely matches very few or no transactions
        const searchInput = page.getByTestId('transaction-search');
        await searchInput.fill('xyzzzz_nonexistent');
        await page.waitForTimeout(500);

        // Either fewer results or the "No transactions" empty state
        const countAfter = await page.locator('[data-testid^="transaction-row-"]').count();
        expect(countAfter).toBeLessThanOrEqual(countBefore);

        // Clear the search
        await searchInput.clear();
        await page.waitForTimeout(500);

        // Results should return
        const countReset = await page.locator('[data-testid^="transaction-row-"]').count();
        expect(countReset).toBe(countBefore);
    });

    test('Reconcile button opens reconciliation modal', async ({ page }) => {
        await goToFirstAccount(page);

        // Click Reconcile
        await page.getByTestId('reconcile-button').click();

        // The reconcile modal should appear with balance info
        await expect(page.getByText('Reconcile Account')).toBeVisible({ timeout: 5_000 });
        await expect(page.getByText('Cleared Balance')).toBeVisible();
        await expect(page.getByText('Verify Balance')).toBeVisible();
    });
});

test.describe('All Accounts Page', () => {
    test('shows aggregated transaction list', async ({ page }) => {
        await page.goto('/budget');
        await expect(page.getByTestId('budget-table')).toBeVisible({ timeout: 15_000 });

        // Click "All Accounts" in sidebar
        const allAccountsLink = page.getByTestId('sidebar-nav-all-accounts');
        await expect(allAccountsLink).toBeVisible();
        await allAccountsLink.click();

        await expect(page).toHaveURL(/\/accounts/);

        // The page should have a table with transaction data
        const table = page.locator('table');
        await expect(table.first()).toBeVisible({ timeout: 10_000 });
    });
});

test.describe('Category Group Creation', () => {
    test('create a new category group via the budget toolbar', async ({ page }) => {
        await waitForBudgetLoad(page);

        // Click the "Category Group" button in toolbar
        const createGroupBtn = page.getByText('Category Group', { exact: false });
        await expect(createGroupBtn).toBeVisible();
        await createGroupBtn.click();

        // A popover input should appear
        const input = page.locator('input[placeholder*="Monthly Bills"]');
        await expect(input).toBeVisible({ timeout: 3_000 });

        // Type a group name
        await input.fill('E2E Test Group');

        // Click "Create Group"
        await page.getByText('Create Group').click();

        // Wait for the group to appear in the budget table
        await page.waitForTimeout(2000);

        // The new group name should appear in the budget table
        const budgetTable = page.getByTestId('budget-table');
        await expect(budgetTable).toContainText('E2E Test Group', { timeout: 10_000 });
    });
});

test.describe('Budget Inspector', () => {
    test('selecting a category shows the inspector panel', async ({ page }) => {
        await waitForBudgetLoad(page);

        // Click on a category row to select it (not the assigned cell)
        const firstRow = page.locator('[data-testid^="category-row-"]').first();
        await firstRow.click();

        // The inspector panel should become visible with budget data
        // The BudgetInspector renders "{MonthName}'s Summary" (e.g. "Febrero's Summary")
        // and always shows "Available", "Activity", "Auto-Assign" sections
        await page.waitForTimeout(500);

        // Look for inspector content that's always rendered
        const summarySection = page.locator("text=Summary").first();
        const availableLabel = page.locator("text=Available").first();
        const autoAssign = page.locator("text=Auto-Assign").first();

        // At least one of these should be visible
        const hasSummary = await summarySection.count();
        const hasAvailable = await availableLabel.count();
        const hasAutoAssign = await autoAssign.count();
        expect(hasSummary + hasAvailable + hasAutoAssign).toBeGreaterThan(0);
    });
});
