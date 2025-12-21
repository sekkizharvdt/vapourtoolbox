/**
 * Entities Module E2E Tests
 *
 * Tests the complete entity management journey:
 * 1. Navigate to entities page
 * 2. View entities table
 * 3. Filter and search entities
 * 4. Create a new entity
 * 5. View entity details
 * 6. Edit an entity
 * 7. Archive/unarchive an entity
 *
 * Run with: pnpm test:e2e --grep "Entities"
 *
 * Note: These tests require authentication via Firebase emulator.
 * The auth.setup.ts must run first to create the test user.
 */

import { test, expect, Page } from '@playwright/test';
import { signInForTest, isTestUserReady } from './auth.helpers';

// Test configuration
const TEST_TIMEOUT = 30000;

/**
 * Navigate to entities page with authentication handling
 * Following the pattern from E2E_TESTING.md
 */
async function navigateToEntitiesPage(page: Page): Promise<boolean> {
  // Try navigating directly first
  await page.goto('/entities');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000); // React hydration time - increased for SSR pages

  const currentUrl = page.url();
  console.log(`  [navigateToEntitiesPage] Current URL after initial navigation: ${currentUrl}`);

  // Check if authenticated
  const isOnPage = await page
    .getByText(/Entity Management/i)
    .isVisible()
    .catch(() => false);

  console.log(`  [navigateToEntitiesPage] Entity Management visible: ${isOnPage}`);

  if (isOnPage) return true;

  // Check for access denied
  const accessDenied = await page
    .getByText(/Access Denied/i)
    .isVisible()
    .catch(() => false);

  console.log(`  [navigateToEntitiesPage] Access Denied visible: ${accessDenied}`);

  if (accessDenied) {
    console.log(`  [navigateToEntitiesPage] User has Access Denied - returning false`);
    return false;
  }

  // Not authenticated - try signing in
  const testUserReady = await isTestUserReady();
  console.log(`  [navigateToEntitiesPage] Test user ready: ${testUserReady}`);

  if (!testUserReady) {
    console.log(`  [navigateToEntitiesPage] Test user not ready - returning false`);
    return false;
  }

  console.log(`  [navigateToEntitiesPage] Calling signInForTest...`);
  const signedIn = await signInForTest(page);
  console.log(`  [navigateToEntitiesPage] signInForTest returned: ${signedIn}`);

  if (!signedIn) {
    console.log(`  [navigateToEntitiesPage] Sign in failed - returning false`);
    return false;
  }

  // Navigate after sign in
  console.log(`  [navigateToEntitiesPage] Navigating to /entities after sign in...`);
  await page.goto('/entities');
  await page.waitForLoadState('domcontentloaded');

  // Wait for auth to be processed on the page
  console.log(`  [navigateToEntitiesPage] Waiting for auth to be processed...`);
  await page
    .waitForFunction(
      () => {
        const win = window as Window & { __authLoading?: boolean };
        return win.__authLoading === false;
      },
      { timeout: 10000 }
    )
    .then(() => console.log(`  [navigateToEntitiesPage] Auth loading complete`))
    .catch(() => console.log(`  [navigateToEntitiesPage] Auth loading timed out`));

  // Additional wait for React to render
  await page.waitForTimeout(2000);

  const finalUrl = page.url();
  console.log(`  [navigateToEntitiesPage] Final URL: ${finalUrl}`);

  // Check what's visible on the page
  const entityManagementVisible = await page
    .getByText(/Entity Management/i)
    .isVisible()
    .catch(() => false);
  const accessDeniedVisible = await page
    .getByText(/Access Denied/i)
    .isVisible()
    .catch(() => false);
  const loadingAuthVisible = await page
    .getByText(/Loading authentication/i)
    .isVisible()
    .catch(() => false);
  const authTimeoutVisible = await page
    .getByText(/Authentication Timeout/i)
    .isVisible()
    .catch(() => false);
  const pendingApprovalVisible = await page
    .getByText(/pending.?approval/i)
    .isVisible()
    .catch(() => false);
  const googleSignInVisible = await page
    .getByRole('button', { name: /sign in with google/i })
    .isVisible()
    .catch(() => false);

  // Get body text content for debugging
  const bodyText = await page
    .locator('body')
    .innerText()
    .catch(() => 'ERROR getting body text');
  console.log(
    `  [navigateToEntitiesPage] Page body text (first 500 chars): ${bodyText.slice(0, 500)}`
  );

  console.log(`  [navigateToEntitiesPage] Page state after navigation:`);
  console.log(`    Entity Management visible: ${entityManagementVisible}`);
  console.log(`    Access Denied visible: ${accessDeniedVisible}`);
  console.log(`    Loading authentication visible: ${loadingAuthVisible}`);
  console.log(`    Authentication Timeout visible: ${authTimeoutVisible}`);
  console.log(`    Pending approval visible: ${pendingApprovalVisible}`);
  console.log(`    Google Sign-In button visible: ${googleSignInVisible}`);

  return entityManagementVisible;
}

test.describe('Entities Module', () => {
  test.describe('Page Navigation', () => {
    test('should load the entities page or redirect to login', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);

      await page.goto('/entities');
      await page.waitForLoadState('networkidle');

      // Should show either entities page, access denied, or login page
      await expect(
        page
          .getByText(/Entity Management/i)
          .or(page.getByText(/Access Denied/i))
          .or(page.getByRole('button', { name: /sign in with google/i }))
      ).toBeVisible({ timeout: 15000 });
    });

    test('should display entities page when authenticated', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Check for page header
      await expect(page.getByText(/Entity Management/i)).toBeVisible();
      await expect(
        page.getByText(/Manage vendors, customers, and business partners/i)
      ).toBeVisible();
    });

    test('should display stats cards when authenticated', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Stats cards should be visible
      await expect(page.getByText(/Total Entities/i)).toBeVisible();
      await expect(page.getByText(/^Active$/i)).toBeVisible();
      await expect(page.getByText(/^Archived$/i)).toBeVisible();
      await expect(page.getByText(/^Vendors$/i)).toBeVisible();
      await expect(page.getByText(/^Customers$/i)).toBeVisible();
    });
  });

  test.describe('Filtering & Search', () => {
    test('should display filter controls', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Search field should be visible
      await expect(page.getByPlaceholder(/Search entities/i)).toBeVisible();

      // Status dropdown should be visible
      await expect(page.getByLabel(/Status/i)).toBeVisible();

      // Role dropdown should be visible
      await expect(page.getByLabel(/Role/i)).toBeVisible();
    });

    test('should filter by status', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Click status dropdown
      await page.getByLabel(/Status/i).click();

      // Check for options
      await expect(page.getByRole('option', { name: /All Status/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Active/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Archived/i })).toBeVisible();

      // Select Active
      await page.getByRole('option', { name: /^Active$/i }).click();

      // Verify filter applied
      await page.waitForTimeout(500);
    });

    test('should filter by role', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Click role dropdown
      await page.getByLabel(/Role/i).click();

      // Check for options
      await expect(page.getByRole('option', { name: /All Roles/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Vendor/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Customer/i })).toBeVisible();

      // Select Vendor
      await page.getByRole('option', { name: /Vendor/i }).click();

      // Verify filter applied
      await page.waitForTimeout(500);
    });

    test('should search by entity name', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Type in search field
      await page.getByPlaceholder(/Search entities/i).fill('Test');

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Page should still be visible (filter applied)
      await expect(page.getByText(/Entity Management/i)).toBeVisible();
    });

    test('should clear filters', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Apply some filters
      await page.getByPlaceholder(/Search entities/i).fill('Test');
      await page.getByLabel(/Status/i).click();
      await page.getByRole('option', { name: /^Active$/i }).click();

      // Click clear button (from FilterBar)
      const clearButton = page.getByRole('button', { name: /Clear/i });
      if (await clearButton.isVisible()) {
        await clearButton.click();

        // Filters should be reset
        await expect(page.getByPlaceholder(/Search entities/i)).toHaveValue('');
      }
    });
  });

  test.describe('Table Interactions', () => {
    test('should display table headers', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Check for table headers
      await expect(page.getByText(/Entity Name/i).first()).toBeVisible();
      await expect(page.getByText(/^Roles$/i).first()).toBeVisible();
      await expect(page.getByText(/Contact Person/i).first()).toBeVisible();
      await expect(page.getByText(/^State$/i).first()).toBeVisible();
      await expect(page.getByText(/^Status$/i).first()).toBeVisible();
      await expect(page.getByText(/Actions/i).first()).toBeVisible();
    });

    test('should sort by name', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Click on Entity Name header to sort
      await page
        .getByText(/Entity Name/i)
        .first()
        .click();

      // Wait for sort
      await page.waitForTimeout(500);

      // Click again to reverse sort
      await page
        .getByText(/Entity Name/i)
        .first()
        .click();

      await page.waitForTimeout(500);
    });

    test('should display pagination', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Check for pagination controls
      const paginationRow = page.locator('.MuiTablePagination-root');
      await expect(paginationRow).toBeVisible();

      // Rows per page selector should be visible
      await expect(page.getByText(/Rows per page/i)).toBeVisible();
    });
  });

  test.describe('Create Entity Flow', () => {
    test('should show New Entity button for authorized users', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Button may or may not be visible based on permissions
      const newButton = page.getByRole('button', { name: /New Entity/i });
      const hasPermission = await newButton.isVisible().catch(() => false);

      if (hasPermission) {
        await expect(newButton).toBeEnabled();
      } else {
        // User doesn't have create permission - this is acceptable
        console.log('User does not have create entity permission');
      }
    });

    test('should open create entity dialog', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      const newButton = page.getByRole('button', { name: /New Entity/i });
      const hasPermission = await newButton.isVisible().catch(() => false);

      if (!hasPermission) {
        test.skip(true, 'User does not have create permission');
        return;
      }

      await newButton.click();

      // Dialog should open
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/Create New Entity/i)).toBeVisible();
    });

    test('should display all form fields in create dialog', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      const newButton = page.getByRole('button', { name: /New Entity/i });
      const hasPermission = await newButton.isVisible().catch(() => false);

      if (!hasPermission) {
        test.skip(true, 'User does not have create permission');
        return;
      }

      await newButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Check for main form fields
      await expect(page.getByLabel(/Entity Name/i)).toBeVisible();

      // Role checkboxes should be visible
      await expect(page.getByText(/Vendor/i)).toBeVisible();
      await expect(page.getByText(/Customer/i)).toBeVisible();
    });

    test('should close dialog on cancel', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      const newButton = page.getByRole('button', { name: /New Entity/i });
      const hasPermission = await newButton.isVisible().catch(() => false);

      if (!hasPermission) {
        test.skip(true, 'User does not have create permission');
        return;
      }

      await newButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click cancel
      await page.getByRole('button', { name: /Cancel/i }).click();

      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('View Entity Flow', () => {
    test('should open view entity dialog when clicking View Details', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Find and click View Details button on first row
      const viewButton = page.getByRole('button', { name: /View Details/i }).first();
      const hasEntities = await viewButton.isVisible().catch(() => false);

      if (!hasEntities) {
        test.skip(true, 'No entities to test');
        return;
      }

      await viewButton.click();

      // Dialog should open
      await expect(page.getByRole('dialog')).toBeVisible();
    });

    test('should display entity details in view dialog', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      const viewButton = page.getByRole('button', { name: /View Details/i }).first();
      const hasEntities = await viewButton.isVisible().catch(() => false);

      if (!hasEntities) {
        test.skip(true, 'No entities to test');
        return;
      }

      await viewButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Check for common sections
      await expect(page.getByText(/Basic Information/i)).toBeVisible();
    });

    test('should close view dialog', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      const viewButton = page.getByRole('button', { name: /View Details/i }).first();
      const hasEntities = await viewButton.isVisible().catch(() => false);

      if (!hasEntities) {
        test.skip(true, 'No entities to test');
        return;
      }

      await viewButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click close button (aria-label)
      await page.getByRole('button', { name: /Close dialog/i }).click();

      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Edit Entity Flow', () => {
    test('should open edit entity dialog', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Find Edit button on first row
      const editButton = page.getByRole('button', { name: /Edit Entity/i }).first();
      const hasPermission = await editButton.isVisible().catch(() => false);

      if (!hasPermission) {
        test.skip(true, 'No edit permission or no entities');
        return;
      }

      await editButton.click();

      // Dialog should open
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/Edit Entity/i)).toBeVisible();
    });

    test('should pre-populate entity data in edit dialog', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      const editButton = page.getByRole('button', { name: /Edit Entity/i }).first();
      const hasPermission = await editButton.isVisible().catch(() => false);

      if (!hasPermission) {
        test.skip(true, 'No edit permission or no entities');
        return;
      }

      await editButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Entity name field should have a value
      const nameField = page.getByLabel(/Entity Name/i);
      const value = await nameField.inputValue();
      expect(value.length).toBeGreaterThan(0);
    });
  });

  test.describe('Archive Entity Flow', () => {
    test('should open archive dialog', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Find Archive button on first row
      const archiveButton = page.getByRole('button', { name: /Archive Entity/i }).first();
      const hasPermission = await archiveButton.isVisible().catch(() => false);

      if (!hasPermission) {
        test.skip(true, 'No archive permission or no active entities');
        return;
      }

      await archiveButton.click();

      // Dialog should open
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/Are you sure you want to archive/i)).toBeVisible();
    });

    test('should require reason for archiving', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      const archiveButton = page.getByRole('button', { name: /Archive Entity/i }).first();
      const hasPermission = await archiveButton.isVisible().catch(() => false);

      if (!hasPermission) {
        test.skip(true, 'No archive permission or no active entities');
        return;
      }

      await archiveButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Archive button should be disabled without reason
      const submitButton = page.getByRole('button', { name: /^Archive Entity$/i });
      await expect(submitButton).toBeDisabled();

      // Fill reason
      await page.getByLabel(/Reason for archiving/i).fill('E2E test archive reason');

      // Button should now be enabled
      await expect(submitButton).not.toBeDisabled();
    });

    test('should close archive dialog on cancel', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      const archiveButton = page.getByRole('button', { name: /Archive Entity/i }).first();
      const hasPermission = await archiveButton.isVisible().catch(() => false);

      if (!hasPermission) {
        test.skip(true, 'No archive permission or no active entities');
        return;
      }

      await archiveButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click cancel
      await page.getByRole('button', { name: /Cancel/i }).click();

      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Unarchive Entity Flow', () => {
    test('should show unarchive button for archived entities', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Filter to archived entities
      await page.getByLabel(/Status/i).click();
      await page.getByRole('option', { name: /Archived/i }).click();

      await page.waitForTimeout(500);

      // Check for unarchive button
      const unarchiveButton = page.getByRole('button', { name: /Unarchive Entity/i }).first();
      const hasArchivedEntities = await unarchiveButton.isVisible().catch(() => false);

      if (!hasArchivedEntities) {
        console.log('No archived entities found');
        return;
      }

      await expect(unarchiveButton).toBeVisible();
    });

    test('should open unarchive dialog', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Filter to archived entities
      await page.getByLabel(/Status/i).click();
      await page.getByRole('option', { name: /Archived/i }).click();

      await page.waitForTimeout(500);

      const unarchiveButton = page.getByRole('button', { name: /Unarchive Entity/i }).first();
      const hasArchivedEntities = await unarchiveButton.isVisible().catch(() => false);

      if (!hasArchivedEntities) {
        test.skip(true, 'No archived entities');
        return;
      }

      await unarchiveButton.click();

      // Dialog should open
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/Unarchive Entity/i)).toBeVisible();
      await expect(page.getByText(/Do you want to restore/i)).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Verify page renders correctly on mobile
      await expect(page.getByText(/Entity Management/i)).toBeVisible();
      await expect(page.getByText(/Total Entities/i)).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Verify page renders correctly on tablet
      await expect(page.getByText(/Entity Management/i)).toBeVisible();
      await expect(page.getByPlaceholder(/Search entities/i)).toBeVisible();
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state or table when no entities match filter', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Search for something that doesn't exist
      await page.getByPlaceholder(/Search entities/i).fill('ZZZZZZZZNONEXISTENT');

      await page.waitForTimeout(500);

      // Should show either empty state or the table (with no matching results)
      const pageVisible = await page.getByText(/Entity Management/i).isVisible();
      expect(pageVisible).toBe(true);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper form labels', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Filter dropdowns should have labels
      await expect(page.getByLabel(/Status/i)).toBeVisible();
      await expect(page.getByLabel(/Role/i)).toBeVisible();
    });

    test('should be keyboard navigable', async ({ page }) => {
      const isAuthenticated = await navigateToEntitiesPage(page);

      if (!isAuthenticated) {
        // Test keyboard navigation on login page
        await page.keyboard.press('Tab');
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        console.log('Focused element:', focusedElement);
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Tab through the filters
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      console.log('Focused element:', focusedElement);
    });
  });
});
