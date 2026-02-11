import { test, expect } from '@playwright/test';
import { gotoBudgetPage } from './e2e-helpers';
import { TEST_BASE_URL } from './test-constants';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Data Import E2E Tests — Phase 5
 *
 * Tests the YNAB CSV import flow via the ImportModal:
 * - Opening the import modal from the sidebar
 * - Uploading CSV files
 * - Verifying imported data appears
 *
 * Uses small synthetic CSV fixtures to avoid large file dependencies.
 */

// Create fixture CSV files for testing
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

const REGISTER_FIXTURE = `"Account","Flag","Date","Payee","Category Group/Category","Category Group","Category","Memo","Outflow","Inflow","Cleared"
"E2E Checking","","15/01/2026","Starting Balance","Inflow/Ready to Assign","Inflow","Ready to Assign","","$0.00","$5,000.00","Cleared"
"E2E Checking","","16/01/2026","Tienda ABC","Essentials/Groceries","Essentials","Groceries","Test import","$100.00","$0.00","Cleared"`;

const PLAN_FIXTURE = `"Month","Category Group/Category","Category Group","Category","Assigned","Activity","Available"
"Jan 2026","Inflow/Ready to Assign","Inflow","Ready to Assign","$0.00","$5,000.00","$0.00"
"Jan 2026","Essentials/Groceries","Essentials","Groceries","$500.00","-$100.00","$400.00"`;

test.describe('Data Import', () => {
    test.beforeAll(async () => {
        // Create fixture files
        fs.mkdirSync(FIXTURES_DIR, { recursive: true });
        fs.writeFileSync(path.join(FIXTURES_DIR, 'register.csv'), REGISTER_FIXTURE);
        fs.writeFileSync(path.join(FIXTURES_DIR, 'plan.csv'), PLAN_FIXTURE);
    });

    test('opens import modal from sidebar budget dropdown', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        // Open the budget selector dropdown in the sidebar
        const sidebar = page.locator('aside');
        const budgetHeader = sidebar.locator('.cursor-pointer').first();
        await budgetHeader.click();

        // Click "Importar Datos" button
        const importBtn = sidebar.getByText('Importar Datos');
        await expect(importBtn).toBeVisible({ timeout: 5_000 });
        await importBtn.click();

        // The import modal should open
        await expect(page.getByText('Importar Datos YNAB')).toBeVisible({ timeout: 5_000 });

        // Verify the file inputs are present
        await expect(page.getByText('Register CSV')).toBeVisible();
        await expect(page.getByText('Plan CSV')).toBeVisible();

        // The import button should be disabled without files
        const submitBtn = page.getByRole('button', { name: /Importar Datos/i });
        await expect(submitBtn).toBeDisabled();
    });

    test('uploads CSV files and imports data successfully', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        // Open sidebar budget dropdown
        const sidebar = page.locator('aside');
        const budgetHeader = sidebar.locator('.cursor-pointer').first();
        await budgetHeader.click();

        // Click import
        await sidebar.getByText('Importar Datos').click();
        await expect(page.getByText('Importar Datos YNAB')).toBeVisible({ timeout: 5_000 });

        // Upload Register CSV
        const registerInput = page.getByTestId('import-register-file');
        await registerInput.setInputFiles(path.join(FIXTURES_DIR, 'register.csv'));

        // Upload Plan CSV
        const planInput = page.getByTestId('import-plan-file');
        await planInput.setInputFiles(path.join(FIXTURES_DIR, 'plan.csv'));

        // Both file names should appear
        await expect(page.getByText('register.csv')).toBeVisible();
        await expect(page.getByText('plan.csv')).toBeVisible();

        // Click import button (now enabled)
        const submitBtn = page.getByRole('button', { name: /Importar Datos/i });
        await expect(submitBtn).toBeEnabled();
        await submitBtn.click();

        // Wait for the success state
        await expect(page.getByText('¡Importación Exitosa!')).toBeVisible({ timeout: 30_000 });

        // Verify stats are displayed
        await expect(page.getByText('Cuentas')).toBeVisible();
        await expect(page.getByText('Transacciones')).toBeVisible();

        // Close the modal
        await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

        // Wait for cache refresh
        await page.waitForTimeout(2000);

        // The imported account should appear in the sidebar
        await expect(sidebar.getByText('E2E Checking')).toBeVisible({ timeout: 10_000 });
    });

    test('import via API returns proper stats', async ({ request }) => {
        const BASE_URL = TEST_BASE_URL;

        // Get the test budget ID
        const budgetsRes = await request.get(`${BASE_URL}/api/budgets`);
        const budgets = await budgetsRes.json();
        const budgetId = budgets[0].id;

        // Create FormData with CSV files
        const registerBuffer = Buffer.from(REGISTER_FIXTURE, 'utf-8');
        const planBuffer = Buffer.from(PLAN_FIXTURE, 'utf-8');

        const response = await request.post(`${BASE_URL}/api/budgets/${budgetId}/import`, {
            multipart: {
                register: {
                    name: 'register.csv',
                    mimeType: 'text/csv',
                    buffer: registerBuffer,
                },
                plan: {
                    name: 'plan.csv',
                    mimeType: 'text/csv',
                    buffer: planBuffer,
                },
            },
        });

        expect(response.ok()).toBeTruthy();
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.stats).toBeDefined();
        expect(result.stats.accounts).toBe(1);
        expect(result.stats.transactions).toBe(2);
        expect(result.stats.budgetEntries).toBe(2);
    });

    test('import API rejects request without files', async ({ request }) => {
        const BASE_URL = TEST_BASE_URL;

        const budgetsRes = await request.get(`${BASE_URL}/api/budgets`);
        const budgets = await budgetsRes.json();
        const budgetId = budgets[0].id;

        // Send empty form data
        const response = await request.post(`${BASE_URL}/api/budgets/${budgetId}/import`, {
            multipart: {},
        });

        expect(response.status()).toBe(400);
        const result = await response.json();
        expect(result.error).toContain('required');
    });
});
