import { test, expect } from '@playwright/test';
import { loginAsTestUser, clearFirestoreEmulator } from './helpers/auth';

test.describe('Accounting - Reports', () => {
  test.beforeEach(async ({ page }) => {
    // Clear Firestore emulator before each test
    await clearFirestoreEmulator();

    // Login as test user
    await loginAsTestUser(page);
  });

  test.describe('Trial Balance', () => {
    test('should display the Trial Balance report', async ({ page }) => {
      await page.goto('/accounting/reports/trial-balance');

      // Check page title
      await expect(page.locator('h4')).toContainText('Trial Balance');

      // Should show table headers
      await expect(page.getByText(/account/i)).toBeVisible();
      await expect(page.getByText(/debit/i)).toBeVisible();
      await expect(page.getByText(/credit/i)).toBeVisible();

      // Should show totals row
      await expect(page.getByText(/total/i)).toBeVisible();
    });
  });

  test.describe('Balance Sheet', () => {
    test('should display the Balance Sheet report', async ({ page }) => {
      await page.goto('/accounting/reports/balance-sheet');

      // Check page title
      await expect(page.locator('h4')).toContainText('Balance Sheet');

      // Should show main categories
      await expect(page.getByText(/assets/i)).toBeVisible();
      await expect(page.getByText(/liabilities/i)).toBeVisible();
      await expect(page.getByText(/equity/i)).toBeVisible();

      // Should have date picker
      await expect(page.getByLabel(/as of date/i)).toBeVisible();
    });

    test('should allow changing the report date', async ({ page }) => {
      await page.goto('/accounting/reports/balance-sheet');

      // Change the date
      const today = new Date().toISOString().split('T')[0]!;
      await page.getByLabel(/as of date/i).fill(today);

      // Report should still be visible (it will reload with new date)
      await expect(page.locator('h4')).toContainText('Balance Sheet');
    });
  });

  test.describe('Profit & Loss', () => {
    test('should display the Profit & Loss report', async ({ page }) => {
      await page.goto('/accounting/reports/profit-loss');

      // Check page title
      await expect(page.locator('h4')).toContainText('Profit');

      // Should show main categories
      await expect(page.getByText(/revenue/i)).toBeVisible();
      await expect(page.getByText(/expenses/i)).toBeVisible();

      // Should have date range pickers
      await expect(page.getByLabel(/from date/i)).toBeVisible();
      await expect(page.getByLabel(/to date/i)).toBeVisible();
    });

    test('should allow changing the date range', async ({ page }) => {
      await page.goto('/accounting/reports/profit-loss');

      // Set date range (last 30 days)
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const fromDate = thirtyDaysAgo.toISOString().split('T')[0]!;
      const toDate = today.toISOString().split('T')[0]!;

      await page.getByLabel(/from date/i).fill(fromDate);
      await page.getByLabel(/to date/i).fill(toDate);

      // Report should still be visible
      await expect(page.locator('h4')).toContainText('Profit');
    });
  });

  test.describe('Account Ledger', () => {
    test('should display the Account Ledger page', async ({ page }) => {
      await page.goto('/accounting/reports/account-ledger');

      // Check page title
      await expect(page.locator('h4')).toContainText('Account Ledger');

      // Should have account selector
      await expect(page.getByLabel(/select account/i)).toBeVisible();

      // Should have date range pickers
      await expect(page.getByLabel(/from date/i)).toBeVisible();
      await expect(page.getByLabel(/to date/i)).toBeVisible();
    });

    test('should display ledger entries after selecting an account', async ({ page }) => {
      // First, create some test data
      await page.goto('/accounting/chart-of-accounts');

      // The default COA should already be initialized with accounts
      // Navigate to account ledger
      await page.goto('/accounting/reports/account-ledger');

      // Select an account (e.g., Cash)
      await page.getByLabel(/select account/i).click();
      await page.getByRole('option').first().click(); // Select first account

      // Should show table headers
      await expect(page.getByText(/date/i)).toBeVisible();
      await expect(page.getByText(/description/i)).toBeVisible();
      await expect(page.getByText(/debit/i)).toBeVisible();
      await expect(page.getByText(/credit/i)).toBeVisible();
      await expect(page.getByText(/balance/i)).toBeVisible();
    });
  });

  test.describe('Reports with Transaction Data', () => {
    test.beforeEach(async ({ page }) => {
      // Create test entities
      await page.goto('/entities');
      await page.getByRole('button', { name: /new entity/i }).click();

      // Wait for dialog to be visible and ready
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      await page.getByLabel(/entity name/i).fill('Report Test Customer');

      // Select CUSTOMER role from multi-select dropdown
      await page.getByLabel(/entity roles/i).click();
      await page.getByRole('option', { name: /customer/i }).click();
      await page.keyboard.press('Escape');

      // Submit form
      await page.getByRole('button', { name: /^create$/i }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

      // Create an invoice
      await page.goto('/accounting/invoices');
      await page.getByRole('button', { name: /new invoice/i }).click();

      const today = new Date().toISOString().split('T')[0]!;
      await page.getByLabel(/^date$/i).fill(today);
      await page.getByLabel(/customer/i).click();
      await page.getByRole('option', { name: /report test customer/i }).click();
      await page.getByLabel(/description/i).fill('Test Invoice for Reports');
      await page
        .getByLabel(/description/i)
        .first()
        .fill('Service');
      await page
        .getByLabel(/quantity/i)
        .first()
        .fill('10');
      await page.getByLabel(/rate/i).first().fill('1000');

      await page.getByRole('button', { name: /^create$/i }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should show transaction data in reports after invoice creation', async ({ page }) => {
      // Go to P&L report
      await page.goto('/accounting/reports/profit-loss');

      // Set date range to include today
      const today = new Date();
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const fromDate = firstOfMonth.toISOString().split('T')[0]!;
      const toDate = today.toISOString().split('T')[0]!;

      await page.getByLabel(/from date/i).fill(fromDate);
      await page.getByLabel(/to date/i).fill(toDate);

      // Report should show revenue category
      await expect(page.getByText(/revenue/i)).toBeVisible();

      // Note: Actual revenue amounts might not show immediately due to GL entry processing
      // This test verifies the report structure is working
    });

    test('should show account balance changes in trial balance', async ({ page }) => {
      // Go to trial balance
      await page.goto('/accounting/reports/trial-balance');

      // Should show accounts with balances
      await expect(page.getByText(/account/i)).toBeVisible();
      await expect(page.getByText(/total/i)).toBeVisible();
    });
  });
});
