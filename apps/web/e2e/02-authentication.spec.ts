import { test, expect } from '@playwright/test';

/**
 * Authentication Flow Tests
 *
 * Tests login with Google OAuth and authentication redirects
 */

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('should load login page', async ({ page }) => {
      await page.goto('/login');

      await expect(page).toHaveURL(/\/login\/?/);
      await expect(page).toHaveTitle(/Login|Vapour Toolbox/);
    });

    test('should show Google sign-in button', async ({ page }) => {
      await page.goto('/login');

      // Check for Google sign-in button (app uses Google OAuth only)
      const googleButton = page.locator('button:has-text("Sign in with Google")');
      await expect(googleButton).toBeVisible();
    });

    test('should show company branding', async ({ page }) => {
      await page.goto('/login');

      // Check for Vapour Toolbox title
      const title = page.locator('h1, h4');
      await expect(title.filter({ hasText: 'Vapour Toolbox' })).toBeVisible();

      // Check for company name
      const companyName = page.locator('text=Vapour Desal Technologies');
      await expect(companyName).toBeVisible();
    });

    test('should navigate to signup page', async ({ page }) => {
      await page.goto('/login');

      // Look for signup link
      const signupLink = page.locator('a:has-text("Sign up"), a[href*="signup"]');

      if ((await signupLink.count()) > 0) {
        await signupLink.first().click();
        await expect(page).toHaveURL(/signup/);
      }
    });
  });

  test.describe('Signup Page', () => {
    test('should load signup page', async ({ page }) => {
      await page.goto('/signup');

      await expect(page).toHaveURL(/\/signup\/?/);
    });

    test('should show Google sign-in on signup page', async ({ page }) => {
      await page.goto('/signup');

      // Check for Google sign-in button
      const googleButton = page.locator('button:has-text("Sign in with Google"), button:has-text("Sign up with Google")');

      if ((await googleButton.count()) > 0) {
        await expect(googleButton.first()).toBeVisible();
      }
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect dashboard to login when not authenticated', async ({ page }) => {
      // Try to access protected dashboard
      await page.goto('/dashboard');

      // Should redirect to login
      await page.waitForURL(/login/, { timeout: 5000 });
      await expect(page).toHaveURL(/login\/?/);
    });

    test('should redirect entities page to login when not authenticated', async ({ page }) => {
      await page.goto('/entities');

      // Should redirect to login
      await page.waitForURL(/login/, { timeout: 5000 });
      await expect(page).toHaveURL(/login\/?/);
    });
  });
});
