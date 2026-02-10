/**
 * Auth Setup — Playwright authentication fixture.
 *
 * Logs in as the test user and saves the browser session state
 * so all subsequent E2E specs run as authenticated.
 */
import { test as setup, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import { TEST_USER } from './test-constants';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, '..', '.auth', 'user.json');

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/auth/login');

  // Fill in credentials
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Contraseña').fill(TEST_USER.password);

  // Submit
  await page.getByRole('button', { name: /Iniciar Sesión/i }).click();

  // Wait for redirect to budget page (successful login)
  await expect(page).toHaveURL(/\/budget/, { timeout: 15_000 });

  // Save auth state for reuse in all tests
  await page.context().storageState({ path: AUTH_FILE });
});
