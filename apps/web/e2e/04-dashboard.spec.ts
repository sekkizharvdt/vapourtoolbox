import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

/**
 * Dashboard Tests
 *
 * Tests dashboard functionality with Firebase Emulator authentication
 */

test.describe('Dashboard', () => {
  test.skip('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL(/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });

  test('should show dashboard after login', async ({ page }) => {
    // Authenticate using custom token
    await loginAsUser(page);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard\/?/);

    // Wait for page to load (client-side rendered)
    await page.waitForLoadState('networkidle');

    // Should show dashboard content
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /available modules/i })).toBeVisible();
  });

  test('should show application module cards', async ({ page }) => {
    // Authenticate using custom token
    await loginAsUser(page);

    await page.goto('/dashboard');

    // Wait for page to load (client-side rendered)
    await page.waitForLoadState('networkidle');

    // Should show APPLICATION module cards (core modules like Entity Management are sidebar-only)
    // Module cards contain headings with module names and "Open Module" buttons
    await expect(page.getByRole('heading', { name: /time tracking/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /document management/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /accounting/i })).toBeVisible();
  });
});
