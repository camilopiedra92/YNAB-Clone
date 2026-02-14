import { test, expect } from '@playwright/test';
import { gotoBudgetPage } from './e2e-helpers';
import { t } from './i18n-helpers';

/**
 * Profile E2E Tests
 *
 * Validates the user profile feature:
 * - Settings button opens ProfileModal
 * - Profile displays user info (name, email, member since)
 * - Name update reflects in sidebar immediately
 * - Password change with wrong password shows error
 *
 * Uses shared auth storageState (authenticated as TEST_USER).
 * All selectors use data-testid for locale independence.
 */

test.describe('User Profile', () => {
    test('settings button opens profile modal with user info', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        // Click the settings button
        const settingsBtn = page.getByTestId('sidebar-settings');
        await expect(settingsBtn).toBeVisible({ timeout: 10_000 });
        await settingsBtn.click();

        // Profile modal should appear with translated title
        await expect(page.getByText(t('profile.title'))).toBeVisible({ timeout: 5_000 });

        // Should show personal info section
        await expect(page.getByText(t('profile.personalInfo'))).toBeVisible();

        // Should show change password section (use .first() — text appears in both heading and button)
        await expect(page.getByText(t('profile.changePassword')).first()).toBeVisible();

        // Name input should be pre-filled (wait for async profile data to load)
        const nameInput = page.getByTestId('profile-name-input');
        await expect(nameInput).toBeVisible();
        await expect(nameInput).not.toHaveValue('', { timeout: 10_000 });

        // Email input should be pre-filled
        const emailInput = page.getByTestId('profile-email-input');
        await expect(emailInput).toBeVisible();
        await expect(emailInput).not.toHaveValue('');

        // Member since date should be visible
        await expect(page.getByText(new RegExp(t('profile.memberSince')))).toBeVisible();
    });

    test('profile modal closes on Escape key', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        // Open profile modal
        await page.getByTestId('sidebar-settings').click();
        await expect(page.getByText(t('profile.title'))).toBeVisible({ timeout: 5_000 });

        // Press Escape
        await page.keyboard.press('Escape');

        // Modal should be gone
        await expect(page.getByText(t('profile.title'))).not.toBeVisible({ timeout: 3_000 });
    });

    test('update name shows success toast and updates sidebar', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        // Open profile modal
        await page.getByTestId('sidebar-settings').click();
        await expect(page.getByText(t('profile.title'))).toBeVisible({ timeout: 5_000 });

        // Wait for profile data to load, then get current name
        const nameInput = page.getByTestId('profile-name-input');
        await expect(nameInput).not.toHaveValue('', { timeout: 10_000 });
        const originalName = await nameInput.inputValue();

        // Change name to something unique
        const newName = `Test ${Date.now().toString().slice(-4)}`;
        await nameInput.clear();
        await nameInput.fill(newName);

        // Click save
        await page.getByRole('button', { name: new RegExp(t('profile.saveProfile'), 'i') }).click();

        // Should show success toast
        await expect(page.getByText(t('toasts.profileUpdateSuccess'))).toBeVisible({ timeout: 5_000 });

        // Close modal
        await page.keyboard.press('Escape');

        // Restore original name
        await page.getByTestId('sidebar-settings').click();
        await expect(page.getByText(t('profile.title'))).toBeVisible({ timeout: 5_000 });
        const nameInputAgain = page.getByTestId('profile-name-input');
        await nameInputAgain.clear();
        await nameInputAgain.fill(originalName);
        await page.getByRole('button', { name: new RegExp(t('profile.saveProfile'), 'i') }).click();
        await expect(page.getByText(t('toasts.profileUpdateSuccess'))).toBeVisible({ timeout: 5_000 });
    });

    test('wrong current password shows error', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        // Open profile modal
        await page.getByTestId('sidebar-settings').click();
        await expect(page.getByText(t('profile.title'))).toBeVisible({ timeout: 5_000 });

        // Fill password fields
        await page.getByTestId('profile-current-password-input').fill('wrongpassword');
        await page.getByTestId('profile-new-password-input').fill('newpassword123');
        await page.getByTestId('profile-confirm-password-input').fill('newpassword123');

        // Click change password
        await page.getByRole('button', { name: new RegExp(t('profile.changePassword'), 'i') }).click();

        // Should show error (either inline or via toast — use .first() to avoid strict mode)
        await expect(page.getByText(t('toasts.passwordChangeError')).first()).toBeVisible({ timeout: 5_000 });
    });

    test('password mismatch shows client-side validation error', async ({ page, request }) => {
        await gotoBudgetPage(page, request);

        // Open profile modal
        await page.getByTestId('sidebar-settings').click();
        await expect(page.getByText(t('profile.title'))).toBeVisible({ timeout: 5_000 });

        // Fill password fields with mismatched passwords
        await page.getByTestId('profile-current-password-input').fill('currentpassword');
        await page.getByTestId('profile-new-password-input').fill('newpassword123');
        await page.getByTestId('profile-confirm-password-input').fill('different456');

        // Click change password
        await page.getByRole('button', { name: new RegExp(t('profile.changePassword'), 'i') }).click();

        // Should show mismatch error
        await expect(page.getByText(t('profile.passwordMismatch'))).toBeVisible({ timeout: 3_000 });
    });
});
