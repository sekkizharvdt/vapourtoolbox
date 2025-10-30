import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

/**
 * Entity Management Tests
 *
 * Tests entity CRUD operations with Firebase Emulator authentication
 */

test.describe('Entities Page', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/entities');

    // Should redirect to login (wait longer for slower devices)
    await page.waitForURL(/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/login/);
  });

  test('should show entities page after login', async ({ page }) => {
    // Authenticate using custom token
    await loginAsUser(page);

    // Use domcontentloaded to avoid Firefox NS_BINDING_ABORTED errors
    await page.goto('/entities', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/entities\/?/);

    // Wait for page to load (client-side rendered)
    await page.waitForLoadState('networkidle');

    // Should show entities page heading
    await expect(page.getByRole('heading', { name: /entity management/i, level: 1 })).toBeVisible({ timeout: 10000 });
  });

  test('should show create entity button', async ({ page }) => {
    // Authenticate using custom token
    await loginAsUser(page);

    // Use domcontentloaded to avoid Firefox NS_BINDING_ABORTED errors
    await page.goto('/entities', { waitUntil: 'domcontentloaded' });

    // Wait for page to load (client-side rendered)
    await page.waitForLoadState('networkidle');

    // Should show "New Entity" button
    await expect(page.getByRole('button', { name: /new entity/i })).toBeVisible({ timeout: 10000 });
  });

  test('should open create entity dialog', async ({ page }) => {
    // Authenticate using custom token
    await loginAsUser(page);

    // Use domcontentloaded to avoid Firefox NS_BINDING_ABORTED errors
    await page.goto('/entities', { waitUntil: 'domcontentloaded' });

    // Wait for page to load (client-side rendered)
    await page.waitForLoadState('networkidle');

    // Wait for and click "New Entity" button
    const newEntityButton = page.getByRole('button', { name: /new entity/i });
    await newEntityButton.waitFor({ state: 'visible', timeout: 10000 });
    await newEntityButton.click();

    // Should show dialog
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  });

  test.skip('should validate entity form fields', async ({ page }) => {
    // TODO: Implement login helper and form validation test
    // await authenticateUser(page, 'test@example.com', 'password');

    await page.goto('/entities');

    // Open create dialog
    const createButton = page.locator('button:has-text("Create"), button:has-text("Add")').first();
    await createButton.click();

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"], button:has-text("Create")').last();
    await submitButton.click();

    // Should show validation errors
    const errorMessage = page.locator('[role="alert"], .error, .text-red');
    await expect(errorMessage.first()).toBeVisible();
  });

  test.skip('should create new entity', async () => {
    // TODO: Implement full entity creation test
    // This requires:
    // 1. Authentication
    // 2. Test data
    // 3. Cleanup after test
  });

  test.skip('should edit existing entity', async () => {
    // TODO: Implement entity editing test
  });

  test.skip('should delete entity', async () => {
    // TODO: Implement entity deletion test
  });

  test.skip('should search/filter entities', async () => {
    // TODO: Implement search test
  });
});
