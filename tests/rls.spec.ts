
import { test, expect } from '@playwright/test';
import { TEST_BASE_URL } from './test-constants';
import { t, TEST_LOCALE } from './i18n-helpers';

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

// Pin the test locale cookie for unauthenticated flows
test.beforeEach(async ({ page }) => {
    await page.context().addCookies([{
        name: 'NEXT_LOCALE',
        value: TEST_LOCALE,
        domain: 'localhost',
        path: '/',
    }]);
});

const BASE_URL = process.env.BASE_URL || TEST_BASE_URL;

test.describe('RLS & Multi-User Workflow', () => {
  const timestamp = Date.now();
  const userA = { name: 'User A', email: `rls.a.${timestamp}@test.com`, password: 'password123' };
  const userB = { name: 'User B', email: `rls.b.${timestamp}@test.com`, password: 'password123' };
  const budgetName = `RLS Budget ${timestamp}`;

  // This test performs a complex multi-step workflow: register → login → create budget
  // → share → logout → re-login → create accounts → create transfer
  // 60s timeout is required for the full flow.
  test('Login, Sharing, and Transfers work with RLS enabled', async ({ request, page }) => {
    test.setTimeout(60_000);

    // 1. Register User A and B
    console.log('Creating users...');
    const regA = await request.post(`${BASE_URL}/api/auth/register`, { data: userA });
    expect(regA.ok()).toBeTruthy();
    const regB = await request.post(`${BASE_URL}/api/auth/register`, { data: userB });
    expect(regB.ok()).toBeTruthy();

    // 2. Login as User A
    await page.goto('/auth/login');
    await page.getByLabel(t('auth.email')).fill(userA.email);
    await page.getByLabel(t('auth.password')).fill(userA.password);
    await page.getByRole('button', { name: new RegExp(t('auth.login'), 'i') }).click();
    
    // For new users with no budgets, app redirects to /budgets. 
    // Existing users might go to / (dashboard).
    // We just verify we are logged in by checking for the "New Budget" button or URL.
    await expect(page).toHaveURL(/\/budgets|\/$/, { timeout: 10_000 });

    // 3. Create Budget
    // On /budgets page, there is a "Create New Budget" button.
    // On / dashboard, there might be one too.
    if (page.url().endsWith('/budgets')) {
        await page.getByRole('button', { name: new RegExp(t('budgetList.createBudget'), 'i') }).click();
    } else {
        await page.getByRole('button', { name: t('sidebar.newBudget') }).click();
    }
    await page.getByLabel(t('budgetList.budgetNameLabel')).fill(budgetName);
    // Currency is a text input, not a select
    await page.getByRole('textbox', { name: t('budgetList.currencyLabel') }).fill('USD');
    await page.getByRole('button', { name: t('budgetList.submitCreate') }).click();
    await expect(page.getByText(budgetName)).toBeVisible({ timeout: 10_000 });
    
    // Get Budget ID from URL
    const url = page.url();
    const budgetId = url.match(/\/budgets\/(\d+)/)?.[1];
    expect(budgetId).toBeTruthy();

    // 4. Share with User B
    // Share button is on the dashboard list, not the budget view.
    await page.goto('/budgets');
    await expect(page.getByText(budgetName)).toBeVisible({ timeout: 10_000 });
    // Hover over the budget card to reveal the share button
    await page.getByText(budgetName).hover();
    await page.getByTitle(t('share.title')).click();

    await page.getByLabel(t('share.inviteLabel')).fill(userB.email);
    await page.getByRole('button', { name: new RegExp(t('share.inviteButton'), 'i') }).click();
    await expect(page.getByText(userB.email)).toBeVisible({ timeout: 5_000 });

    // Logout
    await page.goto('/api/auth/signout'); 

    // 5. Login as User B
    await page.goto('/auth/login');
    await page.getByLabel(t('auth.email')).fill(userB.email);
    await page.getByLabel(t('auth.password')).fill(userB.password);
    await page.getByRole('button', { name: new RegExp(t('auth.login'), 'i') }).click();
    await expect(page).toHaveURL(/\/budgets|\/$/, { timeout: 10_000 }); // Ensure login success

    // 6. Verify Access to Budget
    await expect(page.getByText(budgetName)).toBeVisible({ timeout: 10_000 });
    await page.getByText(budgetName).click();
    
    // Wait for the budget page to fully load (sidebar should show the budget name)
    await expect(page).toHaveURL(/\/budgets\/\d+/, { timeout: 10_000 });

    // 7. Create a Transfer (Verifies transfers RLS)
    // We need two accounts first.
    // Create Checking Account
    await page.getByRole('button', { name: t('sidebar.addAccount') }).click();
    await page.getByLabel(t('accounts.nameLabel')).fill('Checking A');
    await page.getByLabel(t('accounts.typeLabel')).selectOption('checking');
    await page.getByLabel(t('accounts.startingBalanceLabel')).fill('1000');
    await page.getByRole('button', { name: t('accounts.submitCreate') }).click();
    // Wait for account creation to complete
    await expect(page.getByText('Checking A')).toBeVisible({ timeout: 5_000 });

    // Create Savings Account
    await page.getByRole('button', { name: t('sidebar.addAccount') }).click();
    await page.getByLabel(t('accounts.nameLabel')).fill('Savings B');
    await page.getByLabel(t('accounts.typeLabel')).selectOption('savings');
    await page.getByLabel(t('accounts.startingBalanceLabel')).fill('0');
    await page.getByRole('button', { name: t('accounts.submitCreate') }).click();
    // Wait for account creation to complete
    await expect(page.getByText('Savings B')).toBeVisible({ timeout: 5_000 });

    // Navigate to All Accounts page which has the "Add Transaction" button
    await page.getByTestId('sidebar-nav-all-accounts').click();
    await expect(page).toHaveURL(/\/accounts$/, { timeout: 5_000 });
    
    // Create Transfer
    await page.getByTestId('add-transaction-button').click();
    
    // Select Transfer Type
    await page.getByRole('button', { name: t('transactions.transfer') }).click();

    // Select Destination Account (Savings B)
    // Using click on placeholder since it might be a custom select
    await page.getByText(t('transactions.destAccountPlaceholder')).click();
    // Wait for options and click
    await page.getByRole('option', { name: 'Savings B' }).click();

    // Fill Amount
    await page.getByLabel(t('transactions.totalAmount')).fill('100');

    // Save
    await page.getByRole('button', { name: t('transactions.saveChanges') }).click();

    // If successful, transfer is saved and we see it in the list.
    await expect(page.getByText(/Transfer.*Savings B|Transferencia.*Savings B/).first()).toBeVisible({ timeout: 5_000 });
    
    console.log('RLS Verification Passed');
  });
});
