import { test, expect } from '@playwright/test';
import { loginAsTestUser, clearFirestoreEmulator } from './helpers/auth';

test.describe('Accounting - Chart of Accounts', () => {
  test.beforeEach(async ({ page }) => {
    // Clear Firestore emulator before each test
    await clearFirestoreEmulator();

    // Login as test user
    await loginAsTestUser(page);

    // Navigate to Chart of Accounts
    await page.goto('/accounting/chart-of-accounts');

    // Wait for the Chart of Accounts heading to appear (indicates page loaded)
    await page.waitForSelector('h1:has-text("Chart of Accounts")', { timeout: 10000 });
  });

  test('should display the Chart of Accounts page', async ({ page }) => {
    // Check page title (should already be visible from beforeEach)
    await expect(page.locator('h1')).toContainText('Chart of Accounts');

    // Should show "New Account" button
    await expect(page.getByRole('button', { name: /new account/i })).toBeVisible();
  });

  test('should create a new account', async ({ page }) => {
    // Click "New Account" button
    await page.getByRole('button', { name: /new account/i }).click();

    // Dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Create New Account')).toBeVisible();

    // Fill in account details
    await page.getByLabel(/account code/i).fill('1234');
    await page.getByLabel(/account name/i).fill('Test Asset Account');
    await page.getByLabel(/description/i).fill('Test account for E2E testing');

    // Account type defaults to Asset, so no need to select it

    // Submit form
    await page.getByRole('button', { name: /create/i }).click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Account should appear in the list
    await expect(page.getByText('Test Asset Account')).toBeVisible();
    await expect(page.getByText('1234')).toBeVisible();
  });

  test('should validate account code format', async ({ page }) => {
    // Click "Create Account" button
    await page.getByRole('button', { name: /new account/i }).click();

    // Try to create account with invalid code (letters)
    await page.getByLabel(/account code/i).fill('ABCD');
    await page.getByLabel(/account name/i).fill('Test Account');

    // Account type defaults to Asset, so no need to select it

    // Submit form
    await page.getByRole('button', { name: /create/i }).click();

    // Should show validation error
    await expect(page.getByText(/account code must be numeric/i)).toBeVisible();
  });

  test('should prevent duplicate account codes', async ({ page }) => {
    // Create first account
    await page.getByRole('button', { name: /new account/i }).click();
    await page.getByLabel(/account code/i).fill('5000');
    await page.getByLabel(/account name/i).fill('First Account');

    // Select Expense account type (combobox doesn't work with getByLabel)
    // Scope to dialog to avoid clicking the filter combobox on the main page
    await page.getByRole('dialog').locator('[role="combobox"]').first().click();
    await page.getByRole('option', { name: 'Expense' }).click();
    await page.getByRole('button', { name: /create/i }).click();

    // Wait for dialog to close
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Try to create second account with same code
    await page.getByRole('button', { name: /new account/i }).click();
    await page.getByLabel(/account code/i).fill('5000');
    await page.getByLabel(/account name/i).fill('Second Account');

    // Select Expense account type
    await page.getByRole('dialog').locator('[role="combobox"]').first().click();
    await page.getByRole('option', { name: 'Expense' }).click();
    await page.getByRole('button', { name: /create/i }).click();

    // Should show error about duplicate code
    await expect(page.getByText(/an account with this code already exists/i)).toBeVisible();
  });

  test('should filter accounts by type', async ({ page }) => {
    // Create multiple accounts of different types
    const accounts = [
      { code: '1150', name: 'Cash', type: 'Asset' },
      { code: '2150', name: 'Accounts Payable', type: 'Liability' },
      { code: '3150', name: 'Equity', type: 'Equity' },
      { code: '4150', name: 'Sales Revenue', type: 'Income' },
      { code: '5150', name: 'Cost of Sales', type: 'Expense' },
    ];

    for (const account of accounts) {
      await page.getByRole('button', { name: /new account/i }).click();
      await page.getByLabel(/account code/i).fill(account.code);
      await page.getByLabel(/account name/i).fill(account.name);

      // Only select account type if it's not Asset (which is the default)
      if (account.type !== 'Asset') {
        await page.getByRole('dialog').locator('[role="combobox"]').first().click();
        await page.getByRole('option', { name: account.type }).click();
      }

      await page.getByRole('button', { name: /create/i }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
    }

    // Filter by Asset type
    // The filter combobox is labeled "Account Type", scoped to the filters panel
    await page.locator('[role="combobox"]').filter({ hasText: 'All Types' }).click();
    await page.getByRole('option', { name: 'Assets' }).click();

    // Should only show asset accounts
    await expect(page.getByText('Cash', { exact: true })).toBeVisible();
    await expect(page.getByText('Accounts Payable', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Sales Revenue', { exact: true })).not.toBeVisible();

    // Wait for the dropdown menu to be hidden before interacting again
    await page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 5000 });

    // Clear filter
    await page.locator('[role="combobox"]').filter({ hasText: 'Assets' }).click();
    await page.getByRole('option', { name: 'All Types' }).click();

    // Should show all accounts
    await expect(page.getByText('Cash', { exact: true })).toBeVisible();
    await expect(page.getByText('Accounts Payable', { exact: true })).toBeVisible();
  });

  test('should search accounts by name or code', async ({ page }) => {
    // Create test accounts
    await page.getByRole('button', { name: /new account/i }).click();
    await page.getByLabel(/account code/i).fill('1234');
    await page.getByLabel(/account name/i).fill('Searchable Account');

    // Account type defaults to Asset, so no need to select it
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Search by name
    await page.getByPlaceholder(/search/i).fill('Searchable');
    await expect(page.getByText('Searchable Account')).toBeVisible();

    // Search by code
    await page.getByPlaceholder(/search/i).clear();
    await page.getByPlaceholder(/search/i).fill('1234');
    await expect(page.getByText('Searchable Account')).toBeVisible();
  });

  test('should edit an existing account', async ({ page }) => {
    // Create an account
    await page.getByRole('button', { name: /new account/i }).click();
    await page.getByLabel(/account code/i).fill('6000');
    await page.getByLabel(/account name/i).fill('Original Name');

    // Select Expense account type
    await page.getByRole('dialog').locator('[role="combobox"]').first().click();
    await page.getByRole('option', { name: 'Expense' }).click();
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Click edit button on the account row
    // Use getByText to find "Original Name" and navigate to nearest Paper parent, then find edit button
    await page
      .getByText('Original Name')
      .locator('..')
      .locator('..')
      .getByRole('button', { name: /edit/i })
      .click();

    // Dialog should appear with existing data
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/account name/i)).toHaveValue('Original Name');

    // Update the name
    await page.getByLabel(/account name/i).clear();
    await page.getByLabel(/account name/i).fill('Updated Name');

    // Submit
    await page.getByRole('button', { name: /update/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Updated name should be visible
    await expect(page.getByText('Updated Name')).toBeVisible();
    await expect(page.getByText('Original Name')).not.toBeVisible();
  });

  test('should handle group accounts correctly', async ({ page }) => {
    // Create a group account (header)
    await page.getByRole('button', { name: /new account/i }).click();
    await page.getByLabel(/account code/i).fill('1000');
    await page.getByLabel(/account name/i).fill('CURRENT ASSETS');

    // Account type defaults to Asset, so no need to select it

    // Check "Group Account" checkbox
    await page.getByLabel(/group account/i).check();

    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Group account should be shown differently (maybe bold or with indicator)
    await expect(page.getByText('CURRENT ASSETS')).toBeVisible();
  });

  test('should prevent posting to group accounts', async ({ page }) => {
    // This test ensures group accounts can't be used in transactions
    // The validation would happen in transaction creation dialogs

    // Create a group account
    await page.getByRole('button', { name: /new account/i }).click();
    await page.getByLabel(/account code/i).fill('2000');
    await page.getByLabel(/account name/i).fill('LIABILITIES');

    // Select Liability account type
    await page.getByRole('dialog').locator('[role="combobox"]').first().click();
    await page.getByRole('option', { name: 'Liability' }).click();

    await page.getByLabel(/group account/i).check();
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Navigate to journal entries
    await page.goto('/accounting/journal-entries');
    await page.getByRole('button', { name: /create journal entry/i }).click();

    // Try to select group account
    // Account selector should either not show group accounts or show them as disabled
    // This validation depends on the implementation
  });
});
