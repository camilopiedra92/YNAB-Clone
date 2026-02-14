import { test, expect } from '@playwright/test';
import { TEST_USER, TEST_BASE_URL } from './test-constants';
import { t, TEST_LOCALE } from './i18n-helpers';

/**
 * Auth E2E Tests — Phase 4.4.3
 *
 * Validates authentication flows:
 * - Login with valid credentials
 * - Login with invalid credentials (error displayed)
 * - Register a new user (auto-login + redirect)
 * - Logout via sidebar button
 * - Protected route redirects to login
 *
 * These tests manage their OWN auth state (no shared storageState).
 */

const BASE_URL = TEST_BASE_URL;

// Clear cookies so each test starts unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

// Pin the test locale cookie for unauthenticated flows (no shared storageState)
test.beforeEach(async ({ page }) => {
    await page.context().addCookies([{
        name: 'NEXT_LOCALE',
        value: TEST_LOCALE,
        domain: 'localhost',
        path: '/',
    }]);
});

test.describe('Authentication Flows', () => {
    test('login with valid credentials redirects to budgets', async ({ page }) => {
        await page.goto('/auth/login');

        await page.getByLabel(t('auth.email')).fill(TEST_USER.email);
        await page.getByLabel(t('auth.password')).fill(TEST_USER.password);
        await page.getByRole('button', { name: new RegExp(t('auth.login'), 'i') }).click();

        // Should redirect to budget area (budgets list or budget page)
        await expect(page).toHaveURL(/\/(budget|budgets)/, { timeout: 15_000 });
    });

    test('login with invalid credentials shows error', async ({ page }) => {
        await page.goto('/auth/login');

        await page.getByLabel(t('auth.email')).fill(TEST_USER.email);
        await page.getByLabel(t('auth.password')).fill('wrongpassword');
        await page.getByRole('button', { name: new RegExp(t('auth.login'), 'i') }).click();

        // Error message should appear
        await expect(page.getByText(t('auth.invalidCredentials'))).toBeVisible({ timeout: 10_000 });

        // Should stay on login page
        await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('register a new user redirects after auto-login', async ({ page }) => {
        const uniqueEmail = `e2e-register-${Date.now()}@test.com`;

        await page.goto('/auth/register');

        await page.getByLabel(t('auth.name')).fill('E2E Register Test');
        await page.getByLabel(t('auth.email')).fill(uniqueEmail);
        // Fill both password fields
        const passwordFields = page.locator('input[type="password"]');
        await passwordFields.nth(0).fill('password123');
        await passwordFields.nth(1).fill('password123');

        await page.getByRole('button', { name: new RegExp(t('auth.createAccount'), 'i') }).click();

        // Should auto-login and redirect
        await expect(page).toHaveURL(/\/(budget|budgets)/, { timeout: 15_000 });
    });

    test('logout redirects to login page', async ({ page }) => {
        // First, login
        await page.goto('/auth/login');
        await page.getByLabel(t('auth.email')).fill(TEST_USER.email);
        await page.getByLabel(t('auth.password')).fill(TEST_USER.password);
        await page.getByRole('button', { name: new RegExp(t('auth.login'), 'i') }).click();
        await expect(page).toHaveURL(/\/(budget|budgets)/, { timeout: 15_000 });

        // Navigate to a budget page so the sidebar is visible
        const budgets = await page.request.get(`${BASE_URL}/api/budgets`);
        const budgetList = await budgets.json();
        if (budgetList.length > 0) {
            await page.goto(`/budgets/${budgetList[0].id}/budget`);
        }

        // Click the logout button
        const logoutButton = page.locator(`button[title="${t('sidebar.signOut')}"]`);
        await expect(logoutButton).toBeVisible({ timeout: 10_000 });
        await logoutButton.click();

        // Should redirect to login
        await expect(page).toHaveURL(/\/auth\/login/, { timeout: 15_000 });
    });

    test('accessing protected route without login redirects to login', async ({ page }) => {
        // Try to go directly to a budget page without being logged in
        await page.goto('/budgets');

        // Should redirect to login
        await expect(page).toHaveURL(/\/auth\/login/, { timeout: 15_000 });
    });
});
