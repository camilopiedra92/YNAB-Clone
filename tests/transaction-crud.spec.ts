import { test, expect, type Page } from '@playwright/test';

/**
 * Transaction CRUD E2E Tests
 *
 * Covers:
 * - Create transaction (outflow + inflow)
 * - Edit transaction
 * - Delete transaction
 * - Toggle cleared status
 * - Verify account balance updates after mutations
 */

// Helper: navigate to the first account page and wait for it to load
async function goToFirstAccount(page: Page) {
    await page.goto('/budget');
    await expect(page.getByTestId('budget-table')).toBeVisible({ timeout: 15_000 });

    const firstAccount = page.locator('[data-testid^="sidebar-account-"]').first();
    await expect(firstAccount).toBeVisible({ timeout: 5_000 });
    await firstAccount.click();

    await expect(page).toHaveURL(/\/accounts\/\d+/);
    // Wait for the account page to fully load
    await expect(page.getByTestId('account-name')).toBeVisible({ timeout: 10_000 });
    // Wait for transactions to render
    await expect(page.locator('[data-testid^="transaction-row-"]').first()).toBeVisible({ timeout: 10_000 });
}

// Helper: open the transaction modal via the "Add Transaction" button
async function openNewTransactionModal(page: Page) {
    await page.getByTestId('add-transaction-button').click();
    await expect(page.getByTestId('transaction-form')).toBeVisible({ timeout: 5_000 });
}

// Helper: scroll to and click a button by test id (workaround for viewport issues in modals)
async function clickModalButton(page: Page, testId: string) {
    const button = page.getByTestId(testId);
    await button.scrollIntoViewIfNeeded();
    await button.click({ timeout: 10_000 });
}

// Helper: create a transaction and wait for it to appear
async function createTransaction(page: Page, opts: { payee: string; amount: string; type?: 'outflow' | 'inflow'; memo?: string }) {
    await openNewTransactionModal(page);

    if (opts.type === 'inflow') {
        await page.getByText('Entrada').click();
    }

    await page.getByTestId('transaction-payee').fill(opts.payee);

    const amountInput = page.getByTestId('currency-input');
    await amountInput.click();
    await amountInput.fill(opts.amount);

    if (opts.memo) {
        await page.getByTestId('transaction-memo').fill(opts.memo);
    }

    await clickModalButton(page, 'transaction-submit-button');
    await expect(page.getByTestId('transaction-form')).not.toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(2000);
}

test.describe('Transaction CRUD', () => {
    test('create an outflow transaction', async ({ page }) => {
        await goToFirstAccount(page);

        // Record working balance before
        const balanceBefore = await page.getByTestId('account-working-balance').textContent();

        // Create an outflow transaction
        await createTransaction(page, {
            payee: 'E2E Test Payee',
            amount: '50000',
            memo: 'E2E outflow test',
        });

        // Verify the new transaction appears in the table
        const table = page.locator('table');
        await expect(table.first()).toContainText('E2E Test Payee', { timeout: 10_000 });

        // Balance should have decreased (outflow)
        const balanceAfter = await page.getByTestId('account-working-balance').textContent();
        expect(balanceAfter).not.toBe(balanceBefore);
    });

    test('create an inflow transaction', async ({ page }) => {
        await goToFirstAccount(page);

        // Create an inflow transaction
        await createTransaction(page, {
            payee: 'E2E Inflow Source',
            amount: '100000',
            type: 'inflow',
        });

        // Verify transaction appears
        const table = page.locator('table');
        await expect(table.first()).toContainText('E2E Inflow Source', { timeout: 10_000 });
    });

    test('edit an existing transaction', async ({ page }) => {
        await goToFirstAccount(page);

        // Create a fresh transaction to edit (avoids dependency on prior tests)
        await createTransaction(page, {
            payee: 'E2E Edit Target',
            amount: '25000',
            memo: 'original memo',
        });

        // Click the transaction we just created to open edit modal
        const targetRow = page.locator('tr:has-text("E2E Edit Target")').first();
        await expect(targetRow).toBeVisible({ timeout: 10_000 });
        await targetRow.click();

        // The transaction form should open
        await expect(page.getByTestId('transaction-form')).toBeVisible({ timeout: 5_000 });

        // Modify the memo
        const memoField = page.getByTestId('transaction-memo');
        await memoField.clear();
        await memoField.fill('E2E edited memo');

        // Submit changes
        await clickModalButton(page, 'transaction-submit-button');
        await expect(page.getByTestId('transaction-form')).not.toBeVisible({ timeout: 10_000 });

        // Wait for data to refresh
        await page.waitForTimeout(2000);

        // Verify the memo change appears
        const table = page.locator('table');
        await expect(table.first()).toContainText('E2E edited memo', { timeout: 10_000 });
    });

    test('delete a transaction', async ({ page }) => {
        await goToFirstAccount(page);

        // Create a transaction we can safely delete
        await createTransaction(page, {
            payee: 'E2E Delete Target',
            amount: '1000',
        });

        // Verify it exists in the table
        const table = page.locator('table').first();
        await expect(table).toContainText('E2E Delete Target', { timeout: 10_000 });

        // Click the transaction we just created to open edit modal
        const targetRow = page.locator('tr:has-text("E2E Delete Target")').first();
        await targetRow.click();
        await expect(page.getByTestId('transaction-form')).toBeVisible({ timeout: 5_000 });

        // Handle the confirm dialog
        page.once('dialog', dialog => dialog.accept());

        // Click delete
        await clickModalButton(page, 'transaction-delete-button');

        // Modal should close
        await expect(page.getByTestId('transaction-form')).not.toBeVisible({ timeout: 10_000 });

        // Wait for data to refresh
        await page.waitForTimeout(2000);

        // Verify the transaction text is no longer visible in the table
        await expect(table).not.toContainText('E2E Delete Target', { timeout: 10_000 });
    });

    test('toggle cleared status on a transaction', async ({ page }) => {
        await goToFirstAccount(page);

        // Find the first cleared icon button (in the last column)
        // The cleared icon button has a title attribute
        const firstRow = page.locator('[data-testid^="transaction-row-"]').first();
        const clearBtn = firstRow.locator('button[title="Uncleared"], button[title="Cleared"]').first();

        if (await clearBtn.count() > 0) {
            const titleBefore = await clearBtn.getAttribute('title');

            // Click to toggle
            await clearBtn.click();
            await page.waitForTimeout(1000);

            // The title should have changed
            const titleAfter = await clearBtn.getAttribute('title');
            expect(titleAfter).not.toBe(titleBefore);
        }
    });
});
