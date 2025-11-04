import { test, expect } from '@playwright/test';
import { loginAsTestUser, clearFirestoreEmulator } from './helpers/auth';

test.describe('Accounting - Vendor Bills', () => {
  test.beforeEach(async ({ page }) => {
    // Clear Firestore emulator before each test
    await clearFirestoreEmulator();

    // Login as test user
    await loginAsTestUser(page);

    // Create a test vendor entity first
    await page.goto('/entities');
    await page.getByRole('button', { name: /new entity/i }).click();

    // Wait for dialog to be visible and ready
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Fill entity name
    await page.getByLabel(/entity name/i).fill('Test Vendor Pvt Ltd');

    // Select VENDOR role from multi-select dropdown
    await page.getByLabel(/entity roles/i).click();
    await page.getByRole('option', { name: /vendor/i }).click();
    await page.keyboard.press('Escape');

    // Submit form
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

    // Navigate to Bills page
    await page.goto('/accounting/bills');
  });

  test('should display the Bills page', async ({ page }) => {
    // Check page title
    await expect(page.locator('h4')).toContainText('Vendor Bills');

    // Should show "New Bill" button
    await expect(page.getByRole('button', { name: /new bill/i })).toBeVisible();

    // Should show empty state message
    await expect(page.getByText(/no bills found/i)).toBeVisible();
  });

  test('should create a bill with line items, GST, and TDS', async ({ page }) => {
    // Click "New Bill" button
    await page.getByRole('button', { name: /new bill/i }).click();

    // Dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/create bill/i)).toBeVisible();

    // Fill bill date
    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);

    // Fill due date (30 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const dueDateStr = dueDate.toISOString().split('T')[0]!;
    await page.getByLabel(/due date/i).fill(dueDateStr);

    // Select vendor
    await page.getByLabel(/vendor/i).click();
    await page.getByRole('option', { name: /test vendor pvt ltd/i }).click();

    // Fill description
    await page.getByLabel(/description/i).fill('Professional services rendered');

    // Fill reference number (vendor invoice number)
    await page.getByLabel(/reference/i).fill('VEND-INV-001');

    // Add line items
    // First line item
    await page
      .getByLabel(/description/i)
      .first()
      .fill('Consulting Services');
    await page
      .getByLabel(/hsn\/sac code/i)
      .first()
      .fill('998314');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('20'); // 20 hours
    await page.getByLabel(/rate/i).first().fill('5000'); // ₹5000/hour

    // Check subtotal
    await expect(page.getByText(/subtotal.*₹100,000/i)).toBeVisible();

    // Check GST calculation (CGST + SGST for intra-state)
    await expect(page.getByText(/cgst.*9%/i)).toBeVisible();
    await expect(page.getByText(/sgst.*9%/i)).toBeVisible();

    // Enable TDS deduction
    await page.getByLabel(/tds deducted/i).check();

    // Select TDS section
    await page.getByLabel(/tds section/i).click();
    await page.getByRole('option', { name: /194j/i }).click(); // Professional services

    // Fill vendor PAN
    await page.getByLabel(/vendor pan/i).fill('ABCDE1234F');

    // TDS amount should be calculated (10% of 118,000 for 194J)
    await expect(page.getByText(/tds.*₹11,800/i)).toBeVisible();

    // Net payable should be 118,000 - 11,800 = 106,200
    await expect(page.getByText(/total.*₹106,200/i)).toBeVisible();

    // Submit form
    await page.getByRole('button', { name: /^create$/i }).click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Bill should appear in the list
    await expect(page.getByText('Professional services rendered')).toBeVisible();
    await expect(page.getByText('Test Vendor Pvt Ltd')).toBeVisible();
    await expect(page.getByText('₹100,000')).toBeVisible(); // Subtotal
    await expect(page.getByText('₹18,000')).toBeVisible(); // GST
    await expect(page.getByText('₹106,200')).toBeVisible(); // Net payable
  });

  test('should create a bill without TDS', async ({ page }) => {
    await page.getByRole('button', { name: /new bill/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/vendor/i).click();
    await page.getByRole('option', { name: /test vendor pvt ltd/i }).click();
    await page.getByLabel(/description/i).fill('Purchase of goods');

    // Add line item
    await page
      .getByLabel(/description/i)
      .first()
      .fill('Office Supplies');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('10');
    await page.getByLabel(/rate/i).first().fill('1000');

    // Don't enable TDS
    await expect(page.getByLabel(/tds deducted/i)).not.toBeChecked();

    // Total should be subtotal + GST (no TDS deduction)
    await expect(page.getByText(/total.*₹11,800/i)).toBeVisible();

    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(page.getByText('Purchase of goods')).toBeVisible();
    await expect(page.getByText('₹11,800')).toBeVisible();
  });

  test('should calculate IGST for inter-state bill', async ({ page }) => {
    // Create vendor in different state
    await page.goto('/entities');
    await page.getByRole('button', { name: /new entity/i }).click();

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/entity name/i).fill('Interstate Vendor');

    // Select VENDOR role
    await page.getByLabel(/entity roles/i).click();
    await page.getByRole('option', { name: /vendor/i }).click();
    await page.keyboard.press('Escape');

    // Submit
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

    // Go to bills page
    await page.goto('/accounting/bills');
    await page.getByRole('button', { name: /new bill/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/vendor/i).click();
    await page.getByRole('option', { name: /interstate vendor/i }).click();
    await page.getByLabel(/description/i).fill('Interstate purchase');

    // Add line item
    await page
      .getByLabel(/description/i)
      .first()
      .fill('Materials');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('10');
    await page.getByLabel(/rate/i).first().fill('1000');

    // Should show IGST instead of CGST+SGST
    await expect(page.getByText(/igst.*18%/i)).toBeVisible();
    await expect(page.getByText(/cgst/i)).not.toBeVisible();
    await expect(page.getByText(/sgst/i)).not.toBeVisible();

    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(page.getByText('Interstate purchase')).toBeVisible();
  });

  test('should edit an existing bill', async ({ page }) => {
    // Create a bill first
    await page.getByRole('button', { name: /new bill/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/vendor/i).click();
    await page.getByRole('option', { name: /test vendor pvt ltd/i }).click();
    await page.getByLabel(/description/i).fill('Original bill');
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

    // Edit the bill
    await page.getByRole('button', { name: /edit/i }).first().click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/description/i)).toHaveValue('Original bill');

    // Update description
    await page.getByLabel(/description/i).clear();
    await page.getByLabel(/description/i).fill('Updated bill');

    // Update quantity
    await page
      .getByLabel(/quantity/i)
      .first()
      .clear();
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('10');

    await page.getByRole('button', { name: /update/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify updates
    await expect(page.getByText('Updated bill')).toBeVisible();
    await expect(page.getByText('Original bill')).not.toBeVisible();
    await expect(page.getByText('₹10,000')).toBeVisible();
  });

  test('should delete a bill', async ({ page }) => {
    // Create a bill first
    await page.getByRole('button', { name: /new bill/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/vendor/i).click();
    await page.getByRole('option', { name: /test vendor pvt ltd/i }).click();
    await page.getByLabel(/description/i).fill('Bill to delete');
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

    // Verify bill exists
    await expect(page.getByText('Bill to delete')).toBeVisible();

    // Delete it
    page.on('dialog', (dialog) => dialog.accept());
    await page
      .getByRole('button', { name: /delete/i })
      .first()
      .click();

    // Bill should be removed
    await expect(page.getByText('Bill to delete')).not.toBeVisible();
    await expect(page.getByText(/no bills found/i)).toBeVisible();
  });

  test('should require vendor selection', async ({ page }) => {
    await page.getByRole('button', { name: /new bill/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/description/i).fill('Test bill');
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

    // Should show error
    await expect(page.getByText(/please select a vendor/i)).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should require at least one line item', async ({ page }) => {
    await page.getByRole('button', { name: /new bill/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/vendor/i).click();
    await page.getByRole('option', { name: /test vendor pvt ltd/i }).click();
    await page.getByLabel(/description/i).fill('Test bill');

    // Don't fill line items
    await page.getByRole('button', { name: /^create$/i }).click();

    // Should show error
    await expect(page.getByText(/please add at least one line item/i)).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should calculate TDS for different sections', async ({ page }) => {
    await page.getByRole('button', { name: /new bill/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/vendor/i).click();
    await page.getByRole('option', { name: /test vendor pvt ltd/i }).click();
    await page.getByLabel(/description/i).fill('Contractor payment');

    // Add line item for ₹100,000
    await page
      .getByLabel(/description/i)
      .first()
      .fill('Construction');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('1');
    await page.getByLabel(/rate/i).first().fill('100000');

    // Enable TDS and select Section 194C (Contractors - 1%)
    await page.getByLabel(/tds deducted/i).check();
    await page.getByLabel(/tds section/i).click();
    await page.getByRole('option', { name: /194c/i }).click();
    await page.getByLabel(/vendor pan/i).fill('ABCDE1234F');

    // TDS should be 1% of (100,000 + 18,000 GST) = 1,180
    await expect(page.getByText(/tds.*₹1,180/i)).toBeVisible();

    // Total: 118,000 - 1,180 = 116,820
    await expect(page.getByText(/total.*₹116,820/i)).toBeVisible();
  });

  test('should handle TDS without PAN (20% rate)', async ({ page }) => {
    await page.getByRole('button', { name: /new bill/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/vendor/i).click();
    await page.getByRole('option', { name: /test vendor pvt ltd/i }).click();
    await page.getByLabel(/description/i).fill('Payment without PAN');

    await page
      .getByLabel(/description/i)
      .first()
      .fill('Service');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('1');
    await page.getByLabel(/rate/i).first().fill('10000');

    // Enable TDS but don't provide PAN
    await page.getByLabel(/tds deducted/i).check();
    await page.getByLabel(/tds section/i).click();
    await page.getByRole('option', { name: /194j/i }).click();
    // Leave PAN empty

    // TDS should be 20% (higher rate for no PAN) of 11,800 = 2,360
    await expect(page.getByText(/tds.*₹2,360/i)).toBeVisible();

    // Total: 11,800 - 2,360 = 9,440
    await expect(page.getByText(/total.*₹9,440/i)).toBeVisible();
  });

  test('should calculate totals correctly for multiple line items', async ({ page }) => {
    await page.getByRole('button', { name: /new bill/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/vendor/i).click();
    await page.getByRole('option', { name: /test vendor pvt ltd/i }).click();
    await page.getByLabel(/description/i).fill('Multi-item bill');

    // Line item 1: 10 × 500 = 5000
    await page
      .getByLabel(/description/i)
      .first()
      .fill('Item 1');
    await page
      .getByLabel(/quantity/i)
      .first()
      .fill('10');
    await page.getByLabel(/rate/i).first().fill('500');

    // Line item 2: 5 × 1000 = 5000
    await page.getByRole('button', { name: /add line item/i }).click();
    await page
      .getByLabel(/description/i)
      .nth(1)
      .fill('Item 2');
    await page
      .getByLabel(/quantity/i)
      .nth(1)
      .fill('5');
    await page.getByLabel(/rate/i).nth(1).fill('1000');

    // Line item 3: 2 × 2500 = 5000
    await page.getByRole('button', { name: /add line item/i }).click();
    await page
      .getByLabel(/description/i)
      .nth(2)
      .fill('Item 3');
    await page
      .getByLabel(/quantity/i)
      .nth(2)
      .fill('2');
    await page.getByLabel(/rate/i).nth(2).fill('2500');

    // Subtotal: 15,000
    await expect(page.getByText(/subtotal.*₹15,000/i)).toBeVisible();

    // GST: 2,700 (18% of 15,000)
    await expect(page.getByText(/total gst.*₹2,700/i)).toBeVisible();

    // Total: 17,700
    await expect(page.getByText(/grand total.*₹17,700/i)).toBeVisible();

    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify in table
    await expect(page.getByText('₹15,000')).toBeVisible();
    await expect(page.getByText('₹2,700')).toBeVisible();
    await expect(page.getByText('₹17,700')).toBeVisible();
  });

  test('should generate GL entries automatically', async ({ page }) => {
    // Create a bill
    await page.getByRole('button', { name: /new bill/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/^date$/i).fill(today);
    await page.getByLabel(/vendor/i).click();
    await page.getByRole('option', { name: /test vendor pvt ltd/i }).click();
    await page.getByLabel(/description/i).fill('GL test bill');
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
    // For now, we verify the bill was created successfully
    await expect(page.getByText('GL test bill')).toBeVisible();
  });
});
