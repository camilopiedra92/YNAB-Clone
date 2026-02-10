import { test, expect } from '@playwright/test';
import { TEST_BASE_URL } from './test-constants';

/**
 * Security E2E Tests — Phase 6 Verification
 *
 * Validates:
 * - Security headers are present in responses
 * - Account lockout after 5 failed login attempts (DB-level)
 * - Rate limiting returns 429 on excessive requests (in-memory)
 *
 * IMPORTANT: lockout and rate-limit tests use different X-Forwarded-For
 * IPs to avoid conflicting with each other's rate limit buckets.
 */

test.use({ storageState: { cookies: [], origins: [] } });

const BASE_URL = process.env.BASE_URL || TEST_BASE_URL;

// ─────────────────────────────────────────────────────────────────────
// Security Headers
// ─────────────────────────────────────────────────────────────────────
test.describe('Security Headers', () => {
    test('page responses include essential security headers', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/auth/login`);
        expect(response.ok()).toBeTruthy();

        const headers = response.headers();
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
        expect(headers['x-xss-protection']).toBe('1; mode=block');
        expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    test('API responses include security headers', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/budgets`);
        const headers = response.headers();
        expect(headers['x-content-type-options']).toBe('nosniff');
    });
});

// ─────────────────────────────────────────────────────────────────────
// Account Lockout (DB-level, NOT rate limiting)
// ─────────────────────────────────────────────────────────────────────
test.describe('Account Lockout', () => {
    const lockoutEmail = `lockout-${Date.now()}@test.com`;
    const correctPassword = 'correctpass123';

    test('locks account after 5 failed login attempts', async ({ page, request }) => {
        // Register a fresh user
        // Use unique IP to avoid rate limiting on register
        const regRes = await request.post(`${BASE_URL}/api/auth/register`, {
            data: {
                name: 'Lockout Test',
                email: lockoutEmail,
                password: correctPassword,
            },
            headers: { 'x-forwarded-for': '10.0.1.1' },
        });
        expect(regRes.ok()).toBeTruthy();

        // Get CSRF token
        const csrfRes = await request.get(`${BASE_URL}/api/auth/csrf`);
        const { csrfToken } = await csrfRes.json();

        // Fire 5 failed login attempts via API — each with a unique IP
        // to avoid triggering the rate limiter (we're testing DB lockout, not rate limiting)
        for (let i = 0; i < 5; i++) {
            await request.post(`${BASE_URL}/api/auth/callback/credentials`, {
                form: {
                    email: lockoutEmail,
                    password: 'wrongpassword',
                    csrfToken,
                },
                headers: { 'x-forwarded-for': `10.0.2.${i + 1}` },
            });
        }

        // 6th attempt — CORRECT password via UI → should still fail (account locked)
        await page.goto('/auth/login');
        await page.getByLabel('Email').fill(lockoutEmail);
        await page.getByLabel('Contraseña').fill(correctPassword);
        await page.getByRole('button', { name: /Iniciar Sesión/i }).click();

        // Account is locked → error shown, stays on login page
        await expect(page.getByText('Email o contraseña incorrectos')).toBeVisible({ timeout: 10_000 });
        await expect(page).toHaveURL(/\/auth\/login/);
    });
});

// ─────────────────────────────────────────────────────────────────────
// Rate Limiting (in-memory, per IP)
//
// Strategy: AUTH_LIMIT is relaxed to 100 req/min in test builds so that
// browser-based logins in other test files never hit 429.
//
// This test uses a SEPARATE testLimiter (3 req/min) on a dedicated
// endpoint to verify the rate-limiting MECHANISM works correctly
// (createRateLimiter → check → 429 response). The production AUTH_LIMIT
// value (5 req/min) is verified in unit tests (lib/__tests__/rate-limit.test.ts).
// ─────────────────────────────────────────────────────────────────────
test.describe('Rate Limiting', () => {
    test('rate limiter returns 429 after exceeding request limit', async ({ request }) => {
        // Reset the test limiter first so we start from 0
        await request.post(`${BASE_URL}/api/auth/test-rate-limit`);

        const responses: number[] = [];

        // testLimiter is configured as 3 req/min — send 6 requests
        for (let i = 0; i < 6; i++) {
            const res = await request.get(`${BASE_URL}/api/auth/test-rate-limit`);
            responses.push(res.status());
        }

        // First 3 should succeed (200), remaining should be blocked (429)
        expect(responses.slice(0, 3).every(s => s === 200)).toBe(true);
        expect(responses.slice(3).every(s => s === 429)).toBe(true);
    });
});


