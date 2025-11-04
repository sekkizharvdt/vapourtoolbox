import { test, expect } from '@playwright/test';
import { loginAsTestUser, clearFirestoreEmulator } from './helpers/auth';

test.describe('Accounting - Customer Invoices', () => {
  test.beforeEach(async ({ page }) => {
    // Clear Firestore emulator before each test
    await clearFirestoreEmulator();

    // Login as test user
    await loginAsTestUser(page);

    // Create a test customer entity first
    await page.goto('/entities');
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

    // Navigate to Invoices page
    await page.goto('/accounting/invoices');
  });

  test('should display the Invoices page', async ({ page }) => {
    // Check page title
    await expect(page.locator('h4')).toContainText('Customer Invoices');

    // Should show "New Invoice" button
    await expect(page.getByRole('button', { name: /new invoice/i })).toBeVisible();

    // Should show empty state message
    await expect(page.getByText(/no invoices found/i)).toBeVisible();
  });

  test('should create an invoice with line items and GST', async ({ page }) => {
    // Click "New Invoice" button
    await page.getByRole('button', { name: /new invoice/i }).click();

    // Dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/create invoice/i)).toBeVisible();

    // Fill invoice date
    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);

    // Fill due date (30 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const dueDateStr = dueDate.toISOString().split('T')[0]!;
    await page.getByLabel(/due date/i).fill(dueDateStr);

    // Select customer
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();

    // Fill description
    await page.getByLabel(/description/i).fill('Software development services');

    // Fill reference number
    await page.getByLabel(/reference/i).fill('INV-001');

    // Add line items
    // First line item (should be pre-added)
    await page
      .getByLabel(/description/i)
      .first()
      .fill('Web Development');
    await page
      .getByLabel(/hsn\/sac code/i)
      .first()
      .fill('998314');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('40'); // 40 hours
    await page.getByLabel(/rate/i).first().fill('2000'); // ₹2000/hour

    // Add second line item
    await page.getByRole('button', { name: /add line item/i }).click();
    const descriptions = page.getByLabel(/description/i);
    await descriptions.nth(1).fill('Database Setup');
    await page
      .getByLabel(/hsn\/sac code/i)
      .nth(1)
      .fill('998313');
    await page
      .getByLabel(/quantity/i)
      .nth(1)
      .fill('10'); // 10 hours
    await page.getByLabel(/rate/i).nth(1).fill('2500'); // ₹2500/hour

    // Check subtotal
    await expect(page.getByText(/subtotal.*₹105,000/i)).toBeVisible();

    // Check GST calculation (CGST + SGST for intra-state)
    await expect(page.getByText(/cgst.*9%/i)).toBeVisible();
    await expect(page.getByText(/sgst.*9%/i)).toBeVisible();

    // Submit form
    await page.getByRole('button', { name: /^create$/i }).click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Invoice should appear in the list
    await expect(page.getByText('Software development services')).toBeVisible();
    await expect(page.getByText('Test Customer Ltd')).toBeVisible();
    await expect(page.getByText('₹105,000')).toBeVisible(); // Subtotal
    await expect(page.getByText('₹18,900')).toBeVisible(); // GST (18% of 105,000)
    await expect(page.getByText('₹123,900')).toBeVisible(); // Total
  });

  test('should calculate IGST for inter-state invoice', async ({ page }) => {
    // First, create a customer in a different state
    await page.goto('/entities');
    await page.getByRole('button', { name: /new entity/i }).click();

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/entity name/i).fill('Interstate Customer');

    // Select CUSTOMER role
    await page.getByLabel(/entity roles/i).click();
    await page.getByRole('option', { name: /customer/i }).click();
    await page.keyboard.press('Escape');

    // Submit
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

    // Go back to invoices
    await page.goto('/accounting/invoices');
    await page.getByRole('button', { name: /new invoice/i }).click();

    // Fill basic info
    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);

    // Select interstate customer
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /interstate customer/i }).click();

    await page.getByLabel(/description/i).fill('Interstate sale');

    // Add line item
    await page
      .getByLabel(/description/i)
      .first()
      .fill('Product');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('10');
    await page.getByLabel(/rate/i).first().fill('1000');

    // Should show IGST instead of CGST+SGST
    await expect(page.getByText(/igst.*18%/i)).toBeVisible();
    await expect(page.getByText(/cgst/i)).not.toBeVisible();
    await expect(page.getByText(/sgst/i)).not.toBeVisible();

    // Check total
    await expect(page.getByText(/grand total.*₹11,800/i)).toBeVisible();

    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify in list
    await expect(page.getByText('Interstate sale')).toBeVisible();
    await expect(page.getByText('₹1,800')).toBeVisible(); // IGST
  });

  test('should edit an existing invoice', async ({ page }) => {
    // Create an invoice first
    await page.getByRole('button', { name: /new invoice/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.getByLabel(/description/i).fill('Original invoice');
    await page
      .getByLabel(/description/i)
      .first()
      .fill('Service');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('5');
    await page.getByLabel(/rate/i).first().fill('1000');

    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Now edit it
    await page.getByRole('button', { name: /edit/i }).first().click();

    // Dialog should open with existing data
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/description/i)).toHaveValue('Original invoice');

    // Update description
    await page.getByLabel(/description/i).clear();
    await page.getByLabel(/description/i).fill('Updated invoice');

    // Update line item quantity
    await page
      .getByLabel(/quantity/i)
      .first()
      .clear();
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('10');

    // Submit
    await page.getByRole('button', { name: /update/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify updates
    await expect(page.getByText('Updated invoice')).toBeVisible();
    await expect(page.getByText('Original invoice')).not.toBeVisible();
    await expect(page.getByText('₹10,000')).toBeVisible(); // New subtotal
  });

  test('should delete an invoice', async ({ page }) => {
    // Create an invoice first
    await page.getByRole('button', { name: /new invoice/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.getByLabel(/description/i).fill('Invoice to delete');
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

    // Verify invoice exists
    await expect(page.getByText('Invoice to delete')).toBeVisible();

    // Delete it
    page.on('dialog', (dialog) => dialog.accept()); // Accept confirmation
    await page
      .getByRole('button', { name: /delete/i })
      .first()
      .click();

    // Invoice should be removed
    await expect(page.getByText('Invoice to delete')).not.toBeVisible();
    await expect(page.getByText(/no invoices found/i)).toBeVisible();
  });

  test('should display invoice status chips correctly', async ({ page }) => {
    // Create a DRAFT invoice
    await page.getByRole('button', { name: /new invoice/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.getByLabel(/description/i).fill('Draft invoice');

    // Set status to DRAFT
    await page.getByLabel(/status/i).click();
    await page.getByRole('option', { name: 'DRAFT' }).click();

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

    // Verify DRAFT status chip is displayed
    const statusChips = page.locator('[class*="MuiChip-label"]', { hasText: 'DRAFT' });
    await expect(statusChips.first()).toBeVisible();
  });

  test('should require customer selection', async ({ page }) => {
    // Click "New Invoice" button
    await page.getByRole('button', { name: /new invoice/i }).click();

    // Fill only basic fields without customer
    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/description/i).fill('Test invoice');
    await page
      .getByLabel(/description/i)
      .first()
      .fill('Service');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('1');
    await page.getByLabel(/rate/i).first().fill('1000');

    // Try to submit
    await page.getByRole('button', { name: /^create$/i }).click();

    // Should show error
    await expect(page.getByText(/please select a customer/i)).toBeVisible();

    // Dialog should still be open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should require at least one line item', async ({ page }) => {
    // Click "New Invoice" button
    await page.getByRole('button', { name: /new invoice/i }).click();

    // Fill basic info
    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.getByLabel(/description/i).fill('Test invoice');

    // Don't fill any line items (or fill with zero amount)
    // Try to submit
    await page.getByRole('button', { name: /^create$/i }).click();

    // Should show error
    await expect(page.getByText(/please add at least one line item/i)).toBeVisible();

    // Dialog should still be open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should calculate totals correctly for multiple line items', async ({ page }) => {
    await page.getByRole('button', { name: /new invoice/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.getByLabel(/description/i).fill('Multi-item invoice');

    // Line item 1: 5 × 1000 = 5000
    await page
      .getByLabel(/description/i)
      .first()
      .fill('Item 1');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('5');
    await page.getByLabel(/rate/i).first().fill('1000');

    // Line item 2: 3 × 2000 = 6000
    await page.getByRole('button', { name: /add line item/i }).click();
    await page
      .getByLabel(/description/i)
      .nth(1)
      .fill('Item 2');
    await page
      .getByLabel(/quantity/i)
      .nth(1)
      .fill('3');
    await page.getByLabel(/rate/i).nth(1).fill('2000');

    // Line item 3: 2 × 1500 = 3000
    await page.getByRole('button', { name: /add line item/i }).click();
    await page
      .getByLabel(/description/i)
      .nth(2)
      .fill('Item 3');
    await page
      .getByLabel(/quantity/i)
      .nth(2)
      .fill('2');
    await page.getByLabel(/rate/i).nth(2).fill('1500');

    // Subtotal should be 14000
    await expect(page.getByText(/subtotal.*₹14,000/i)).toBeVisible();

    // GST should be 2520 (18% of 14000)
    await expect(page.getByText(/total gst.*₹2,520/i)).toBeVisible();

    // Grand total should be 16520
    await expect(page.getByText(/grand total.*₹16,520/i)).toBeVisible();

    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify in table
    await expect(page.getByText('₹14,000')).toBeVisible(); // Subtotal
    await expect(page.getByText('₹2,520')).toBeVisible(); // GST
    await expect(page.getByText('₹16,520')).toBeVisible(); // Total
  });

  test('should generate GL entries automatically', async ({ page }) => {
    // Create an invoice
    await page.getByRole('button', { name: /new invoice/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option', { name: /test customer ltd/i }).click();
    await page.getByLabel(/description/i).fill('GL test invoice');
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

    // TODO: Add verification of GL entries once we have a GL entries viewer
    // For now, we verify the invoice was created successfully
    await expect(page.getByText('GL test invoice')).toBeVisible();
  });
});
