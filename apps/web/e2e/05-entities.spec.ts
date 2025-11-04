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

    // Wait for page to load - don't use networkidle as Firestore keeps persistent connection
    // Instead, wait for either the loading spinner to disappear or the heading to appear
    await Promise.race([
      page
        .getByRole('heading', { name: /entity management/i, level: 1 })
        .waitFor({ state: 'visible', timeout: 15000 }),
      page.getByText('Access Denied').waitFor({ state: 'visible', timeout: 15000 }),
    ]).catch(() => {
      // If both fail, continue - next assertion will catch the issue
    });

    // Should show entities page heading
    await expect(page.getByRole('heading', { name: /entity management/i, level: 1 })).toBeVisible({
      timeout: 5000,
    });
  });

  test('should show create entity button', async ({ page }) => {
    // Authenticate using custom token
    await loginAsUser(page);

    // Use domcontentloaded to avoid Firefox NS_BINDING_ABORTED errors
    await page.goto('/entities', { waitUntil: 'domcontentloaded' });

    // Wait for page to render - don't use networkidle as Firestore keeps persistent connection
    await page
      .getByRole('heading', { name: /entity management/i, level: 1 })
      .waitFor({ state: 'visible', timeout: 15000 });

    // Should show "New Entity" button
    await expect(page.getByRole('button', { name: /new entity/i })).toBeVisible({ timeout: 5000 });
  });

  test('should open create entity dialog', async ({ page }) => {
    // Authenticate using custom token
    await loginAsUser(page);

    // Use domcontentloaded to avoid Firefox NS_BINDING_ABORTED errors
    await page.goto('/entities', { waitUntil: 'domcontentloaded' });

    // Wait for page to render - don't use networkidle as Firestore keeps persistent connection
    await page
      .getByRole('heading', { name: /entity management/i, level: 1 })
      .waitFor({ state: 'visible', timeout: 15000 });

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

test.describe('Entity Duplicate Prevention', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate
    await loginAsUser(page);

    // Navigate to entities page
    await page.goto('/entities', { waitUntil: 'domcontentloaded' });
    await page
      .getByRole('heading', { name: /entity management/i, level: 1 })
      .waitFor({ state: 'visible', timeout: 15000 });
  });

  test('should prevent duplicate entity names (case-insensitive)', async ({ page }) => {
    // Create first entity
    await page.getByRole('button', { name: /new entity/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Fill form for first entity
    await page.getByLabel(/entity name/i).fill('Test Company Ltd');
    // Click on the Entity Roles dropdown (MUI Select)
    await page.getByRole('combobox', { name: '' }).first().click();
    await page.getByRole('option', { name: /vendor/i }).click();
    // Close the dropdown
    await page.keyboard.press('Escape');

    // Add a contact (scroll to make it visible in the dialog)
    await page.getByRole('button', { name: /add contact/i }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /add contact/i }).click();
    await page.getByLabel(/^name/i).first().fill('John Doe');
    await page
      .getByLabel(/^email/i)
      .first()
      .fill('john@test.com');
    await page
      .getByLabel(/^phone/i)
      .first()
      .fill('1234567890');
    // Click Add Contact again to actually add the contact to the list
    await page.getByRole('button', { name: /add contact/i }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /add contact/i }).click();

    // Submit first entity
    await page.getByRole('button', { name: /create entity/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Wait for entity to be created
    await expect(page.getByText('Test Company Ltd')).toBeVisible({ timeout: 10000 });

    // Try to create second entity with same name (different case)
    await page.getByRole('button', { name: /new entity/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/entity name/i).fill('test company ltd'); // Same name, different case
    // Click on the Entity Roles dropdown (MUI Select)
    await page.getByRole('combobox', { name: '' }).first().click();
    await page.getByRole('option', { name: /customer/i }).click();
    // Close the dropdown
    await page.keyboard.press('Escape');

    // Add a contact (scroll to make it visible in the dialog)
    await page.getByRole('button', { name: /add contact/i }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /add contact/i }).click();
    await page.getByLabel(/^name/i).first().fill('Jane Doe');
    await page
      .getByLabel(/^email/i)
      .first()
      .fill('jane@test.com');
    await page
      .getByLabel(/^phone/i)
      .first()
      .fill('0987654321');
    // Click Add Contact again to actually add the contact to the list
    await page.getByRole('button', { name: /add contact/i }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /add contact/i }).click();

    // Submit - should fail
    await page.getByRole('button', { name: /create entity/i }).click();

    // Should show error about duplicate
    await expect(page.getByText(/entity.*already exists/i)).toBeVisible({ timeout: 10000 });

    // Dialog should still be open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should prevent duplicate GSTIN', async ({ page }) => {
    const duplicateGSTIN = '29ABCDE1234F1Z5';

    // Create first entity with GSTIN
    await page.getByRole('button', { name: /new entity/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/entity name/i).fill('First GSTIN Company');
    // Click on the Entity Roles dropdown (MUI Select)
    await page.getByRole('combobox', { name: '' }).first().click();
    await page.getByRole('option', { name: /vendor/i }).click();
    // Close the dropdown
    await page.keyboard.press('Escape');

    // Add contact
    await page.getByRole('button', { name: /add contact/i }).click();
    await page.getByLabel(/^name/i).first().fill('Contact One');
    await page
      .getByLabel(/^email/i)
      .first()
      .fill('contact1@test.com');
    await page
      .getByLabel(/^phone/i)
      .first()
      .fill('1111111111');
    // Click Add Contact again to actually add the contact to the list
    await page.getByRole('button', { name: /add contact/i }).click();

    // Add GSTIN
    await page.getByLabel(/gstin/i).fill(duplicateGSTIN);

    // Submit first entity
    await page.getByRole('button', { name: /create entity/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Wait for entity to be created
    await expect(page.getByText('First GSTIN Company')).toBeVisible({ timeout: 10000 });

    // Try to create second entity with same GSTIN
    await page.getByRole('button', { name: /new entity/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/entity name/i).fill('Second GSTIN Company');
    // Click on the Entity Roles dropdown (MUI Select)
    await page.getByRole('combobox', { name: '' }).first().click();
    await page.getByRole('option', { name: /customer/i }).click();
    // Close the dropdown
    await page.keyboard.press('Escape');

    // Add contact
    await page.getByRole('button', { name: /add contact/i }).click();
    await page.getByLabel(/^name/i).first().fill('Contact Two');
    await page
      .getByLabel(/^email/i)
      .first()
      .fill('contact2@test.com');
    await page
      .getByLabel(/^phone/i)
      .first()
      .fill('2222222222');
    // Click Add Contact again to actually add the contact to the list
    await page.getByRole('button', { name: /add contact/i }).click();

    // Add same GSTIN
    await page.getByLabel(/gstin/i).fill(duplicateGSTIN);

    // Submit - should fail
    await page.getByRole('button', { name: /create entity/i }).click();

    // Should show error about duplicate GSTIN
    await expect(page.getByText(/gstin.*already exists/i)).toBeVisible({ timeout: 10000 });

    // Dialog should still be open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should prevent duplicate PAN', async ({ page }) => {
    const duplicatePAN = 'ABCDE1234F';

    // Create first entity with PAN
    await page.getByRole('button', { name: /new entity/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/entity name/i).fill('First PAN Company');
    // Click on the Entity Roles dropdown (MUI Select)
    await page.getByRole('combobox', { name: '' }).first().click();
    await page.getByRole('option', { name: /vendor/i }).click();
    // Close the dropdown
    await page.keyboard.press('Escape');

    // Add contact
    await page.getByRole('button', { name: /add contact/i }).click();
    await page.getByLabel(/^name/i).first().fill('Contact Alpha');
    await page
      .getByLabel(/^email/i)
      .first()
      .fill('alpha@test.com');
    await page
      .getByLabel(/^phone/i)
      .first()
      .fill('3333333333');
    // Click Add Contact again to actually add the contact to the list
    await page.getByRole('button', { name: /add contact/i }).click();

    // Add PAN
    await page.getByLabel(/^pan/i).fill(duplicatePAN);

    // Submit first entity
    await page.getByRole('button', { name: /create entity/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Wait for entity to be created
    await expect(page.getByText('First PAN Company')).toBeVisible({ timeout: 10000 });

    // Try to create second entity with same PAN
    await page.getByRole('button', { name: /new entity/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/entity name/i).fill('Second PAN Company');
    // Click on the Entity Roles dropdown (MUI Select)
    await page.getByRole('combobox', { name: '' }).first().click();
    await page.getByRole('option', { name: /customer/i }).click();
    // Close the dropdown
    await page.keyboard.press('Escape');

    // Add contact
    await page.getByRole('button', { name: /add contact/i }).click();
    await page.getByLabel(/^name/i).first().fill('Contact Beta');
    await page
      .getByLabel(/^email/i)
      .first()
      .fill('beta@test.com');
    await page
      .getByLabel(/^phone/i)
      .first()
      .fill('4444444444');
    // Click Add Contact again to actually add the contact to the list
    await page.getByRole('button', { name: /add contact/i }).click();

    // Add same PAN
    await page.getByLabel(/^pan/i).fill(duplicatePAN);

    // Submit - should fail
    await page.getByRole('button', { name: /create entity/i }).click();

    // Should show error about duplicate PAN
    await expect(page.getByText(/pan.*already exists/i)).toBeVisible({ timeout: 10000 });

    // Dialog should still be open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should allow entities with unique names and tax IDs', async ({ page }) => {
    // Create first entity
    await page.getByRole('button', { name: /new entity/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/entity name/i).fill('Unique Company A');
    // Click on the Entity Roles dropdown (MUI Select)
    await page.getByRole('combobox', { name: '' }).first().click();
    await page.getByRole('option', { name: /vendor/i }).click();
    // Close the dropdown
    await page.keyboard.press('Escape');

    // Add contact
    await page.getByRole('button', { name: /add contact/i }).click();
    await page.getByLabel(/^name/i).first().fill('Contact A');
    await page
      .getByLabel(/^email/i)
      .first()
      .fill('contacta@test.com');
    await page
      .getByLabel(/^phone/i)
      .first()
      .fill('5555555555');
    // Click Add Contact again to actually add the contact to the list
    await page.getByRole('button', { name: /add contact/i }).click();

    await page.getByLabel(/gstin/i).fill('29UNIQUE1234A1Z5');
    await page.getByLabel(/^pan/i).fill('UNIQU1234A');

    // Submit first entity
    await page.getByRole('button', { name: /create entity/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Wait for entity to be created
    await expect(page.getByText('Unique Company A')).toBeVisible({ timeout: 10000 });

    // Create second entity with completely different data
    await page.getByRole('button', { name: /new entity/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/entity name/i).fill('Unique Company B');
    // Click on the Entity Roles dropdown (MUI Select)
    await page.getByRole('combobox', { name: '' }).first().click();
    await page.getByRole('option', { name: /customer/i }).click();
    // Close the dropdown
    await page.keyboard.press('Escape');

    // Add contact
    await page.getByRole('button', { name: /add contact/i }).click();
    await page.getByLabel(/^name/i).first().fill('Contact B');
    await page
      .getByLabel(/^email/i)
      .first()
      .fill('contactb@test.com');
    await page
      .getByLabel(/^phone/i)
      .first()
      .fill('6666666666');
    // Click Add Contact again to actually add the contact to the list
    await page.getByRole('button', { name: /add contact/i }).click();

    await page.getByLabel(/gstin/i).fill('29UNIQUE1234B1Z5');
    await page.getByLabel(/^pan/i).fill('UNIQU1234B');

    // Submit second entity - should succeed
    await page.getByRole('button', { name: /create entity/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Both entities should be visible
    await expect(page.getByText('Unique Company A')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Unique Company B')).toBeVisible({ timeout: 10000 });
  });
});
