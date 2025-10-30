import { test, expect } from '@playwright/test';

/**
 * Navigation Tests
 *
 * Tests application navigation, menus, and routing
 */

test.describe('Navigation', () => {
  test('should show unauthorized page for unauthorized access', async ({ page }) => {
    await page.goto('/unauthorized');

    await expect(page).toHaveURL(/\/unauthorized\/?/);

    // Should show unauthorized message
    const heading = page.locator('h1, h2').first();
    const text = await heading.textContent();

    expect(text?.toLowerCase()).toContain('unauthorized');
  });

  test('should show pending approval page', async ({ page }) => {
    await page.goto('/pending-approval');

    await expect(page).toHaveURL(/\/pending-approval\/?/);

    // Should show pending message
    const content = await page.textContent('body');
    expect(content?.toLowerCase()).toMatch(/pending|approval|waiting/);
  });

  test('should navigate between public routes', async ({ page }) => {
    // Start at login
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login\/?/);

    // Navigate to signup if link exists
    const signupLink = page.locator('a[href*="signup"]');
    if ((await signupLink.count()) > 0) {
      await signupLink.first().click();
      await expect(page).toHaveURL(/signup/);

      // Navigate back to login
      const loginLink = page.locator('a[href*="login"]');
      if ((await loginLink.count()) > 0) {
        await loginLink.first().click();
        await expect(page).toHaveURL(/login/);
      }
    }
  });

  test('should have proper meta tags for SEO', async ({ page }) => {
    await page.goto('/login');

    // Check for viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');

    // Check for description meta tag (if exists)
    const description = page.locator('meta[name="description"]');
    if ((await description.count()) > 0) {
      const content = await description.getAttribute('content');
      expect(content).toBeTruthy();
    }
  });
});
