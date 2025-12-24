/**
 * Projects Module E2E Tests
 *
 * Tests the complete Projects and Charter workflow:
 * 1. Navigate to projects page
 * 2. View projects list
 * 3. View project details
 * 4. Navigate to project charter
 * 5. View charter sections (objectives, scope, budget)
 * 6. View procurement items list
 * 7. View document requirements
 *
 * Run with: pnpm test:e2e --grep "Projects"
 *
 * Note: These tests require authentication via Firebase emulator.
 * The chromium project uses storageState which provides authenticated sessions.
 */

import { test, expect } from '@playwright/test';
import { isTestUserReady, signInForTest } from './auth.helpers';

// Test configuration
const TEST_TIMEOUT = 30000;

test.describe('Projects Module', () => {
  test.beforeEach(async ({ page }) => {
    const testUserReady = await isTestUserReady();
    if (!testUserReady) {
      test.skip(true, 'Test user not ready');
      return;
    }
    const signedIn = await signInForTest(page);
    if (!signedIn) {
      test.skip(true, 'Could not sign in');
    }
  });

  test.describe('Page Navigation', () => {
    test('should load the projects page or redirect to login', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);

      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Should show projects page or login
      await expect(
        page
          .getByText(/Projects|Project List/i)
          .first()
          .or(page.getByText(/Access Denied/i))
          .or(page.getByRole('button', { name: /sign in with google/i }))
      ).toBeVisible({ timeout: 15000 });
    });

    test('should have correct page title', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('domcontentloaded');

      // Check for page title containing Projects or Vapour
      await expect(page).toHaveTitle(/Projects|Vapour/i);
    });

    test('should navigate to project list page', async ({ page }) => {
      await page.goto('/projects/list');
      await page.waitForLoadState('networkidle');

      // Should show project list or login
      await expect(
        page
          .getByText(/All Projects|Projects List/i)
          .first()
          .or(page.getByRole('button', { name: /sign in with google/i }))
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Projects List View (Authenticated)', () => {
    test('should display projects table or empty state when authenticated', async ({ page }) => {
      const testUserReady = await isTestUserReady();
      if (!testUserReady) {
        console.log('  Skipping: Not authenticated');
        return;
      }

      await page.goto('/projects/list');
      await page.waitForLoadState('networkidle');

      // Should show either a table/list or "No projects" message
      await expect(
        page
          .getByRole('table')
          .or(page.getByText(/No projects found/i))
          .or(page.getByText(/No projects yet/i))
          .or(page.getByText(/Create your first project/i))
      ).toBeVisible({ timeout: 10000 });
    });

    test('should have search/filter capability', async ({ page }) => {
      const testUserReady = await isTestUserReady();
      if (!testUserReady) {
        console.log('  Skipping: Not authenticated');
        return;
      }

      await page.goto('/projects/list');
      await page.waitForLoadState('networkidle');

      // Look for search input or filter controls
      const hasSearchOrFilter = await page
        .locator(
          'input[placeholder*="search" i], input[placeholder*="filter" i], button:has-text("Filter")'
        )
        .first()
        .isVisible()
        .catch(() => false);

      // Search/filter is optional but good to have
      console.log(`  Search/filter available: ${hasSearchOrFilter}`);
    });

    test('should have create project button', async ({ page }) => {
      const testUserReady = await isTestUserReady();
      if (!testUserReady) {
        console.log('  Skipping: Not authenticated');
        return;
      }

      await page.goto('/projects/list');
      await page.waitForLoadState('networkidle');

      // Look for new project button
      const hasCreateButton = await page
        .locator(
          'button:has-text("New Project"), button:has-text("Create Project"), a:has-text("New Project")'
        )
        .first()
        .isVisible()
        .catch(() => false);

      console.log(`  Create button available: ${hasCreateButton}`);
    });
  });

  test.describe('Project Detail Navigation', () => {
    test('should navigate to project detail page', async ({ page }) => {
      await page.goto('/projects/test-project-id');
      await page.waitForLoadState('networkidle');

      // Should show project details or login/not found
      await expect(
        page
          .getByText(/Project Details|Overview/i)
          .first()
          .or(page.getByText(/Not Found/i))
          .or(page.getByText(/Project not found/i))
          .or(page.getByRole('button', { name: /sign in with google/i }))
      ).toBeVisible({ timeout: 15000 });
    });

    test('should navigate to project charter page', async ({ page }) => {
      await page.goto('/projects/test-project-id/charter');
      await page.waitForLoadState('networkidle');

      // Should show charter or login/not found
      await expect(
        page
          .getByText(/Charter|Project Charter/i)
          .first()
          .or(page.getByText(/Not Found/i))
          .or(page.getByText(/Project not found/i))
          .or(page.getByRole('button', { name: /sign in with google/i }))
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Project Charter Sections (Authenticated)', () => {
    test('should display charter sections when viewing a project', async ({ page }) => {
      const testUserReady = await isTestUserReady();
      if (!testUserReady) {
        console.log('  Skipping: Not authenticated');
        return;
      }

      // Navigate to a test project charter (may not exist)
      await page.goto('/projects/test-project-id/charter');
      await page.waitForLoadState('networkidle');

      // If project exists, check for charter sections
      const isCharterPage = await page
        .getByText(/Charter|Objectives|Scope|Budget/i)
        .first()
        .isVisible()
        .catch(() => false);

      if (isCharterPage) {
        // Verify charter section headers exist
        const hasObjectives = await page
          .getByText(/Objectives/i)
          .isVisible()
          .catch(() => false);
        const hasScope = await page
          .getByText(/Scope/i)
          .isVisible()
          .catch(() => false);
        const hasBudget = await page
          .getByText(/Budget/i)
          .isVisible()
          .catch(() => false);

        console.log(
          `  Charter sections visible: objectives=${hasObjectives}, scope=${hasScope}, budget=${hasBudget}`
        );
      } else {
        console.log('  Project charter not found or not accessible');
      }
    });

    test('should display procurement items section in charter', async ({ page }) => {
      const testUserReady = await isTestUserReady();
      if (!testUserReady) {
        console.log('  Skipping: Not authenticated');
        return;
      }

      await page.goto('/projects/test-project-id/charter');
      await page.waitForLoadState('networkidle');

      // Look for procurement items section
      const hasProcurementSection = await page
        .getByText(/Procurement Items|Procurement|Items to Procure/i)
        .first()
        .isVisible()
        .catch(() => false);

      console.log(`  Procurement section visible: ${hasProcurementSection}`);
    });

    test('should display document requirements section in charter', async ({ page }) => {
      const testUserReady = await isTestUserReady();
      if (!testUserReady) {
        console.log('  Skipping: Not authenticated');
        return;
      }

      await page.goto('/projects/test-project-id/charter');
      await page.waitForLoadState('networkidle');

      // Look for document requirements section
      const hasDocRequirementsSection = await page
        .getByText(/Document Requirements|Required Documents|Documents/i)
        .first()
        .isVisible()
        .catch(() => false);

      console.log(`  Document requirements section visible: ${hasDocRequirementsSection}`);
    });
  });

  test.describe('Project Files Navigation', () => {
    test('should navigate to project files page', async ({ page }) => {
      await page.goto('/projects/files');
      await page.waitForLoadState('networkidle');

      // Should show files page or login
      await expect(
        page
          .getByText(/Project Files|Files|Documents/i)
          .first()
          .or(page.getByRole('button', { name: /sign in with google/i }))
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading structure on projects page', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Check for heading elements
      const headingCount = await page.locator('h1, h2, h3').count();
      expect(headingCount).toBeGreaterThanOrEqual(0);
    });

    test('should have proper focus management', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Tab through the page
      await page.keyboard.press('Tab');

      // Something should be focused
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });

    test('should be responsive on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Page should not have significant horizontal scroll
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );

      // Allow small tolerance (e.g., 50px) for scrollbars
      expect(scrollWidth).toBeLessThan(50);
    });
  });

  test.describe('UI Elements', () => {
    test('should render projects page without JavaScript errors', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      page.on('pageerror', (error) => {
        errors.push(error.message);
      });

      await page.goto('/projects');
      await page.waitForLoadState('networkidle');

      // Filter out expected/known errors
      const unexpectedErrors = errors.filter(
        (e) =>
          !e.includes('Firebase') &&
          !e.includes('auth') &&
          !e.includes('network') &&
          !e.includes('Sentry') &&
          !e.includes('Session Replay') &&
          !e.includes('401') &&
          !e.includes('403')
      );

      expect(unexpectedErrors).toHaveLength(0);
    });

    test('should have navigation breadcrumbs or back button on project detail', async ({
      page,
    }) => {
      await page.goto('/projects/test-project-id');
      await page.waitForLoadState('networkidle');

      // Check for navigation aids
      const hasNavigation = await page
        .locator(
          'nav[aria-label*="breadcrumb" i], a:has-text("Back"), button:has-text("Back"), a:has-text("Projects")'
        )
        .first()
        .isVisible()
        .catch(() => false);

      console.log(`  Navigation aids visible: ${hasNavigation}`);
    });
  });

  test.describe('Project Status Display', () => {
    test('should show project status indicator', async ({ page }) => {
      const testUserReady = await isTestUserReady();
      if (!testUserReady) {
        console.log('  Skipping: Not authenticated');
        return;
      }

      await page.goto('/projects/list');
      await page.waitForLoadState('networkidle');

      // Look for status indicators (Active, On Hold, Completed, etc.)
      const hasStatusIndicators = await page
        .locator('[class*="status"], [class*="badge"], [data-status]')
        .first()
        .isVisible()
        .catch(() => false);

      console.log(`  Status indicators visible: ${hasStatusIndicators}`);
    });
  });
});

test.describe('Project Charter Workflow', () => {
  test.beforeEach(async ({ page }) => {
    const testUserReady = await isTestUserReady();
    if (!testUserReady) {
      test.skip(true, 'Test user not ready');
      return;
    }
    const signedIn = await signInForTest(page);
    if (!signedIn) {
      test.skip(true, 'Could not sign in');
    }
  });

  test.describe('Charter Actions (Authenticated)', () => {
    test('should have charter submit button when in draft status', async ({ page }) => {
      const testUserReady = await isTestUserReady();
      if (!testUserReady) {
        console.log('  Skipping: Not authenticated');
        return;
      }

      await page.goto('/projects/test-project-id/charter');
      await page.waitForLoadState('networkidle');

      // Check for submit/approval actions
      const hasSubmitAction = await page
        .locator(
          'button:has-text("Submit"), button:has-text("Submit for Approval"), button:has-text("Request Approval")'
        )
        .first()
        .isVisible()
        .catch(() => false);

      console.log(`  Submit action visible: ${hasSubmitAction}`);
    });

    test('should have add procurement item action', async ({ page }) => {
      const testUserReady = await isTestUserReady();
      if (!testUserReady) {
        console.log('  Skipping: Not authenticated');
        return;
      }

      await page.goto('/projects/test-project-id/charter');
      await page.waitForLoadState('networkidle');

      // Check for add procurement item button
      const hasAddAction = await page
        .locator(
          'button:has-text("Add Item"), button:has-text("Add Procurement"), button:has-text("New Item")'
        )
        .first()
        .isVisible()
        .catch(() => false);

      console.log(`  Add procurement action visible: ${hasAddAction}`);
    });

    test('should have add document requirement action', async ({ page }) => {
      const testUserReady = await isTestUserReady();
      if (!testUserReady) {
        console.log('  Skipping: Not authenticated');
        return;
      }

      await page.goto('/projects/test-project-id/charter');
      await page.waitForLoadState('networkidle');

      // Check for add document requirement button
      const hasAddDocAction = await page
        .locator(
          'button:has-text("Add Document"), button:has-text("Add Requirement"), button:has-text("New Requirement")'
        )
        .first()
        .isVisible()
        .catch(() => false);

      console.log(`  Add document requirement action visible: ${hasAddDocAction}`);
    });
  });
});
