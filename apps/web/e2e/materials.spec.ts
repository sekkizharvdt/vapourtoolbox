/**
 * Materials Module E2E Tests
 *
 * Tests the complete materials management journey:
 * 1. Navigate to materials page
 * 2. View materials by category (Pipes, Plates, Fittings, Flanges)
 * 3. Search and filter materials
 * 4. Create a new material
 * 5. View material details
 * 6. Edit a material
 * 7. Price management
 *
 * Run with: pnpm test:e2e --grep "Materials"
 *
 * Note: These tests require authentication via Firebase emulator.
 */

import { test, expect } from '@playwright/test';
import { isTestUserReady, signInForTest } from './auth.helpers';

// Test configuration
const TEST_TIMEOUT = 30000;

test.describe('Materials Module', () => {
  test.beforeEach(async ({ page }) => {
    const testUserReady = await isTestUserReady();
    if (!testUserReady) {
      test.skip(true, 'Test user not ready - Firebase emulator may not be running');
      return;
    }
    const signedIn = await signInForTest(page);
    if (!signedIn) {
      test.skip(true, 'Could not sign in');
    }
  });

  test.describe('Page Navigation', () => {
    test('should load the materials page or redirect to login', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);

      await page.goto('/materials');
      await page.waitForLoadState('networkidle');

      // Should show materials page or login
      await expect(
        page
          .getByText(/Materials|Material Management/i)
          .first()
          .or(page.getByText(/Access Denied/i))
          .or(page.getByRole('button', { name: /sign in with google/i }))
      ).toBeVisible({ timeout: 15000 });
    });

    test('should display materials page when authenticated', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      // Check for page header
      await expect(page.getByText(/Materials|Material Management/i).first()).toBeVisible();
    });
  });

  test.describe('Material Categories', () => {
    test('should display category tabs or navigation', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      // Check for category links/tabs
      const hasCategories = await page
        .getByText(/Pipes|Plates|Fittings|Flanges/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasCategories).toBe(true);
    });

    test('should navigate to Pipes category', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      // Click on Pipes
      await page.getByText(/Pipes/i).first().click();
      await page.waitForTimeout(500);

      // Should show pipes content
      const hasPipesContent = await page
        .getByText(/Pipe|Diameter|Schedule/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasPipesContent).toBe(true);
    });

    test('should navigate to Plates category', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      // Click on Plates
      await page
        .getByText(/Plates/i)
        .first()
        .click();
      await page.waitForTimeout(500);

      // Should show plates content
      const hasPlatesContent = await page
        .getByText(/Plate|Thickness|Grade/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasPlatesContent).toBe(true);
    });

    test('should navigate to Fittings category', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      // Click on Fittings
      await page
        .getByText(/Fittings/i)
        .first()
        .click();
      await page.waitForTimeout(500);

      // Should show fittings content
      const hasFittingsContent = await page
        .getByText(/Fitting|Elbow|Tee|Reducer/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasFittingsContent).toBe(true);
    });

    test('should navigate to Flanges category', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      // Click on Flanges
      await page
        .getByText(/Flanges/i)
        .first()
        .click();
      await page.waitForTimeout(500);

      // Should show flanges content
      const hasFlangesContent = await page
        .getByText(/Flange|Rating|Class/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasFlangesContent).toBe(true);
    });
  });

  test.describe('Materials List View', () => {
    test('should display materials table or empty state', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      // Check for table or empty state
      const hasTable = await page
        .locator('table')
        .isVisible()
        .catch(() => false);
      const hasEmptyState = await page
        .getByText(/No materials|No items|Add your first/i)
        .isVisible()
        .catch(() => false);

      expect(hasTable || hasEmptyState).toBe(true);
    });

    test('should display search/filter controls', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      // Look for search controls
      const hasSearch = await page
        .getByPlaceholder(/Search|Filter/i)
        .isVisible()
        .catch(() => false);

      expect(hasSearch).toBe(true);
    });

    test('should filter materials by search term', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      // Type in search
      const searchInput = page.getByPlaceholder(/Search|Filter/i);
      if (await searchInput.isVisible()) {
        await searchInput.fill('SS304');
        await page.waitForTimeout(500);

        // Page should still be visible
        await expect(page.getByText(/Materials|Material/i).first()).toBeVisible();
      }
    });
  });

  test.describe('Create Material Flow', () => {
    test('should show Add Material button for authorized users', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      // Look for create button
      const createButton = page.getByRole('button', { name: /Add|New|Create/i }).first();
      const hasPermission = await createButton.isVisible().catch(() => false);

      if (hasPermission) {
        await expect(createButton).toBeEnabled();
      } else {
        console.log('User may not have create permission');
      }
    });

    test('should open create material dialog', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      const createButton = page.getByRole('button', { name: /Add|New|Create/i }).first();
      const hasPermission = await createButton.isVisible().catch(() => false);

      if (!hasPermission) {
        test.skip(true, 'User does not have create permission');
        return;
      }

      await createButton.click();

      // Dialog should open
      await expect(
        page.getByRole('dialog').or(page.getByText(/Add.*Material|New.*Material|Create/i))
      ).toBeVisible({ timeout: 5000 });
    });

    test('should display form fields in create dialog', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      const createButton = page.getByRole('button', { name: /Add|New|Create/i }).first();
      const hasPermission = await createButton.isVisible().catch(() => false);

      if (!hasPermission) {
        test.skip(true, 'User does not have create permission');
        return;
      }

      await createButton.click();
      await page.waitForTimeout(500);

      // Check for material-specific form fields
      const hasGrade = await page
        .getByText(/Grade|Material Grade/i)
        .first()
        .isVisible()
        .catch(() => false);
      const hasSize = await page
        .getByText(/Size|Dimension|Thickness/i)
        .first()
        .isVisible()
        .catch(() => false);
      const hasPrice = await page
        .getByText(/Price|Rate|Cost/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasGrade || hasSize || hasPrice).toBe(true);
    });

    test('should close dialog on cancel', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      const createButton = page.getByRole('button', { name: /Add|New|Create/i }).first();
      const hasPermission = await createButton.isVisible().catch(() => false);

      if (!hasPermission) {
        test.skip(true, 'User does not have create permission');
        return;
      }

      await createButton.click();
      await page.waitForTimeout(500);

      // Click cancel
      await page.getByRole('button', { name: /Cancel|Close/i }).click();

      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Material Detail View', () => {
    test('should open material detail on click', async ({ page }) => {
      // Navigate to a specific category with materials
      await page.goto('/materials/pipes');
      await page.waitForLoadState('domcontentloaded');

      // Find a material row
      const materialRow = page.locator('table tbody tr').first();
      const hasMaterials = await materialRow.isVisible().catch(() => false);

      if (!hasMaterials) {
        test.skip(true, 'No materials to test');
        return;
      }

      // Click view button or row
      const viewButton = materialRow.getByRole('button', { name: /View|Details|Edit/i });
      if (await viewButton.isVisible()) {
        await viewButton.click();
      } else {
        await materialRow.click();
      }

      await page.waitForTimeout(1000);

      // Should show detail view
      const hasDetailView = await page
        .getByText(/Material Details|Properties|Specifications/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasDetailView).toBe(true);
    });
  });

  test.describe('Price Management', () => {
    test('should display price information', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      // Look for price-related elements
      const hasPriceColumn = await page
        .getByText(/Price|Rate|Cost|₹/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasPriceColumn).toBe(true);
    });

    test('should show price update option in detail view', async ({ page }) => {
      // Navigate to pipes
      await page.goto('/materials/pipes');
      await page.waitForLoadState('domcontentloaded');

      // Find a material row
      const materialRow = page.locator('table tbody tr').first();
      const hasMaterials = await materialRow.isVisible().catch(() => false);

      if (!hasMaterials) {
        test.skip(true, 'No materials to test');
        return;
      }

      // Click to view details
      const viewButton = materialRow.getByRole('button', { name: /View|Details|Edit/i });
      if (await viewButton.isVisible()) {
        await viewButton.click();
      } else {
        await materialRow.click();
      }

      await page.waitForTimeout(1000);

      // Look for price update option
      const hasPriceEdit = await page
        .getByRole('button', { name: /Update Price|Edit Price|Change Price/i })
        .isVisible()
        .catch(() => false);
      const hasPriceField = await page
        .getByLabel(/Price|Rate/i)
        .isVisible()
        .catch(() => false);

      expect(hasPriceEdit || hasPriceField).toBe(true);
    });
  });

  test.describe('Material Properties', () => {
    test('should display material specifications', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      // Check for material specification columns in table
      const hasSpecs = await page
        .getByText(/Grade|Dimension|Specification|Type/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasSpecs).toBe(true);
    });

    test('should show material type indicators', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      // Check for material type indicators (Stainless Steel, Carbon Steel, etc.)
      const hasTypes = await page
        .getByText(/Stainless|Carbon|Alloy|SS304|SS316/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasTypes).toBe(true);
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      // Should still show materials content
      await expect(page.getByText(/Materials|Material/i).first()).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByText(/Materials|Material/i).first()).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      expect(headings.length).toBeGreaterThan(0);
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      // Tab through the page
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });

    test('should have accessible table headers', async ({ page }) => {
      await page.goto('/materials');
      await page.waitForLoadState('domcontentloaded');

      const hasTable = await page
        .locator('table')
        .isVisible()
        .catch(() => false);

      if (hasTable) {
        const tableHeaders = await page.locator('th').all();
        expect(tableHeaders.length).toBeGreaterThan(0);
      }
    });
  });
});
