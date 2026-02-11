/**
 * Accessibility E2E Tests — axe-core WCAG 2.1 AA Audit
 *
 * Runs automated accessibility checks on the main app pages
 * to verify WCAG AA compliance. Uses @axe-core/playwright.
 *
 * Note: `color-contrast` is excluded because the neumorphic design
 * uses CSS custom properties that axe-core cannot statically resolve,
 * causing false positives. Contrast is verified manually.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoBudgetPage, gotoFirstAccount } from './e2e-helpers';

test.describe('Accessibility — WCAG 2.1 AA', () => {

    test('budget page has no critical WCAG AA violations', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .disableRules(['color-contrast'])
            .analyze();

        // Log violations for debugging
        if (results.violations.length > 0) {
            console.log('Budget page violations:');
            for (const v of results.violations) {
                console.log(`  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`);
            }
        }

        // Allow minor/moderate violations but zero critical/serious
        const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
        expect(critical, `Found ${critical.length} critical/serious a11y violations on budget page`).toHaveLength(0);
    });

    test('account page has no critical WCAG AA violations', async ({ page, request }) => {
        await gotoFirstAccount(page, request);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .disableRules(['color-contrast'])
            .analyze();

        if (results.violations.length > 0) {
            console.log('Account page violations:');
            for (const v of results.violations) {
                console.log(`  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`);
            }
        }

        const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
        expect(critical, `Found ${critical.length} critical/serious a11y violations on account page`).toHaveLength(0);
    });

    test('skip-to-content link exists and targets main content', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        const skipLink = page.locator('a.skip-to-content');
        await expect(skipLink).toBeAttached();
        await expect(skipLink).toHaveAttribute('href', '#main-content');

        const mainContent = page.locator('#main-content');
        await expect(mainContent).toBeAttached();
    });

    test('RTA widget has aria-live region', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        const rtaWidget = page.locator('[aria-live="polite"][role="status"]').filter({
            has: page.getByTestId('rta-amount'),
        });
        await expect(rtaWidget).toBeVisible();
    });

    test('modal has dialog role and accessible close', async ({ page, request }) => {
        await gotoFirstAccount(page, request);

        // Open "Add Transaction" modal
        const addBtn = page.getByTestId('add-transaction-button');
        await expect(addBtn).toBeVisible({ timeout: 5_000 });
        await addBtn.click();

        // Verify dialog semantics
        const dialog = page.locator('[role="dialog"][aria-modal="true"]');
        await expect(dialog).toBeVisible({ timeout: 3_000 });

        // Verify aria-labelledby points to a title
        const labelledBy = await dialog.getAttribute('aria-labelledby');
        expect(labelledBy).toBeTruthy();

        const title = page.locator(`#${labelledBy}`);
        await expect(title).toBeVisible();

        // Verify Escape closes the modal
        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible({ timeout: 2_000 });
    });

});
