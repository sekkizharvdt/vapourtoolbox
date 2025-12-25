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

import { test, expect, Page } from '@playwright/test';
import { isTestUserReady, signInForTest } from './auth.helpers';

// Test configuration
const TEST_TIMEOUT = 30000;

/**
 * Helper to navigate to users page and wait for data to load
 */
async function goToUsersPageAndWaitForLoad(page: Page) {
  await page.goto('/admin/users');
  await page.waitForLoadState('domcontentloaded');
  // Wait for page title to be visible
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({
    timeout: TEST_TIMEOUT,
  });
  // Wait for loading to complete - either loading disappears OR table rows appear
  await Promise.race([
    expect(page.getByText('Loading users...')).not.toBeVisible({ timeout: TEST_TIMEOUT }),
    expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: TEST_TIMEOUT }), // First data row (nth(0) is header)
  ]);
  // Small delay to ensure React has finished rendering
  await page.waitForTimeout(500);
}

test.describe('User Management', () => {
  // Sign in before each test
  test.beforeEach(async ({ page }) => {
    const testUserReady = await isTestUserReady();
    if (!testUserReady) {
      test.skip(true, 'Test user not ready - skipping test');
      return;
    }
    const signedIn = await signInForTest(page);
    if (!signedIn) {
      test.skip(true, 'Could not sign in');
    }
  });

  test.describe('Page Navigation', () => {
    test('should navigate to user management page', async ({ page }) => {
      await goToUsersPageAndWaitForLoad(page);

      // Verify page title
      await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
      await expect(page.getByText(/Manage users, permissions, and module access/i)).toBeVisible();
    });

    test('should display page header with action buttons', async ({ page }) => {
      await goToUsersPageAndWaitForLoad(page);

      // Check for action buttons
      await expect(page.getByRole('button', { name: /Permission Matrix/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Invite User/i })).toBeVisible();
    });

    test('should navigate to Permission Matrix page', async ({ page }) => {
      await goToUsersPageAndWaitForLoad(page);

      // Click Permission Matrix button
      await page.getByRole('button', { name: /Permission Matrix/i }).click();

      // Verify navigation
      await expect(page).toHaveURL(/\/admin\/users\/permissions/);
      await expect(page.getByText(/Permission Matrix/i)).toBeVisible({ timeout: TEST_TIMEOUT });
    });
  });

  test.describe('Users Table', () => {
    test('should display users table with columns', async ({ page }) => {
      await goToUsersPageAndWaitForLoad(page);

      // Check for table headers
      await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Department' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Module Access' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
    });

    test('should display current test user in the table', async ({ page }) => {
      await goToUsersPageAndWaitForLoad(page);

      // Look for the test user email (created by auth.setup.ts)
      await expect(page.getByText('e2e-test@vapourdesal.com').first()).toBeVisible();
    });

    test('should display open modules info alert', async ({ page }) => {
      await goToUsersPageAndWaitForLoad(page);

      await expect(page.getByText(/Open to all users:/i)).toBeVisible();
    });
  });

  test.describe('Search and Filtering', () => {
    test('should have search input', async ({ page }) => {
      await goToUsersPageAndWaitForLoad(page);

      const searchInput = page.getByPlaceholder(/Search by name or email/i);
      await expect(searchInput).toBeVisible();
    });

    test('should filter users by search term', async ({ page }) => {
      await goToUsersPageAndWaitForLoad(page);

      const searchInput = page.getByPlaceholder(/Search by name or email/i);

      // Search for test user
      await searchInput.fill('e2e-test');
      await page.waitForTimeout(500); // Wait for filter to apply

      // Test user should still be visible
      await expect(page.getByText('e2e-test@vapourdesal.com').first()).toBeVisible();

      // Clear search
      await searchInput.fill('');
    });

    test('should filter users by status', async ({ page }) => {
      await goToUsersPageAndWaitForLoad(page);

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
        await expect(page.getByRole('row').filter({ hasText: 'Active' }).first()).toBeVisible();
      }
    });
  });

  test.describe('Edit User Dialog', () => {
    test('should open edit dialog when clicking Edit button', async ({ page }) => {
      await goToUsersPageAndWaitForLoad(page);

      // Find the first Edit button (use role button with name to be more specific)
      const editButton = page.getByRole('button', { name: 'Edit User' }).first();

      // Wait for the button to be visible
      await expect(editButton).toBeVisible({ timeout: TEST_TIMEOUT });

      // Click to open dialog
      await editButton.click();

      // Verify dialog opens
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: TEST_TIMEOUT });
      await expect(page.getByRole('heading', { name: 'Edit User' })).toBeVisible();
    });

    test('should display user form fields in edit dialog', async ({ page }) => {
      await goToUsersPageAndWaitForLoad(page);

      // Open edit dialog
      const editButton = page.getByRole('button', { name: 'Edit User' }).first();
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
      await goToUsersPageAndWaitForLoad(page);

      // Open edit dialog
      const editButton = page.getByRole('button', { name: 'Edit User' }).first();
      await editButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Check for permission section headings (use exact role to avoid multiple matches)
      await expect(page.getByRole('heading', { name: 'Permissions', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Admin Permissions' })).toBeVisible();

      // Check for some permission checkboxes (use exact match to avoid subtitle collision)
      await expect(page.getByText('View Projects')).toBeVisible();
      await expect(page.getByText('Manage Projects')).toBeVisible();
      await expect(page.getByText('Manage Users', { exact: true })).toBeVisible();

      // Close dialog
      await page.getByRole('button', { name: /Cancel/i }).click();
    });

    test('should display quick action buttons in edit dialog', async ({ page }) => {
      await goToUsersPageAndWaitForLoad(page);

      // Open edit dialog
      const editButton = page.getByRole('button', { name: 'Edit User' }).first();
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
      await goToUsersPageAndWaitForLoad(page);

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
      await goToUsersPageAndWaitForLoad(page);

      await expect(page.getByText('Legend:')).toBeVisible();
      // Use locators that match the chip text in the legend section
      const legendSection = page.locator('text=Legend:').locator('..');
      await expect(legendSection.getByText('Manage')).toBeVisible();
      await expect(legendSection.getByText('View Only')).toBeVisible();
    });
  });

  test.describe('Pagination', () => {
    test('should display pagination controls', async ({ page }) => {
      await goToUsersPageAndWaitForLoad(page);

      // Check for pagination
      const pagination = page
        .locator('[aria-label="rows per page"]')
        .or(page.getByText(/Rows per page/i));

      await expect(pagination.first()).toBeVisible({ timeout: TEST_TIMEOUT });
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible table structure', async ({ page }) => {
      await goToUsersPageAndWaitForLoad(page);

      // Check for table role
      await expect(page.getByRole('table')).toBeVisible();

      // Check for row groups
      await expect(page.locator('thead')).toBeVisible();
      await expect(page.locator('tbody')).toBeVisible();
    });

    test('should have accessible dialog when opened', async ({ page }) => {
      await goToUsersPageAndWaitForLoad(page);

      // Open edit dialog
      const editButton = page.getByRole('button', { name: 'Edit User' }).first();
      await editButton.click();

      // Dialog should have proper role
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: TEST_TIMEOUT });

      // Dialog should have title
      await expect(page.getByRole('heading', { name: 'Edit User' })).toBeVisible();

      // Close dialog
      await page.getByRole('button', { name: /Cancel/i }).click();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle unauthorized access gracefully', async ({ page }) => {
      // Use the helper to properly wait for page load
      await goToUsersPageAndWaitForLoad(page);

      // Note: This test verifies the page doesn't crash when accessed
      // The actual authorization is handled by the admin layout
      // Page should not show error state if user has permission
      // If user doesn't have permission, should redirect or show unauthorized
      const hasUserManagement = await page
        .getByRole('heading', { name: 'User Management' })
        .isVisible()
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
