import { test, expect } from '@playwright/test';

/**
 * Homepage / Landing Page Tests
 *
 * Tests basic navigation and homepage functionality
 */

test.describe('Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Should redirect to login or show homepage
    await expect(page).toHaveURL(/\/(login)?/);
  });

  test('should have correct page title', async ({ page }) => {
    await page.goto('/');

    // Check for application title
    await expect(page).toHaveTitle(/Vapour Toolbox|Login/);
  });

  test('should be responsive', async ({ page }) => {
    await page.goto('/');

    // Test viewport changes
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile
    await expect(page.locator('body')).toBeVisible(); // Just verify it renders

    await page.setViewportSize({ width: 1920, height: 1080 }); // Desktop
    await expect(page.locator('body')).toBeVisible(); // Just verify it renders
  });
});
