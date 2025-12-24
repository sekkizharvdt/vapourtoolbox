/**
 * User Management E2E Tests
 *
 * Tests the complete user management journey:
 * 1. Navigate to admin/users page
 * 2. View users table
 * 3. Filter and search users
 * 4. View pending users section
 * 5. Edit user dialog
 * 6. Approve user dialog
 * 7. Permission matrix page
 *
 * Run with: pnpm test:e2e --grep "User Management"
 *
 * Note: These tests require authentication via Firebase emulator.
 * The auth.setup.ts must run first to create the test user.
 * The test user must have MANAGE_USERS permission.
 */

import { test, expect } from '@playwright/test';
import { isTestUserReady } from './auth.helpers';

// Test configuration
const TEST_TIMEOUT = 30000;

test.describe('User Management', () => {
  // Check if test user is ready before each test
  test.beforeEach(async () => {
    const testUserReady = await isTestUserReady();
    if (!testUserReady) {
      test.skip(true, 'Test user not ready - skipping test');
    }
  });

  test.describe('Page Navigation', () => {
    test('should navigate to user management page', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      // Verify page title
      await expect(page.getByText('User Management')).toBeVisible({ timeout: TEST_TIMEOUT });
      await expect(page.getByText(/Manage users, permissions, and module access/i)).toBeVisible();
    });

    test('should display page header with action buttons', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      // Check for action buttons
      await expect(page.getByRole('button', { name: /Permission Matrix/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Invite User/i })).toBeVisible();
    });

    test('should navigate to Permission Matrix page', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      // Click Permission Matrix button
      await page.getByRole('button', { name: /Permission Matrix/i }).click();

      // Verify navigation
      await expect(page).toHaveURL(/\/admin\/users\/permissions/);
      await expect(page.getByText(/Permission Matrix/i)).toBeVisible({ timeout: TEST_TIMEOUT });

      // Navigate back
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');
    });
  });

  test.describe('Users Table', () => {
    test('should display users table with columns', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      // Check for table headers
      await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Department' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Module Access' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
    });

    test('should display current test user in the table', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      // Look for the test user email (created by auth.setup.ts)
      await expect(page.getByText('e2e-test@vapourdesal.com')).toBeVisible({
        timeout: TEST_TIMEOUT,
      });
    });

    test('should display open modules info alert', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByText(/Open to all users:/i)).toBeVisible();
    });
  });

  test.describe('Search and Filtering', () => {
    test('should have search input', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      const searchInput = page.getByPlaceholder(/Search by name or email/i);
      await expect(searchInput).toBeVisible();
    });

    test('should filter users by search term', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      const searchInput = page.getByPlaceholder(/Search by name or email/i);

      // Search for test user
      await searchInput.fill('e2e-test');
      await page.waitForTimeout(500); // Wait for filter to apply

      // Test user should still be visible
      await expect(page.getByText('e2e-test@vapourdesal.com')).toBeVisible();

      // Clear search
      await searchInput.fill('');
    });

    test('should filter users by status', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      // Find status filter
      const statusFilter = page
        .getByRole('combobox', { name: /Status/i })
        .or(page.locator('[aria-label="Status"]'))
        .or(page.locator('label:has-text("Status") + div select'));

      // If status filter exists, test it
      const filterVisible = await statusFilter
        .first()
        .isVisible()
        .catch(() => false);
      if (filterVisible) {
        await statusFilter.first().click();
        await page.getByRole('option', { name: 'Active' }).click();

        // Wait for filter to apply
        await page.waitForTimeout(500);

        // Status column should show Active chips
        await expect(page.getByRole('row').filter({ hasText: 'Active' })).toBeVisible();
      }
    });
  });

  test.describe('Edit User Dialog', () => {
    test('should open edit dialog when clicking Edit button', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      // Find the first Edit button
      const editButton = page
        .getByRole('button', { name: /Edit/i })
        .first()
        .or(page.getByLabel(/Edit User/i).first());

      // Wait for the button to be visible
      await expect(editButton).toBeVisible({ timeout: TEST_TIMEOUT });

      // Click to open dialog
      await editButton.click();

      // Verify dialog opens
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: TEST_TIMEOUT });
      await expect(page.getByText('Edit User')).toBeVisible();
    });

    test('should display user form fields in edit dialog', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      // Open edit dialog
      const editButton = page
        .getByRole('button', { name: /Edit/i })
        .first()
        .or(page.getByLabel(/Edit User/i).first());
      await editButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Check for form fields
      await expect(page.getByLabel(/Display Name/i)).toBeVisible();
      await expect(page.getByLabel(/Email/i)).toBeVisible();

      // Email should be disabled
      await expect(page.getByLabel(/Email/i)).toBeDisabled();

      // Close dialog
      await page.getByRole('button', { name: /Cancel/i }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should display permission checkboxes in edit dialog', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      // Open edit dialog
      const editButton = page
        .getByRole('button', { name: /Edit/i })
        .first()
        .or(page.getByLabel(/Edit User/i).first());
      await editButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Check for permission section
      await expect(page.getByText('Permissions')).toBeVisible();
      await expect(page.getByText('Admin Permissions')).toBeVisible();

      // Check for some permission checkboxes
      await expect(page.getByText('View Projects')).toBeVisible();
      await expect(page.getByText('Manage Projects')).toBeVisible();
      await expect(page.getByText('Manage Users')).toBeVisible();

      // Close dialog
      await page.getByRole('button', { name: /Cancel/i }).click();
    });

    test('should display quick action buttons in edit dialog', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      // Open edit dialog
      const editButton = page
        .getByRole('button', { name: /Edit/i })
        .first()
        .or(page.getByLabel(/Edit User/i).first());
      await editButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Check for quick action buttons
      await expect(page.getByRole('button', { name: /Select All/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Clear$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Full Access/i }).first()).toBeVisible();

      // Close dialog
      await page.getByRole('button', { name: /Cancel/i }).click();
    });
  });

  test.describe('Module Access Display', () => {
    test('should display module access chips for users', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      // Check for Full Access chip (test user has full permissions)
      // or module access chips
      const fullAccessChip = page.getByText('Full Access').first();
      const noAccessChip = page.getByText('No module access').first();

      // One of these should be visible
      const hasAccess = await fullAccessChip.isVisible().catch(() => false);
      const hasNoAccess = await noAccessChip.isVisible().catch(() => false);

      expect(hasAccess || hasNoAccess).toBeTruthy();
    });

    test('should display legend for module access chips', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByText('Legend:')).toBeVisible();
      await expect(page.getByText('Manage')).toBeVisible();
      await expect(page.getByText('View Only')).toBeVisible();
    });
  });

  test.describe('Pagination', () => {
    test('should display pagination controls', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      // Check for pagination
      const pagination = page
        .locator('[aria-label="rows per page"]')
        .or(page.getByText(/Rows per page/i));

      await expect(pagination.first()).toBeVisible({ timeout: TEST_TIMEOUT });
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible table structure', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      // Check for table role
      await expect(page.getByRole('table')).toBeVisible();

      // Check for row groups
      await expect(page.locator('thead')).toBeVisible();
      await expect(page.locator('tbody')).toBeVisible();
    });

    test('should have accessible dialog when opened', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      // Open edit dialog
      const editButton = page
        .getByRole('button', { name: /Edit/i })
        .first()
        .or(page.getByLabel(/Edit User/i).first());
      await editButton.click();

      // Dialog should have proper role
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: TEST_TIMEOUT });

      // Dialog should have title
      await expect(page.getByText('Edit User')).toBeVisible();

      // Close dialog
      await page.getByRole('button', { name: /Cancel/i }).click();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle unauthorized access gracefully', async ({ page }) => {
      await page.goto('/admin/users');
      await page.waitForLoadState('domcontentloaded');

      // Note: This test verifies the page doesn't crash when accessed
      // The actual authorization is handled by the admin layout
      // Page should not show error state if user has permission
      // If user doesn't have permission, should redirect or show unauthorized
      const hasUserManagement = await page
        .getByText('User Management')
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      const hasUnauthorized = await page
        .getByText(/unauthorized|access denied/i)
        .isVisible()
        .catch(() => false);

      // One of these should be true
      expect(hasUserManagement || hasUnauthorized).toBeTruthy();
    });
  });
});
