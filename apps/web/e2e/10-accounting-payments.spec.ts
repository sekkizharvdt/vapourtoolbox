import { test, expect } from '@playwright/test';
import { loginAsTestUser, clearFirestoreEmulator } from './helpers/auth';

test.describe('Accounting - Payments', () => {
  test.beforeEach(async ({ page }) => {
    // Clear Firestore emulator before each test
    await clearFirestoreEmulator();

    // Login as test user
    await loginAsTestUser(page);

    // Create test entities (customer and vendor)
    await page.goto('/entities');

    // Create customer
    await page.getByRole('button', { name: /new entity/i }).click();

    // Wait for dialog to be visible and ready
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Fill entity name
    await page.getByLabel(/entity name/i).fill('Test Customer Ltd');

    // Select CUSTOMER role from multi-select dropdown
    await page.getByLabel(/entity roles/i).click();
    await page.getByRole('option', { name: /customer/i }).click();
    // Click outside dropdown to close it
    await page.keyboard.press('Escape');

    // Submit form
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

    // Create vendor
    await page.getByRole('button', { name: /new entity/i }).click();

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/entity name/i).fill('Test Vendor Pvt Ltd');

    // Select VENDOR role
    await page.getByLabel(/entity roles/i).click();
    await page.getByRole('option', { name: /vendor/i }).click();
    await page.keyboard.press('Escape');

    // Submit
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

    // Navigate to Payments page
    await page.goto('/accounting/payments');
  });

  test('should display the Payments page with filter toggle', async ({ page }) => {
    // Check page title
    await expect(page.locator('h4')).toContainText('Payments');

    // Should show both buttons
    await expect(page.getByRole('button', { name: /customer receipt/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /vendor payment/i })).toBeVisible();

    // Should show filter toggle
    await expect(page.getByRole('button', { name: /all payments/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /customer receipts/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /vendor payments/i })).toBeVisible();

    // Should show empty state message
    await expect(page.getByText(/no payments found/i)).toBeVisible();
  });

  test('should record a customer payment (receipt) against an invoice', async ({ page }) => {
    // First create an invoice
    await page.goto('/accounting/invoices');
    await page.getByRole('button', { name: /new invoice/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.getByLabel(/description/i).fill('Test Invoice for Payment');
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

    // Now record a payment
    await page.goto('/accounting/payments');
    await page.getByRole('button', { name: /customer receipt/i }).click();

    // Dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/record customer payment/i)).toBeVisible();

    // Fill payment date
    await page.getByLabel(/payment date/i).fill(today);

    // Select customer
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();

    // Wait for outstanding invoices to load
    await page.waitForTimeout(1000);

    // Select invoice to allocate against
    const invoiceCheckbox = page.getByRole('checkbox').first();
    await invoiceCheckbox.check();

    // Enter amount
    await page
      .getByLabel(/amount/i)
      .first()
      .fill('11800'); // Full amount with GST

    // Select payment method
    await page.getByLabel(/payment method/i).click();
    await page.getByRole('option', { name: /bank transfer/i }).click();

    // Select bank account
    await page.getByLabel(/bank account/i).click();
    await page.getByRole('option').first().click();

    // Add reference
    await page.getByLabel(/reference/i).fill('REF-PAY-001');

    // Submit
    await page.getByRole('button', { name: /record payment/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify payment appears in list
    await expect(page.getByText('Test Customer Ltd')).toBeVisible();
    await expect(page.getByText('₹11,800')).toBeVisible();
    await expect(page.getByText('BANK_TRANSFER')).toBeVisible();
  });

  test('should record a vendor payment against a bill', async ({ page }) => {
    // First create a bill
    await page.goto('/accounting/bills');
    await page.getByRole('button', { name: /new bill/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/vendor/i).click();
    await page.getByRole('option', { name: /test vendor pvt ltd/i }).click();
    await page.getByLabel(/description/i).fill('Test Bill for Payment');
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

    // Now record a payment
    await page.goto('/accounting/payments');
    await page.getByRole('button', { name: /vendor payment/i }).click();

    // Dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/record vendor payment/i)).toBeVisible();

    // Fill payment date
    await page.getByLabel(/payment date/i).fill(today);

    // Select vendor
    await page.getByLabel(/vendor/i).click();
    await page.getByRole('option', { name: /test vendor pvt ltd/i }).click();

    // Wait for outstanding bills to load
    await page.waitForTimeout(1000);

    // Select bill to allocate against
    const billCheckbox = page.getByRole('checkbox').first();
    await billCheckbox.check();

    // Enter amount
    await page
      .getByLabel(/amount/i)
      .first()
      .fill('11800'); // Full amount with GST

    // Select payment method
    await page.getByLabel(/payment method/i).click();
    await page.getByRole('option', { name: /bank transfer/i }).click();

    // Select bank account
    await page.getByLabel(/bank account/i).click();
    await page.getByRole('option').first().click();

    // Add reference
    await page.getByLabel(/reference/i).fill('REF-VEN-001');

    // Submit
    await page.getByRole('button', { name: /record payment/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify payment appears in list
    await expect(page.getByText('Test Vendor Pvt Ltd')).toBeVisible();
    await expect(page.getByText('₹11,800')).toBeVisible();
    await expect(page.getByText('BANK_TRANSFER')).toBeVisible();
  });

  test('should filter payments by type', async ({ page }) => {
    // Create a customer payment and a vendor payment first
    // (simplified version - just create the payment records)

    // Create customer invoice and payment
    await page.goto('/accounting/invoices');
    await page.getByRole('button', { name: /new invoice/i }).click();
    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.getByLabel(/description/i).fill('Invoice 1');
    await page
      .getByLabel(/description/i)
      .first()
      .fill('Service');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('1');
    await page.getByLabel(/rate/i).first().fill('1000');
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.goto('/accounting/payments');
    await page.getByRole('button', { name: /customer receipt/i }).click();
    await page.getByLabel(/payment date/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('checkbox').first().check();
    await page
      .getByLabel(/amount/i)
      .first()
      .fill('1180');
    await page.getByLabel(/payment method/i).click();
    await page.getByRole('option', { name: /cash/i }).click();
    await page.getByRole('button', { name: /record payment/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Create vendor bill and payment
    await page.goto('/accounting/bills');
    await page.getByRole('button', { name: /new bill/i }).click();
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/vendor/i).click();
    await page.getByRole('option', { name: /test vendor pvt ltd/i }).click();
    await page.getByLabel(/description/i).fill('Bill 1');
    await page
      .getByLabel(/description/i)
      .first()
      .fill('Service');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('1');
    await page.getByLabel(/rate/i).first().fill('1000');
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.goto('/accounting/payments');
    await page.getByRole('button', { name: /vendor payment/i }).click();
    await page.getByLabel(/payment date/i).fill(today);
    await page.getByLabel(/vendor/i).click();
    await page.getByRole('option', { name: /test vendor pvt ltd/i }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('checkbox').first().check();
    await page
      .getByLabel(/amount/i)
      .first()
      .fill('1180');
    await page.getByLabel(/payment method/i).click();
    await page.getByRole('option', { name: /cash/i }).click();
    await page.getByRole('button', { name: /record payment/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Now test filtering
    // All payments should show both
    await page.getByRole('button', { name: /all payments/i }).click();
    await expect(page.getByText('Test Customer Ltd')).toBeVisible();
    await expect(page.getByText('Test Vendor Pvt Ltd')).toBeVisible();

    // Filter to customer receipts only
    await page.getByRole('button', { name: /customer receipts/i }).click();
    await expect(page.getByText('Test Customer Ltd')).toBeVisible();
    await expect(page.getByText('Test Vendor Pvt Ltd')).not.toBeVisible();

    // Filter to vendor payments only
    await page.getByRole('button', { name: /vendor payments/i }).click();
    await expect(page.getByText('Test Vendor Pvt Ltd')).toBeVisible();
    await expect(page.getByText('Test Customer Ltd')).not.toBeVisible();
  });

  test('should support different payment methods', async ({ page }) => {
    // Create invoice first
    await page.goto('/accounting/invoices');
    await page.getByRole('button', { name: /new invoice/i }).click();
    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.getByLabel(/description/i).fill('Invoice for Payment Methods Test');
    await page
      .getByLabel(/description/i)
      .first()
      .fill('Service');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('1');
    await page.getByLabel(/rate/i).first().fill('1000');
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Test Cash payment
    await page.goto('/accounting/payments');
    await page.getByRole('button', { name: /customer receipt/i }).click();
    await page.getByLabel(/payment date/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('checkbox').first().check();
    await page
      .getByLabel(/amount/i)
      .first()
      .fill('1180');
    await page.getByLabel(/payment method/i).click();
    await page.getByRole('option', { name: /cash/i }).click();
    await page.getByRole('button', { name: /record payment/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify cash payment appears
    await expect(page.getByText('CASH')).toBeVisible();
  });

  test('should delete a payment', async ({ page }) => {
    // Create invoice and payment first
    await page.goto('/accounting/invoices');
    await page.getByRole('button', { name: /new invoice/i }).click();
    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.getByLabel(/description/i).fill('Invoice to Delete Payment');
    await page
      .getByLabel(/description/i)
      .first()
      .fill('Service');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('1');
    await page.getByLabel(/rate/i).first().fill('1000');
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.goto('/accounting/payments');
    await page.getByRole('button', { name: /customer receipt/i }).click();
    await page.getByLabel(/payment date/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('checkbox').first().check();
    await page
      .getByLabel(/amount/i)
      .first()
      .fill('1180');
    await page.getByLabel(/payment method/i).click();
    await page.getByRole('option', { name: /cash/i }).click();
    await page.getByRole('button', { name: /record payment/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify payment exists
    await expect(page.getByText('Test Customer Ltd')).toBeVisible();

    // Delete it
    page.on('dialog', (dialog) => dialog.accept());
    await page
      .getByRole('button', { name: /delete/i })
      .first()
      .click();

    // Payment should be removed
    await expect(page.getByText(/no payments found/i)).toBeVisible();
  });

  test('should display payment type chips correctly', async ({ page }) => {
    // Create invoice and payment
    await page.goto('/accounting/invoices');
    await page.getByRole('button', { name: /new invoice/i }).click();
    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.getByLabel(/description/i).fill('Invoice for Chip Test');
    await page
      .getByLabel(/description/i)
      .first()
      .fill('Service');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('1');
    await page.getByLabel(/rate/i).first().fill('1000');
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.goto('/accounting/payments');
    await page.getByRole('button', { name: /customer receipt/i }).click();
    await page.getByLabel(/payment date/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('checkbox').first().check();
    await page
      .getByLabel(/amount/i)
      .first()
      .fill('1180');
    await page.getByLabel(/payment method/i).click();
    await page.getByRole('option', { name: /cash/i }).click();
    await page.getByRole('button', { name: /record payment/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify "Receipt" chip is displayed
    const receiptChips = page.locator('[class*="MuiChip-label"]', { hasText: 'Receipt' });
    await expect(receiptChips.first()).toBeVisible();
  });

  test('should generate GL entries for payments', async ({ page }) => {
    // Create invoice and payment
    await page.goto('/accounting/invoices');
    await page.getByRole('button', { name: /new invoice/i }).click();
    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.getByLabel(/description/i).fill('Invoice for GL Test');
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

    await page.goto('/accounting/payments');
    await page.getByRole('button', { name: /customer receipt/i }).click();
    await page.getByLabel(/payment date/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('checkbox').first().check();
    await page
      .getByLabel(/amount/i)
      .first()
      .fill('11800');
    await page.getByLabel(/payment method/i).click();
    await page.getByRole('option', { name: /cash/i }).click();
    await page.getByRole('button', { name: /record payment/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // TODO: Add verification of GL entries once we have a GL entries viewer
    // For now, verify payment was created successfully
    await expect(page.getByText('Test Customer Ltd')).toBeVisible();
    await expect(page.getByText('₹11,800')).toBeVisible();
  });
});
