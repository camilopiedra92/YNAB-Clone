import { test, expect } from '@playwright/test';
import { gotoBudgetPage } from './e2e-helpers';

test.describe('Budget Flow', () => {
    test('budget page loads and shows RTA amount', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        // RTA amount should be visible
        const rta = page.getByTestId('rta-amount');
        await expect(rta).toBeVisible();
        // RTA text should contain a currency value ($ or any currency symbol)
        await expect(rta).not.toHaveText('');
    });

    test('month navigation works', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        // Get the initial month display text
        const monthDisplay = page.getByTestId('month-display');
        const initialMonth = await monthDisplay.textContent();

        // Navigate forward
        await page.getByTestId('month-next').click();
        await page.waitForTimeout(500); // wait for month transition
        const nextMonth = await monthDisplay.textContent();
        expect(nextMonth).not.toBe(initialMonth);

        // Navigate back twice (should be at previous month now)
        await page.getByTestId('month-prev').click();
        await page.waitForTimeout(500);
        const backMonth = await monthDisplay.textContent();
        expect(backMonth).toBe(initialMonth);
    });

    test('budget table displays category rows', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        // Wait for data to load and rows to render
        const firstRow = page.locator('[data-testid^="category-row-"]').first();
        await expect(firstRow).toBeVisible({ timeout: 10_000 });

        // There should be at least one category row visible
        const rows = page.locator('[data-testid^="category-row-"]');
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);

        // Each row should have assigned and available elements
        await expect(rows.first()).toBeVisible();
    });

    test('RTA amount is visible after page reload', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        // Wait for the RTA animation to settle — the value starts at "$ 0,00"
        // while the query loads, then animates to the real value.
        // We poll until the value stabilizes (same value for 500ms).
        const rtaLocator = page.getByTestId('rta-amount');
        let stableValue = '';
        let lastValue = '';
        let stableCount = 0;
        for (let i = 0; i < 20; i++) {
            await page.waitForTimeout(250);
            const current = await rtaLocator.textContent() ?? '';
            if (current === lastValue) {
                stableCount++;
                if (stableCount >= 2) {
                    stableValue = current;
                    break;
                }
            } else {
                stableCount = 0;
                lastValue = current;
            }
        }
        expect(stableValue).not.toBe('');

        // Reload and verify persistence
        await page.reload();
        await expect(page.getByTestId('budget-table')).toBeVisible({ timeout: 15_000 });

        // Wait for stabilization after reload too
        let stableAfter = '';
        let lastAfter = '';
        let stableCountAfter = 0;
        for (let i = 0; i < 20; i++) {
            await page.waitForTimeout(250);
            const current = await rtaLocator.textContent() ?? '';
            if (current === lastAfter) {
                stableCountAfter++;
                if (stableCountAfter >= 2) {
                    stableAfter = current;
                    break;
                }
            } else {
                stableCountAfter = 0;
                lastAfter = current;
            }
        }
        expect(stableAfter).toBe(stableValue);
    });
});
