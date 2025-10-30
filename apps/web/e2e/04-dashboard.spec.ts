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

    // Should show dashboard content
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /available modules/i })).toBeVisible();
  });

  test('should show navigation menu', async ({ page }) => {
    // Authenticate using custom token
    await loginAsUser(page);

    await page.goto('/dashboard');

    // Should show sidebar navigation (Material-UI Drawer, not <nav>)
    // Check for module navigation buttons
    await expect(page.getByRole('button', { name: /entity management/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /project management/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /user management/i })).toBeVisible();
  });
});
