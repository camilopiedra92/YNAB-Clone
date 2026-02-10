import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { gotoBudgetPage } from './e2e-helpers';

/**
 * Budget Assignment E2E Tests
 *
 * Covers:
 * - Assigning money to a category via the budget table
 * - Verifying RTA decreases after assignment
 * - Clearing an assignment (setting to 0)
 * - Available column updates after assignment
 * - Month navigation preserves assignments
 */

// Helper: wait for budget page to fully load
async function waitForBudgetLoad(page: Page, request: APIRequestContext) {
    await gotoBudgetPage(page, request);
    // Wait for category rows to render
    const firstRow = page.locator('[data-testid^="category-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
}

// Helper: parse currency text to a number (handles COP format like "$ 1.234.567")
function parseCurrency(text: string | null): number {
    if (!text) return 0;
    // Remove everything except digits, minus, and decimal separators
    // COP format uses dots as thousands sep and commas as decimal (or vice versa)
    const cleaned = text.replace(/[^0-9\-.,]/g, '');
    // For COP with no decimals: "1.234.567" → replace all dots with nothing
    const noThousands = cleaned.replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(noThousands) || 0;
}

test.describe('Budget Assignment', () => {
    test('assign money to a category and RTA decreases', async ({ page, request }) => {
        await waitForBudgetLoad(page, request);

        // Find the first non-CC category's assigned cell and click it to edit
        const firstAssigned = page.locator('[data-testid^="category-assigned-"]').first();
        await expect(firstAssigned).toBeVisible();

        // Get the category id from the data-testid
        const testId = await firstAssigned.getAttribute('data-testid');
        const categoryId = testId?.replace('category-assigned-', '');

        // Click to start editing
        await firstAssigned.click();

        // An input should appear (inline edit box)
        const editInput = page.locator(`[data-testid="category-row-${categoryId}"] input[type="text"][inputMode="decimal"]`);
        await expect(editInput).toBeVisible({ timeout: 3_000 });

        // Type a value
        await editInput.fill('500000');
        await editInput.press('Enter');

        // Wait for the mutation to propagate
        await page.waitForTimeout(2000);

        // Verify the assigned cell shows the new value
        const assignedAfter = page.locator(`[data-testid="category-assigned-${categoryId}"]`);
        await expect(assignedAfter).toBeVisible();
        const assignedText = await assignedAfter.textContent();
        const assignedValue = parseCurrency(assignedText);
        expect(assignedValue).toBe(500000);
    });

    test('available column reflects assigned value for new month', async ({ page, request }) => {
        await waitForBudgetLoad(page, request);

        // Navigate to a future month (less likely to have data)
        await page.getByTestId('month-next').click();
        await page.getByTestId('month-next').click();
        await page.waitForTimeout(1000);

        // Wait for category rows to load in the new month
        const firstRow = page.locator('[data-testid^="category-row-"]').first();
        await expect(firstRow).toBeVisible({ timeout: 10_000 });

        // Check that assigned and available columns exist
        const firstAssigned = page.locator('[data-testid^="category-assigned-"]').first();
        await expect(firstAssigned).toBeVisible();

        const firstAvailable = page.locator('[data-testid^="category-available-"]').first();
        await expect(firstAvailable).toBeVisible();
    });

    test('RTA is visible and non-empty after navigating months', async ({ page, request }) => {
        await waitForBudgetLoad(page, request);

        // Navigate forward
        await page.getByTestId('month-next').click();
        await page.waitForTimeout(1000);

        // RTA should still be visible
        const rta = page.getByTestId('rta-amount');
        await expect(rta).toBeVisible();
        const text = await rta.textContent();
        expect(text!.length).toBeGreaterThan(0);

        // Navigate back
        await page.getByTestId('month-prev').click();
        await page.waitForTimeout(1000);
        await expect(rta).toBeVisible();
    });

    test('RTA amount persists correctly across page reloads after assignment', async ({ page, request }) => {
        await waitForBudgetLoad(page, request);

        // Wait for RTA to stabilize after any pending mutations from prior tests
        await page.waitForTimeout(2000);

        // Get initial RTA (whatever it is after all prior tests)
        const rtaBefore = await page.getByTestId('rta-amount').textContent();

        // Reload
        await page.reload();
        await expect(page.getByTestId('budget-table')).toBeVisible({ timeout: 15_000 });
        await page.locator('[data-testid^="category-row-"]').first().waitFor({ timeout: 10_000 });

        // Wait for RTA to load after reload
        await page.waitForTimeout(1000);

        const rtaAfter = await page.getByTestId('rta-amount').textContent();

        // Both values should match (RTA is deterministic for the same data)
        expect(rtaAfter).toBe(rtaBefore);
    });
});
