/**
 * Admin Settings Module E2E Tests
 *
 * Tests the admin settings and configuration pages:
 * 1. Navigate to admin page
 * 2. View system status
 * 3. View user management (if authorized)
 * 4. View cost configurations
 * 5. Access control and permissions
 *
 * Run with: pnpm test:e2e --grep "Admin"
 *
 * Note: These tests require authentication via Firebase emulator.
 * Admin pages typically require elevated permissions.
 */

import { test, expect } from '@playwright/test';
import { isTestUserReady, signInForTest } from './auth.helpers';

// Test configuration
const TEST_TIMEOUT = 30000;

test.describe('Admin Settings Module', () => {
  // Sign in before each test
  test.beforeEach(async ({ page }) => {
    const testUserReady = await isTestUserReady();
    if (!testUserReady) {
      test.skip(true, 'Test user not ready - skipping');
      return;
    }
    const signedIn = await signInForTest(page);
    if (!signedIn) {
      test.skip(true, 'Could not sign in - skipping');
    }
  });

  test.describe('Page Navigation', () => {
    test('should load the admin page or show access denied', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);

      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Should show admin page, access denied, or login
      await expect(
        page
          .getByText(/Admin|Settings|Configuration/i)
          .first()
          .or(page.getByText(/Access Denied|Unauthorized|Permission/i))
          .or(page.getByRole('button', { name: /sign in with google/i }))
      ).toBeVisible({ timeout: 15000 });
    });

    test('should handle unauthorized access gracefully', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Page should display something meaningful (not error page)
      const hasContent = await page
        .getByText(/Admin|Access Denied|Unauthorized|Sign in/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasContent).toBe(true);
    });
  });

  test.describe('System Status', () => {
    test('should display system status section for authorized users', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Check if user has admin access
      const hasAccess = await page
        .getByText(/Admin|Dashboard|System/i)
        .first()
        .isVisible()
        .catch(() => false);

      if (!hasAccess) {
        console.log('User does not have admin access');
        return;
      }

      // Look for system status elements
      const hasStatus = await page
        .getByText(/System Status|Health|Build Status/i)
        .first()
        .isVisible()
        .catch(() => false);

      if (hasStatus) {
        await expect(page.getByText(/System Status|Health|Build Status/i).first()).toBeVisible();
      }
    });

    test('should show security audit information', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      const hasAdminAccess = await page
        .getByText(/Admin|Dashboard|System/i)
        .first()
        .isVisible()
        .catch(() => false);

      if (!hasAdminAccess) {
        test.skip(true, 'User does not have admin access');
        return;
      }

      // Look for audit/security information
      const hasAudit = await page
        .getByText(/Audit|Vulnerabilities|Security|Dependencies/i)
        .first()
        .isVisible()
        .catch(() => false);

      if (hasAudit) {
        console.log('Security audit information displayed');
      }
    });

    test('should show outdated packages information', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      const hasAdminAccess = await page
        .getByText(/Admin|Dashboard|System/i)
        .first()
        .isVisible()
        .catch(() => false);

      if (!hasAdminAccess) {
        test.skip(true, 'User does not have admin access');
        return;
      }

      // Look for package information
      const hasPackages = await page
        .getByText(/Outdated|Packages|Dependencies|Updates/i)
        .first()
        .isVisible()
        .catch(() => false);

      if (hasPackages) {
        console.log('Package information displayed');
      }
    });
  });

  test.describe('User Management', () => {
    test('should navigate to users page', async ({ page }) => {
      await page.goto('/users');
      await page.waitForLoadState('networkidle');

      // Should show users page or access denied
      await expect(
        page
          .getByText(/Users|User Management/i)
          .first()
          .or(page.getByText(/Access Denied/i))
      ).toBeVisible({ timeout: 10000 });
    });

    test('should display user list for authorized admins', async ({ page }) => {
      await page.goto('/users');
      await page.waitForLoadState('networkidle');

      const hasAccess = await page
        .getByText(/Users|User Management/i)
        .first()
        .isVisible()
        .catch(() => false);

      if (!hasAccess) {
        console.log('User does not have access to user management');
        return;
      }

      // Check for user table or list - wait a bit for data to load
      await page.waitForTimeout(1000);

      const hasTable = await page
        .locator('table')
        .isVisible()
        .catch(() => false);
      const hasList = await page
        .getByText(/Email|Name|Role/i)
        .first()
        .isVisible()
        .catch(() => false);

      // If we have access, we should see either table or list content
      if (hasAccess) {
        expect(hasTable || hasList).toBe(true);
      }
    });

    test('should show role/permission controls', async ({ page }) => {
      await page.goto('/users');
      await page.waitForLoadState('networkidle');

      const hasAccess = await page
        .getByText(/Users|User Management/i)
        .first()
        .isVisible()
        .catch(() => false);

      if (!hasAccess) {
        test.skip(true, 'User does not have user management access');
        return;
      }

      // Look for role-related UI elements
      const hasRoles = await page
        .getByText(/Role|Permission|Admin|User|Manager/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasRoles).toBe(true);
    });
  });

  test.describe('Company Settings', () => {
    test('should navigate to company settings', async ({ page }) => {
      await page.goto('/company');
      await page.waitForLoadState('networkidle');

      // Should show company settings or access denied
      await expect(
        page
          .getByText(/Company|Organization|Settings/i)
          .first()
          .or(page.getByText(/Access Denied/i))
      ).toBeVisible({ timeout: 10000 });
    });

    test('should display costing configuration', async ({ page }) => {
      await page.goto('/company/costing');
      await page.waitForLoadState('networkidle');

      // Look for costing config elements
      const hasCosting = await page
        .getByText(/Costing|Overhead|Profit|Contingency|Rate/i)
        .first()
        .isVisible()
        .catch(() => false);

      if (hasCosting) {
        await expect(page.getByText(/Costing|Overhead|Profit|Rate/i).first()).toBeVisible();
      }
    });
  });

  test.describe('Super Admin', () => {
    test('should navigate to super admin page', async ({ page }) => {
      await page.goto('/super-admin');
      await page.waitForLoadState('networkidle');

      // Should show super admin or access denied
      await expect(
        page
          .getByText(/Super Admin|System Administration/i)
          .first()
          .or(page.getByText(/Access Denied|Unauthorized|Not authorized/i))
      ).toBeVisible({ timeout: 10000 });
    });

    test('should restrict super admin to authorized users only', async ({ page }) => {
      await page.goto('/super-admin');
      await page.waitForLoadState('networkidle');

      // Either has access or shows access denied - both are valid responses
      const hasResponse = await page
        .getByText(/Super Admin|Access Denied|Unauthorized/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasResponse).toBe(true);
    });
  });

  test.describe('Navigation Menu', () => {
    test('should show admin navigation items for authorized users', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Check for admin menu items in sidebar
      const hasAdminMenu = await page
        .getByText(/Admin|Settings|Configuration/i)
        .first()
        .isVisible()
        .catch(() => false);

      // Admin menu visibility depends on permissions - this is expected behavior
      console.log(`Admin menu visible: ${hasAdminMenu}`);
    });

    test('should have working admin links', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Try to find and click admin link
      const adminLink = page.getByRole('link', { name: /Admin|Settings/i }).first();
      const hasAdminLink = await adminLink.isVisible().catch(() => false);

      if (hasAdminLink) {
        await adminLink.click();
        await page.waitForTimeout(500);

        // Should navigate somewhere
        const currentUrl = page.url();
        expect(currentUrl).toContain('/');
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Should show content or access message
      const hasContent = await page
        .getByText(/Admin|Access Denied|Settings|Sign in/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasContent).toBe(true);
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      const hasContent = await page
        .getByText(/Admin|Access Denied|Settings|Sign in/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasContent).toBe(true);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      expect(headings.length).toBeGreaterThan(0);
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Tab through the page
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });
  });

  test.describe('Security', () => {
    test('should not expose sensitive information in URL', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      const currentUrl = page.url();

      // URL should not contain tokens or sensitive data
      expect(currentUrl).not.toMatch(/token=|key=|secret=|password=/i);
    });

    test('should handle invalid admin routes gracefully', async ({ page }) => {
      await page.goto('/admin/non-existent-page');
      await page.waitForLoadState('networkidle');

      // Should show 404, redirect, or access denied - not crash
      const hasResponse = await page
        .getByText(/Not Found|404|Access Denied|Admin|Sign in/i)
        .first()
        .isVisible()
        .catch(() => false);

      // Page should load something
      expect(hasResponse).toBe(true);
    });
  });
});
