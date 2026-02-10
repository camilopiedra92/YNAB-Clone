/**
 * Shared E2E Test Helpers — Budget URL Resolution
 *
 * After the SaaS multi-tenant migration, the app uses
 * `/budgets/[budgetId]/...` URL structure. These helpers
 * resolve the budgetId for the test user on first use
 * and provide URL builders for all test files.
 */
import { type Page, type APIRequestContext, expect } from '@playwright/test';
import { TEST_BASE_URL } from './test-constants';

const BASE_URL = process.env.BASE_URL || TEST_BASE_URL;

let cachedBudgetId: number | null = null;

/**
 * Fetches the first budgetId owned by the authenticated test user.
 * Uses the /api/budgets endpoint (requires auth state to be loaded).
 * Caches the result to avoid repeated API calls across tests.
 */
export async function getTestBudgetId(request: APIRequestContext): Promise<number> {
    if (cachedBudgetId) return cachedBudgetId;

    const res = await request.get(`${BASE_URL}/api/budgets`);
    expect(res.ok()).toBeTruthy();
    const budgets = await res.json();
    expect(budgets.length).toBeGreaterThan(0);

    cachedBudgetId = budgets[0].id as number;
    return cachedBudgetId;
}

/** Budget page URL for the test user's budget */
export function budgetUrl(budgetId: number): string {
    return `/budgets/${budgetId}/budget`;
}

/** Account page URL */
export function accountUrl(budgetId: number, accountId: number): string {
    return `/budgets/${budgetId}/accounts/${accountId}`;
}

/** All accounts page URL */
export function allAccountsUrl(budgetId: number): string {
    return `/budgets/${budgetId}/accounts`;
}

/**
 * Navigate to the budget page and wait for full load.
 * Replaces `page.goto('/budget')` + budget-table wait pattern.
 */
export async function gotoBudgetPage(page: Page, request: APIRequestContext): Promise<number> {
    const id = await getTestBudgetId(request);
    await page.goto(budgetUrl(id));
    await expect(page.getByTestId('budget-table')).toBeVisible({ timeout: 15_000 });
    return id;
}

/**
 * Navigate to the first account in the sidebar.
 * Replaces the goToFirstAccount() helper in several test files.
 */
export async function gotoFirstAccount(page: Page, request: APIRequestContext): Promise<number> {
    const id = await gotoBudgetPage(page, request);

    const firstAccount = page.locator('[data-testid^="sidebar-account-"]').first();
    await expect(firstAccount).toBeVisible({ timeout: 5_000 });
    await firstAccount.click();

    await expect(page).toHaveURL(/\/accounts\/\d+/);
    await expect(page.getByTestId('account-name')).toBeVisible({ timeout: 10_000 });
    return id;
}
