import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { TEST_USER, ISOLATION_USER, TEST_BASE_URL } from './test-constants';

/**
 * Tenant Isolation E2E Tests — Phase 3 Verification (V3.3–V3.8)
 *
 * Validates multi-tenant data isolation between two users:
 * - User A (test@test.com) → seeded budget with accounts, categories, transactions
 * - User B (isolation@test.com) → empty budget, zero data
 *
 * All tests authenticate via the browser login page and then use the
 * session cookies for API-level requests, directly verifying auth guards.
 */

const BASE_URL = TEST_BASE_URL;

const USER_A = TEST_USER;
const USER_B = ISOLATION_USER;

/**
 * Login as a specific user and return the authenticated request context
 * plus the user's budgetId (from GET /api/budgets).
 */
async function loginAndGetContext(
    page: Page,
    credentials: { email: string; password: string },
): Promise<{ request: APIRequestContext; budgetId: number }> {
    // Login via UI to get a session cookie
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(credentials.email);
    await page.getByLabel('Contraseña').fill(credentials.password);
    await page.getByRole('button', { name: /Iniciar Sesión/i }).click();

    // Wait for successful login redirect
    await expect(page).toHaveURL(/\/(budget|budgets)/, { timeout: 15_000 });

    // Use the page's request context (has session cookies)
    const response = await page.request.get(`${BASE_URL}/api/budgets`);
    expect(response.ok()).toBeTruthy();
    const budgets = await response.json();
    expect(budgets.length).toBeGreaterThan(0);

    return {
        request: page.request,
        budgetId: budgets[0].id,
    };
}

// These tests do NOT use the shared auth storageState — each test manages its own auth.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Tenant Isolation (Phase 3 Verification)', () => {
    /**
     * V3.3 — User A only sees data from their own budget; User B sees theirs.
     */
    test('V3.3: each user only sees their own budget data', async ({ page }) => {
        // Login as User A — seeded budget (has accounts)
        const userA = await loginAndGetContext(page, USER_A);

        const accountsA = await userA.request.get(
            `${BASE_URL}/api/budgets/${userA.budgetId}/accounts`,
        );
        expect(accountsA.ok()).toBeTruthy();
        const dataA = await accountsA.json();
        expect(dataA.length).toBeGreaterThan(0); // User A has seeded accounts

        // Logout
        await page.goto('/auth/login');

        // Login as User B — empty budget (no accounts)
        const userB = await loginAndGetContext(page, USER_B);

        const accountsB = await userB.request.get(
            `${BASE_URL}/api/budgets/${userB.budgetId}/accounts`,
        );
        expect(accountsB.ok()).toBeTruthy();
        const dataB = await accountsB.json();
        expect(dataB.length).toBe(0); // User B has no accounts (empty budget)

        // Budgets are different
        expect(userA.budgetId).not.toBe(userB.budgetId);
    });

    /**
     * V3.4 — Accessing another user's budget returns 403 Forbidden.
     */
    test('V3.4: accessing another user\'s budget returns 403', async ({ page }) => {
        // Login as User A
        const userA = await loginAndGetContext(page, USER_A);

        // Login as User B (re-use the same page, clearing session)
        await page.goto('/auth/login');
        const userB = await loginAndGetContext(page, USER_B);

        // User B tries to access User A's budget accounts → should be 403
        const forbidden = await userB.request.get(
            `${BASE_URL}/api/budgets/${userA.budgetId}/accounts`,
        );
        expect(forbidden.status()).toBe(403);

        // User B tries to access User A's budget data → should be 403
        const forbiddenBudget = await userB.request.get(
            `${BASE_URL}/api/budgets/${userA.budgetId}/budget?month=2025-12`,
        );
        expect(forbiddenBudget.status()).toBe(403);

        // User B tries to access User A's transactions → should be 403
        const forbiddenTx = await userB.request.get(
            `${BASE_URL}/api/budgets/${userA.budgetId}/transactions`,
        );
        expect(forbiddenTx.status()).toBe(403);
    });

    /**
     * V3.5 — Transaction created in budget A does NOT appear in budget B.
     */
    test('V3.5: transaction in budget A does not appear in budget B', async ({ page }) => {
        // Login as User A and get their accounts
        const userA = await loginAndGetContext(page, USER_A);

        const accountsRes = await userA.request.get(
            `${BASE_URL}/api/budgets/${userA.budgetId}/accounts`,
        );
        const accounts = await accountsRes.json();
        const firstAccount = accounts[0];
        expect(firstAccount).toBeDefined();

        // Get User A's current transaction count
        const txBeforeRes = await userA.request.get(
            `${BASE_URL}/api/budgets/${userA.budgetId}/transactions?accountId=${firstAccount.id}`,
        );
        const txBefore = await txBeforeRes.json();
        const countBefore = txBefore.length;

        // Create a transaction on User A's budget
        const createRes = await userA.request.post(
            `${BASE_URL}/api/budgets/${userA.budgetId}/transactions`,
            {
                data: {
                    budgetId: userA.budgetId,
                    accountId: firstAccount.id,
                    date: '2025-12-15',
                    payee: 'Isolation Test Payee',
                    outflow: 100000,
                    inflow: 0,
                    cleared: 'Uncleared',
                },
            },
        );
        expect(createRes.ok()).toBeTruthy();

        // Verify it shows up for User A
        const txAfterRes = await userA.request.get(
            `${BASE_URL}/api/budgets/${userA.budgetId}/transactions?accountId=${firstAccount.id}`,
        );
        const txAfter = await txAfterRes.json();
        expect(txAfter.length).toBe(countBefore + 1);

        // Logout & login as User B
        await page.goto('/auth/login');
        const userB = await loginAndGetContext(page, USER_B);

        // User B's budget should have zero transactions
        const txBRes = await userB.request.get(
            `${BASE_URL}/api/budgets/${userB.budgetId}/transactions`,
        );
        expect(txBRes.ok()).toBeTruthy();
        const txB = await txBRes.json();
        expect(txB.length).toBe(0);

        // User B cannot access User A's transactions
        const forbiddenTx = await userB.request.get(
            `${BASE_URL}/api/budgets/${userA.budgetId}/transactions`,
        );
        expect(forbiddenTx.status()).toBe(403);
    });

    /**
     * V3.6 — RTA calculates correctly per budget (no cross-budget data mixing).
     */
    test('V3.6: RTA calculates correctly per budget', async ({ page }) => {
        // Login as User A
        const userA = await loginAndGetContext(page, USER_A);

        const budgetARes = await userA.request.get(
            `${BASE_URL}/api/budgets/${userA.budgetId}/budget?month=2025-12`,
        );
        expect(budgetARes.ok()).toBeTruthy();
        const budgetA = await budgetARes.json();
        // User A's budget has seeded data — RTA is defined (value depends on budget state)
        expect(budgetA.readyToAssign).toBeDefined();

        // Logout & login as User B
        await page.goto('/auth/login');
        const userB = await loginAndGetContext(page, USER_B);

        const budgetBRes = await userB.request.get(
            `${BASE_URL}/api/budgets/${userB.budgetId}/budget?month=2025-12`,
        );
        expect(budgetBRes.ok()).toBeTruthy();
        const budgetB = await budgetBRes.json();
        // User B's empty budget should have RTA = 0 (no accounts, no money)
        expect(budgetB.readyToAssign).toBeDefined();
        expect(budgetB.readyToAssign).toBe(0);

        // Cross-access: User B cannot access User A's budget data
        const forbiddenBudget = await userB.request.get(
            `${BASE_URL}/api/budgets/${userA.budgetId}/budget?month=2025-12`,
        );
        expect(forbiddenBudget.status()).toBe(403);
    });

    /**
     * V3.7 + V3.8 — Full 2-user isolation: verify zero data leaks across
     * all major endpoints (accounts, categories, transactions, budget, payees).
     */
    test('V3.7/V3.8: comprehensive endpoint isolation — zero data leaks', async ({ page }) => {
        // Login as User A
        const userA = await loginAndGetContext(page, USER_A);

        // Collect User A data counts
        const [acctARes, catARes, txARes, payeeARes] = await Promise.all([
            userA.request.get(`${BASE_URL}/api/budgets/${userA.budgetId}/accounts`),
            userA.request.get(`${BASE_URL}/api/budgets/${userA.budgetId}/categories`),
            userA.request.get(`${BASE_URL}/api/budgets/${userA.budgetId}/transactions`),
            userA.request.get(`${BASE_URL}/api/budgets/${userA.budgetId}/payees`),
        ]);

        const acctA = await acctARes.json();
        const catA = await catARes.json();
        const txA = await txARes.json();
        const payeeA = await payeeARes.json();

        expect(acctA.length).toBeGreaterThan(0);
        expect(catA.length).toBeGreaterThan(0);
        expect(txA.length).toBeGreaterThan(0);
        expect(payeeA.length).toBeGreaterThan(0);

        // Logout & login as User B
        await page.goto('/auth/login');
        const userB = await loginAndGetContext(page, USER_B);

        // User B's empty budget — all endpoints should return empty arrays
        const [acctBRes, catBRes, txBRes, payeeBRes] = await Promise.all([
            userB.request.get(`${BASE_URL}/api/budgets/${userB.budgetId}/accounts`),
            userB.request.get(`${BASE_URL}/api/budgets/${userB.budgetId}/categories`),
            userB.request.get(`${BASE_URL}/api/budgets/${userB.budgetId}/transactions`),
            userB.request.get(`${BASE_URL}/api/budgets/${userB.budgetId}/payees`),
        ]);

        const acctB = await acctBRes.json();
        const catB = await catBRes.json();
        const txB = await txBRes.json();
        const payeeB = await payeeBRes.json();

        expect(acctB.length).toBe(0);
        expect(catB.length).toBe(0);
        expect(txB.length).toBe(0);
        expect(payeeB.length).toBe(0);

        // Cross-access: User B → User A's budget → all 403
        const crossChecks = await Promise.all([
            userB.request.get(`${BASE_URL}/api/budgets/${userA.budgetId}/accounts`),
            userB.request.get(`${BASE_URL}/api/budgets/${userA.budgetId}/categories`),
            userB.request.get(`${BASE_URL}/api/budgets/${userA.budgetId}/transactions`),
            userB.request.get(`${BASE_URL}/api/budgets/${userA.budgetId}/payees`),
            userB.request.get(`${BASE_URL}/api/budgets/${userA.budgetId}/budget?month=2025-12`),
        ]);

        for (const res of crossChecks) {
            expect(res.status()).toBe(403);
        }
    });
});
