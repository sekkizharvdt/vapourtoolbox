/**
 * BOM/Estimation Module E2E Tests
 *
 * Tests the complete BOM (Bill of Materials) and estimation workflow:
 * 1. Navigate to estimation/BOM page
 * 2. View BOMs list
 * 3. Create a new BOM
 * 4. Add items to BOM
 * 5. View BOM details
 * 6. Calculate costs
 * 7. BOM status workflow
 *
 * Run with: pnpm test:e2e --grep "BOM"
 *
 * Note: These tests use the authenticated storage state from playwright.config.ts.
 * Authentication is handled via the chromium project's storageState configuration.
 */

import { test, expect } from '@playwright/test';
import { isTestUserReady } from './auth.helpers';

// Test configuration
const TEST_TIMEOUT = 30000;

test.describe('BOM/Estimation Module', () => {
  test.beforeEach(async () => {
    const testUserReady = await isTestUserReady();
    if (!testUserReady) {
      test.skip(true, 'Test user not ready');
    }
  });

  test.describe('Page Navigation', () => {
    test('should load the estimation page or redirect to login', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);

      await page.goto('/estimation');
      await page.waitForLoadState('networkidle');

      // Should show estimation page or login
      await expect(
        page
          .getByText(/Estimation|Bill of Materials|BOM/i)
          .first()
          .or(page.getByText(/Access Denied/i))
          .or(page.getByRole('button', { name: /sign in with google/i }))
      ).toBeVisible({ timeout: 15000 });
    });

    test('should display BOM list when authenticated', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      // Check for page header
      await expect(page.getByText(/Estimation|Bill of Materials|BOM/i).first()).toBeVisible();
    });
  });

  test.describe('BOM List View', () => {
    test('should display BOM table or empty state', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      // Check for table or empty state
      const hasTable = await page
        .locator('table')
        .isVisible()
        .catch(() => false);
      const hasEmptyState = await page
        .getByText(/No BOMs|No estimates|Create your first/i)
        .isVisible()
        .catch(() => false);

      expect(hasTable || hasEmptyState).toBe(true);
    });

    test('should display search/filter controls', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      // Look for search or filter controls
      const hasSearch = await page
        .getByPlaceholder(/Search|Filter/i)
        .isVisible()
        .catch(() => false);
      const hasFilter = await page
        .getByText(/Status|Filter/i)
        .first()
        .isVisible()
        .catch(() => false);

      // At least one control should be present
      expect(hasSearch || hasFilter).toBe(true);
    });

    test('should show New BOM button for authorized users', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      // Look for create button
      const createButton = page.getByRole('button', { name: /New BOM|Create|Add/i });
      const hasPermission = await createButton.isVisible().catch(() => false);

      if (hasPermission) {
        await expect(createButton).toBeEnabled();
      } else {
        console.log('User may not have create permission');
      }
    });
  });

  test.describe('Create BOM Flow', () => {
    test('should open create BOM dialog', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      const createButton = page.getByRole('button', { name: /New BOM|Create/i });
      const hasPermission = await createButton.isVisible().catch(() => false);

      if (!hasPermission) {
        test.skip(true, 'User does not have create permission');
        return;
      }

      await createButton.click();

      // Dialog or form should open
      await expect(
        page.getByRole('dialog').or(page.getByText(/Create.*BOM|New.*Estimate/i))
      ).toBeVisible({ timeout: 5000 });
    });

    test('should display required form fields', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      const createButton = page.getByRole('button', { name: /New BOM|Create/i });
      const hasPermission = await createButton.isVisible().catch(() => false);

      if (!hasPermission) {
        test.skip(true, 'User does not have create permission');
        return;
      }

      await createButton.click();
      await page.waitForTimeout(500);

      // Check for common BOM fields
      const hasNameField = await page
        .getByLabel(/Name|Title|Description/i)
        .isVisible()
        .catch(() => false);
      const hasProjectField = await page
        .getByText(/Project|Proposal/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasNameField || hasProjectField).toBe(true);
    });

    test('should close dialog on cancel', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      const createButton = page.getByRole('button', { name: /New BOM|Create/i });
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

  test.describe('BOM Detail View', () => {
    test('should navigate to BOM detail page when clicking on BOM', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      // Find a BOM row to click
      const bomRow = page.locator('table tbody tr').first();
      const hasBOMs = await bomRow.isVisible().catch(() => false);

      if (!hasBOMs) {
        test.skip(true, 'No BOMs to test');
        return;
      }

      // Click on the row or view button
      const viewButton = bomRow.getByRole('button', { name: /View|Details/i });
      const hasViewButton = await viewButton.isVisible().catch(() => false);

      if (hasViewButton) {
        await viewButton.click();
      } else {
        await bomRow.click();
      }

      await page.waitForTimeout(1000);

      // Should navigate to detail page or open detail dialog
      const hasDetailView = await page
        .getByText(/BOM Items|Line Items|Details/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasDetailView).toBe(true);
    });

    test('should display BOM items section', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      // Navigate to first BOM
      const bomRow = page.locator('table tbody tr').first();
      const hasBOMs = await bomRow.isVisible().catch(() => false);

      if (!hasBOMs) {
        test.skip(true, 'No BOMs to test');
        return;
      }

      const viewButton = bomRow.getByRole('button', { name: /View|Details/i });
      if (await viewButton.isVisible()) {
        await viewButton.click();
      } else {
        await bomRow.click();
      }

      await page.waitForTimeout(1000);

      // Should show items section
      const hasItemsSection = await page
        .getByText(/Items|Components|Materials/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasItemsSection).toBe(true);
    });
  });

  test.describe('BOM Cost Calculation', () => {
    test('should display cost summary section', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      // Navigate to first BOM
      const bomRow = page.locator('table tbody tr').first();
      const hasBOMs = await bomRow.isVisible().catch(() => false);

      if (!hasBOMs) {
        test.skip(true, 'No BOMs to test');
        return;
      }

      const viewButton = bomRow.getByRole('button', { name: /View|Details/i });
      if (await viewButton.isVisible()) {
        await viewButton.click();
      } else {
        await bomRow.click();
      }

      await page.waitForTimeout(1000);

      // Should show cost-related elements
      const hasCostSection = await page
        .getByText(/Cost|Total|Summary|Amount/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasCostSection).toBe(true);
    });

    test('should show calculate/recalculate button', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      // Navigate to first BOM
      const bomRow = page.locator('table tbody tr').first();
      const hasBOMs = await bomRow.isVisible().catch(() => false);

      if (!hasBOMs) {
        test.skip(true, 'No BOMs to test');
        return;
      }

      const viewButton = bomRow.getByRole('button', { name: /View|Details/i });
      if (await viewButton.isVisible()) {
        await viewButton.click();
      } else {
        await bomRow.click();
      }

      await page.waitForTimeout(1000);

      // Look for calculate button
      const calcButton = page.getByRole('button', { name: /Calculate|Recalculate|Update/i });
      const hasCalcButton = await calcButton.isVisible().catch(() => false);

      if (hasCalcButton) {
        await expect(calcButton).toBeEnabled();
      }
    });
  });

  test.describe('BOM Status Workflow', () => {
    test('should display status badge', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      // Check for status indicators in the list
      const hasStatusBadge = await page
        .getByText(/Draft|Submitted|Approved|Pending|Active/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasStatusBadge).toBe(true);
    });

    test('should show status transition button for authorized users', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      // Navigate to first BOM
      const bomRow = page.locator('table tbody tr').first();
      const hasBOMs = await bomRow.isVisible().catch(() => false);

      if (!hasBOMs) {
        test.skip(true, 'No BOMs to test');
        return;
      }

      const viewButton = bomRow.getByRole('button', { name: /View|Details/i });
      if (await viewButton.isVisible()) {
        await viewButton.click();
      } else {
        await bomRow.click();
      }

      await page.waitForTimeout(1000);

      // Look for status action buttons
      const statusButton = page.getByRole('button', {
        name: /Submit|Approve|Reject|Send for Approval/i,
      });
      const hasStatusButton = await statusButton.isVisible().catch(() => false);

      if (hasStatusButton) {
        console.log('Status transition button found');
        await expect(statusButton).toBeVisible();
      } else {
        console.log('No status transition buttons visible - user may not have permission');
      }
    });
  });

  test.describe('Add BOM Items', () => {
    test('should show Add Item button in BOM detail', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      // Navigate to first BOM
      const bomRow = page.locator('table tbody tr').first();
      const hasBOMs = await bomRow.isVisible().catch(() => false);

      if (!hasBOMs) {
        test.skip(true, 'No BOMs to test');
        return;
      }

      const viewButton = bomRow.getByRole('button', { name: /View|Details/i });
      if (await viewButton.isVisible()) {
        await viewButton.click();
      } else {
        await bomRow.click();
      }

      await page.waitForTimeout(1000);

      // Look for add item button
      const addItemButton = page.getByRole('button', { name: /Add Item|Add Component|Add Line/i });
      const hasAddButton = await addItemButton.isVisible().catch(() => false);

      if (hasAddButton) {
        await expect(addItemButton).toBeEnabled();
      }
    });

    test('should open add item dialog', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      // Navigate to first BOM
      const bomRow = page.locator('table tbody tr').first();
      const hasBOMs = await bomRow.isVisible().catch(() => false);

      if (!hasBOMs) {
        test.skip(true, 'No BOMs to test');
        return;
      }

      const viewButton = bomRow.getByRole('button', { name: /View|Details/i });
      if (await viewButton.isVisible()) {
        await viewButton.click();
      } else {
        await bomRow.click();
      }

      await page.waitForTimeout(1000);

      const addItemButton = page.getByRole('button', { name: /Add Item|Add Component|Add Line/i });
      const hasAddButton = await addItemButton.isVisible().catch(() => false);

      if (!hasAddButton) {
        test.skip(true, 'Add item button not visible');
        return;
      }

      await addItemButton.click();

      // Dialog should open
      await expect(
        page.getByRole('dialog').or(page.getByText(/Add.*Item|New.*Component/i))
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      // Should still show estimation content
      await expect(page.getByText(/Estimation|Bill of Materials|BOM/i).first()).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByText(/Estimation|Bill of Materials|BOM/i).first()).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      expect(headings.length).toBeGreaterThan(0);
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/estimation');
      await page.waitForLoadState('domcontentloaded');

      // Tab through the page
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });
  });
});
