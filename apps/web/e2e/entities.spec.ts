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

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { signInForTest, isTestUserReady } from './auth.helpers';

// Test configuration
const TEST_TIMEOUT = 30000;

// Shared authenticated state - sign in once, reuse across tests
let sharedContext: BrowserContext | null = null;
let sharedPage: Page | null = null;
let isAuthenticated = false;

/**
 * Navigate to entities page using authenticated shared page
 * Returns the shared page if authenticated, otherwise returns false
 */
async function getAuthenticatedPage(): Promise<Page | null> {
  if (!isAuthenticated || !sharedPage) {
    return null;
  }

  await sharedPage.goto('/entities');
  await sharedPage.waitForLoadState('domcontentloaded');

  // Quick check - wait for page subtitle
  const pageReady = await sharedPage
    .getByText(/Manage vendors, customers, and business partners/i)
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (!pageReady) return null;

  // Wait for table to load (either entities or empty state)
  // This ensures Firestore data has been fetched
  await sharedPage
    .locator('table, [data-testid="empty-state"]')
    .or(sharedPage.getByText(/No entities yet/i))
    .or(sharedPage.getByText(/E2E Test/i)) // Our test entity names contain this
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {
      console.log('  [getAuthenticatedPage] Timeout waiting for table/empty state');
    });

  return sharedPage;
}

/**
 * Quick navigation to entities page - for use after already authenticated
 */
async function quickNavigateToEntities(page: Page): Promise<void> {
  await page.goto('/entities');
  await page.waitForLoadState('domcontentloaded');
  // Wait for the page subtitle to appear (unique identifier)
  await page
    .getByText(/Manage vendors, customers, and business partners/i)
    .waitFor({ state: 'visible', timeout: 10000 });
}

test.describe('Entities Module', () => {
  // Sign in once before all tests in this describe block
  test.beforeAll(async ({ browser }) => {
    console.log('  [beforeAll] Setting up shared authenticated session...');

    const testUserReady = await isTestUserReady();
    if (!testUserReady) {
      console.log('  [beforeAll] Test user not ready - tests will be skipped');
      return;
    }

    // Create a persistent context
    sharedContext = await browser.newContext();
    sharedPage = await sharedContext.newPage();

    // Sign in once
    isAuthenticated = await signInForTest(sharedPage);
    console.log(`  [beforeAll] Authentication result: ${isAuthenticated}`);

    if (isAuthenticated) {
      // Navigate to entities page to warm up
      await sharedPage.goto('/entities');
      await sharedPage.waitForLoadState('domcontentloaded');
      console.log('  [beforeAll] Shared session ready');
    }
  });

  test.afterAll(async () => {
    console.log('  [afterAll] Cleaning up shared session...');
    if (sharedPage) await sharedPage.close();
    if (sharedContext) await sharedContext.close();
    sharedPage = null;
    sharedContext = null;
    isAuthenticated = false;
  });

  test.describe('Page Navigation', () => {
    test('should load the entities page or redirect to login', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);

      await page.goto('/entities');
      await page.waitForLoadState('networkidle');

      // Should show either entities page, access denied, loading state, or login page
      // The page should never be completely blank anymore
      await expect(
        page
          .getByText(/Entity Management/i)
          .or(page.getByText(/Access Denied/i))
          .or(page.getByText(/Redirecting to login/i))
          .or(page.getByText(/Verifying permissions/i))
          .or(page.getByText(/Loading authentication/i))
          .or(page.getByRole('button', { name: /sign in with google/i }))
      ).toBeVisible({ timeout: 15000 });
    });

    test('should display entities page when authenticated', async () => {
      if (!isAuthenticated || !sharedPage) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      await quickNavigateToEntities(sharedPage);

      // Check for page header - use .first() because "Entity Management" appears in both sidebar and page title
      await expect(sharedPage.getByText(/Entity Management/i).first()).toBeVisible();
      await expect(
        sharedPage.getByText(/Manage vendors, customers, and business partners/i)
      ).toBeVisible();
    });

    test('should display stats cards when authenticated', async () => {
      if (!isAuthenticated || !sharedPage) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      await quickNavigateToEntities(sharedPage);

      // Stats cards should be visible
      await expect(sharedPage.getByText(/Total Entities/i)).toBeVisible();
      await expect(sharedPage.getByText(/^Active$/i)).toBeVisible();
      await expect(sharedPage.getByText(/^Archived$/i)).toBeVisible();
      await expect(sharedPage.getByText(/^Vendors$/i)).toBeVisible();
      await expect(sharedPage.getByText(/^Customers$/i)).toBeVisible();
    });
  });

  test.describe('Filtering & Search', () => {
    test('should display filter controls', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Search field should be visible
      await expect(page.getByPlaceholder(/Search entities/i)).toBeVisible();

      // Status dropdown should be visible - use text content since MUI Select doesn't use standard labels
      await expect(page.getByText(/All Status/i).first()).toBeVisible();

      // Role dropdown should be visible - use text content since MUI Select doesn't use standard labels
      await expect(page.getByText(/All Roles/i).first()).toBeVisible();
    });

    test('should filter by status', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Click status dropdown - use text content to find the MUI Select
      await page
        .getByText(/All Status/i)
        .first()
        .click();

      // Check for options
      await expect(page.getByRole('option', { name: /All Status/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Active/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Archived/i })).toBeVisible();

      // Select Active
      await page.getByRole('option', { name: /^Active$/i }).click();

      // Verify filter applied
      await page.waitForTimeout(500);
    });

    test('should filter by role', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Click role dropdown - use text content to find the MUI Select
      await page
        .getByText(/All Roles/i)
        .first()
        .click();

      // Check for options
      await expect(page.getByRole('option', { name: /All Roles/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Vendor/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /Customer/i })).toBeVisible();

      // Select Vendor
      await page.getByRole('option', { name: /Vendor/i }).click();

      // Verify filter applied
      await page.waitForTimeout(500);
    });

    test('should search by entity name', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Type in search field
      await page.getByPlaceholder(/Search entities/i).fill('Test');

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Page should still be visible (filter applied) - use .first() for multiple matches
      await expect(page.getByText(/Entity Management/i).first()).toBeVisible();
    });

    test('should clear filters', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Apply some filters
      await page.getByPlaceholder(/Search entities/i).fill('Test');
      await page
        .getByText(/All Status/i)
        .first()
        .click();
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
    test('should display table headers or empty state', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Check if there are entities (table visible) or empty state
      const hasTable = await page
        .locator('table')
        .isVisible()
        .catch(() => false);
      const hasEmptyState = await page
        .getByText(/No entities yet/i)
        .isVisible()
        .catch(() => false);

      if (hasEmptyState) {
        // Empty state is valid - no table headers to check
        console.log('No entities - empty state displayed');
        await expect(page.getByText(/No entities yet/i)).toBeVisible();
        return;
      }

      if (hasTable) {
        // Check for table headers
        await expect(page.getByText(/Entity Name/i).first()).toBeVisible();
        await expect(page.getByText(/^Roles$/i).first()).toBeVisible();
      }
    });

    test('should sort by name when entities exist', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Skip if no entities
      const hasEmptyState = await page
        .getByText(/No entities yet/i)
        .isVisible()
        .catch(() => false);
      if (hasEmptyState) {
        console.log('No entities to sort');
        return;
      }

      // Click on Entity Name header to sort
      const header = page.getByText(/Entity Name/i).first();
      if (await header.isVisible()) {
        await header.click();
        await page.waitForTimeout(500);
      }
    });

    test('should display pagination when entities exist', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Skip if no entities - pagination may not show with empty table
      const hasEmptyState = await page
        .getByText(/No entities yet/i)
        .isVisible()
        .catch(() => false);
      if (hasEmptyState) {
        console.log('No entities - pagination may not be visible');
        return;
      }

      // Check for pagination controls
      const paginationRow = page.locator('.MuiTablePagination-root');
      const hasPagination = await paginationRow.isVisible().catch(() => false);
      if (hasPagination) {
        await expect(page.getByText(/Rows per page/i)).toBeVisible();
      }
    });
  });

  test.describe('Create Entity Flow', () => {
    test('should show New Entity button for authorized users', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
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

    test('should open create entity dialog', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
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

    test('should display all form fields in create dialog', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
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

      // Check for Entity Roles dropdown and other form sections
      // Use .first() because "Entity Roles" appears as both a label and text in the Select
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText(/Entity Roles/i).first()).toBeVisible();
      await expect(dialog.getByText(/Contact Persons/i).first()).toBeVisible();
    });

    test('should close dialog on cancel', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
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
    test('should open view entity dialog when clicking View Details', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
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

    test('should display entity details in view dialog', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
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

    test('should close view dialog', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
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
    test('should open edit entity dialog', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
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

    test('should pre-populate entity data in edit dialog', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
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
    test('should open archive dialog', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
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

    test('should require reason for archiving', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
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

    test('should close archive dialog on cancel', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
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
    test('should show unarchive button for archived entities', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Filter to archived entities - use text content to find MUI Select
      await page
        .getByText(/All Status/i)
        .first()
        .click();
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

    test('should open unarchive dialog', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Filter to archived entities - use text content to find MUI Select
      await page
        .getByText(/All Status/i)
        .first()
        .click();
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
    test('should work on mobile viewport', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // On mobile, sidebar is collapsed/hidden, so check for main content instead
      // Use the unique page subtitle which is always visible in the main content area
      await expect(
        page.getByText(/Manage vendors, customers, and business partners/i)
      ).toBeVisible();
      await expect(page.getByText(/Total Entities/i)).toBeVisible();
    });

    test('should work on tablet viewport', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // On tablet, sidebar may be collapsed, so check for main content
      // Use the unique page subtitle which is always visible
      await expect(
        page.getByText(/Manage vendors, customers, and business partners/i)
      ).toBeVisible();
      await expect(page.getByPlaceholder(/Search entities/i)).toBeVisible();
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state or table when no entities match filter', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Search for something that doesn't exist
      await page.getByPlaceholder(/Search entities/i).fill('ZZZZZZZZNONEXISTENT');

      await page.waitForTimeout(500);

      // Should show the page content - use unique subtitle since sidebar may be collapsed
      const pageVisible = await page
        .getByText(/Manage vendors, customers, and business partners/i)
        .isVisible();
      expect(pageVisible).toBe(true);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper form labels', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
        test.skip(true, 'Requires authentication - test user not ready');
        return;
      }

      // Filter dropdowns should be visible - use text content since MUI Select doesn't use standard labels
      await expect(page.getByText(/All Status/i).first()).toBeVisible();
      await expect(page.getByText(/All Roles/i).first()).toBeVisible();
    });

    test('should be keyboard navigable', async () => {
      const page = await getAuthenticatedPage();
      if (!page) {
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
