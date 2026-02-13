
import { test, expect } from '@playwright/test';
import { TEST_BASE_URL } from './test-constants';

/**
 * RLS Functional Verification
 *
 * Verifies that the RLS implementation (migration 0009) does not break
 * core features that rely on the protected tables:
 * 1. Login (uses `get_user_by_email_privileged` RPC)
 * 2. Budget Sharing (uses `get_user_by_email_privileged` RPC)
 * 3. Transfers (uses `transfers` table with `budget_id` RLS)
 */

test.use({ storageState: { cookies: [], origins: [] } });

const BASE_URL = process.env.BASE_URL || TEST_BASE_URL;

test.describe('RLS & Multi-User Workflow', () => {
  const timestamp = Date.now();
  const userA = { name: 'User A', email: `rls.a.${timestamp}@test.com`, password: 'password123' };
  const userB = { name: 'User B', email: `rls.b.${timestamp}@test.com`, password: 'password123' };
  const budgetName = `RLS Budget ${timestamp}`;

  test('Login, Sharing, and Transfers work with RLS enabled', async ({ request, page }) => {
    // 1. Register User A and B
    console.log('Creating users...');
    const regA = await request.post(`${BASE_URL}/api/auth/register`, { data: userA });
    expect(regA.ok()).toBeTruthy();
    const regB = await request.post(`${BASE_URL}/api/auth/register`, { data: userB });
    expect(regB.ok()).toBeTruthy();

    // 2. Login as User A
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(userA.email);
    await page.getByLabel('Contraseña').fill(userA.password);
    await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
    
    // For new users with no budgets, app redirects to /budgets. 
    // Existing users might go to / (dashboard).
    // We just verify we are logged in by checking for the "New Budget" button or URL.
    await expect(page).toHaveURL(/\/budgets|\/$/);

    // 3. Create Budget
    // On /budgets page, there is a "Crear Nuevo Presupuesto" button.
    // On / dashboard, there might be one too.
    if (page.url().endsWith('/budgets')) {
        await page.getByRole('button', { name: /Crear Nuevo Presupuesto/i }).click();
    } else {
        await page.getByRole('button', { name: 'Nuevo Presupuesto' }).click();
    }
    await page.getByLabel('Nombre del presupuesto').fill(budgetName);
    // Currency is a text input, not a select
    await page.getByRole('textbox', { name: /Moneda/i }).fill('USD');
    await page.getByRole('button', { name: 'Crear Presupuesto' }).click();
    await expect(page.getByText(budgetName)).toBeVisible();
    
    // Get Budget ID from URL
    const url = page.url();
    const budgetId = url.match(/\/budgets\/(\d+)/)?.[1];
    expect(budgetId).toBeTruthy();

    // 4. Share with User B
    // Share button is on the dashboard list, not the budget view.
    await page.goto('/budgets');
    // Hover over the budget card to reveal the share button
    await page.getByText(budgetName).hover();
    await page.getByTitle('Compartir presupuesto').click();

    await page.getByLabel('Invitar por email').fill(userB.email);
    await page.getByRole('button', { name: 'Invitar' }).click();
    await expect(page.getByText(userB.email)).toBeVisible();

    // Logout
    await page.goto('/api/auth/signout'); 

    // 5. Login as User B
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(userB.email);
    await page.getByLabel('Contraseña').fill(userB.password);
    await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
    await expect(page).toHaveURL(/\/budgets|\/$/); // Ensure login success

    // 6. Verify Access to Budget
    await expect(page.getByText(budgetName)).toBeVisible();
    await page.getByText(budgetName).click();
    
    // 7. Create a Transfer (Verifies transfers RLS)
    // We need two accounts first.
    // Create Checking Account
    await page.getByRole('button', { name: 'Add Account' }).click();
    await page.getByLabel('Account Name').fill('Checking A');
    await page.getByLabel('Account Type').selectOption('checking');
    await page.getByLabel('Starting Balance').fill('1000');
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Create Savings Account
    await page.getByRole('button', { name: 'Add Account' }).click();
    await page.getByLabel('Account Name').fill('Savings B');
    await page.getByLabel('Account Type').selectOption('savings');
    await page.getByLabel('Starting Balance').fill('0');
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Navigate to All Accounts page which has the "Add Transaction" button
    await page.getByTestId('sidebar-nav-all-accounts').click();
    
    // Create Transfer
    await page.getByRole('button', { name: 'Add Transaction' }).click();
    
    // Select Transfer Type
    await page.getByRole('button', { name: 'Transfer' }).click();

    // Select Destination Account (Savings B)
    // Using click on placeholder since it might be a custom select
    await page.getByText('Selecciona cuenta destino...').click();
    // Wait for options and click
    await page.getByRole('option', { name: 'Savings B' }).click();

    // Fill Amount
    await page.getByLabel('Monto total').fill('100');

    // Save
    await page.getByRole('button', { name: 'Guardar Cambios' }).click();

    // If successful, transfer is saved and we see it in the list.
    await expect(page.getByText('Transfer : Savings B')).toBeVisible();
    
    console.log('RLS Verification Passed');
  });
});
