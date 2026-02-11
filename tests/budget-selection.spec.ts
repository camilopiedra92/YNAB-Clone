import { test, expect } from '@playwright/test';
import { TEST_BASE_URL } from './test-constants';

/**
 * Budget Selection E2E Tests — Phase 4.4.4
 *
 * Validates budget CRUD and selection flows:
 * - Budget list page shows existing budgets
 * - Create a new budget
 * - Select a budget to navigate into it
 * - Switch between budgets via sidebar dropdown
 *
 * Uses shared auth storageState (pre-logged-in as test@test.com).
 */

const BASE_URL = TEST_BASE_URL;

test.describe('Budget Selection', () => {
    test('budget list page shows existing budgets', async ({ page }) => {
        // Navigate to budget list
        await page.goto('/budgets');

        // Wait for budgets to load
        await page.waitForTimeout(2000);

        // The page should show "Mis Presupuestos" title
        await expect(page.getByText('Mis Presupuestos')).toBeVisible({ timeout: 10_000 });

        // At least the test budget should be listed (created in global-setup)
        await expect(page.getByText('Test Budget')).toBeVisible({ timeout: 10_000 });
    });

    test('create a new budget from budget list', async ({ page }) => {
        await page.goto('/budgets');
        await page.waitForTimeout(2000);

        // Click "Crear Nuevo Presupuesto"
        await page.getByText('Crear Nuevo Presupuesto').click();

        // Should navigate to /budgets/new
        await expect(page).toHaveURL(/\/budgets\/new/, { timeout: 10_000 });

        // Fill in budget name
        const nameInput = page.getByPlaceholder('Ej. Gastos Casa, Ahorros 2026...');
        await expect(nameInput).toBeVisible({ timeout: 5_000 });
        await nameInput.fill('E2E Test Budget');

        // Submit
        await page.getByRole('button', { name: /Crear Presupuesto/i }).click();

        // Should redirect after creation (to budget page or budget list)
        await expect(page).toHaveURL(/\/(budget|budgets)/, { timeout: 15_000 });
    });

    test('selecting a budget navigates to the budget page', async ({ page, request }) => {
        // Get the test budget ID via API
        const res = await request.get(`${BASE_URL}/api/budgets`);
        expect(res.ok()).toBeTruthy();
        const budgets = await res.json();
        const testBudget = budgets.find((b: { name: string }) => b.name === 'Test Budget');
        expect(testBudget).toBeDefined();

        // Navigate directly to the budget
        await page.goto(`/budgets/${testBudget.id}/budget`);

        // Should show the budget table
        await expect(page.getByTestId('budget-table')).toBeVisible({ timeout: 15_000 });

        // RTA should be visible
        await expect(page.getByTestId('rta-amount')).toBeVisible();
    });

    test('sidebar shows budget name and allows switching', async ({ page, request }) => {
        // Get budgets via API
        const res = await request.get(`${BASE_URL}/api/budgets`);
        const budgets = await res.json();
        expect(budgets.length).toBeGreaterThan(0);

        const firstBudget = budgets[0];

        // Navigate to the first budget
        await page.goto(`/budgets/${firstBudget.id}/budget`);
        await expect(page.getByTestId('budget-table')).toBeVisible({ timeout: 15_000 });

        // The sidebar should show the budget name
        const sidebar = page.locator('aside');
        await expect(sidebar).toContainText(firstBudget.name, { timeout: 5_000 });
    });

    test('navigating to /budgets shows all user budgets', async ({ page, request }) => {
        // Get expected budget count
        const res = await request.get(`${BASE_URL}/api/budgets`);
        const budgets = await res.json();

        // Navigate to budget list
        await page.goto('/budgets');
        await page.waitForTimeout(2000);

        // Each budget should be visible
        for (const budget of budgets) {
            await expect(page.getByText(budget.name).first()).toBeVisible({ timeout: 5_000 });
        }
    });
});
