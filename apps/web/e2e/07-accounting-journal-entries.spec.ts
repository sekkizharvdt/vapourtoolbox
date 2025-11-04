import { test, expect } from '@playwright/test';
import { loginAsTestUser, clearFirestoreEmulator } from './helpers/auth';

test.describe('Accounting - Journal Entries', () => {
  test.beforeEach(async ({ page }) => {
    // Clear Firestore emulator before each test
    await clearFirestoreEmulator();

    // Login as test user
    await loginAsTestUser(page);

    // Create test accounts first
    await page.goto('/accounting/chart-of-accounts');

    const testAccounts = [
      { code: '1100', name: 'Cash', type: 'Asset' },
      { code: '1200', name: 'Accounts Receivable', type: 'Asset' },
      { code: '2100', name: 'Accounts Payable', type: 'Liability' },
      { code: '4100', name: 'Sales Revenue', type: 'Revenue' },
      { code: '5100', name: 'Cost of Sales', type: 'Expense' },
      { code: '6100', name: 'Rent Expense', type: 'Expense' },
    ];

    for (const account of testAccounts) {
      await page.getByRole('button', { name: /create account/i }).click();
      await page.getByLabel(/account code/i).fill(account.code);
      await page.getByLabel(/account name/i).fill(account.name);
      await page.getByLabel(/account type/i).click();
      await page.getByRole('option', { name: account.type }).click();
      await page.getByRole('button', { name: /create/i }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }

    // Navigate to Journal Entries page
    await page.goto('/accounting/journal-entries');
  });

  test('should display the Journal Entries page', async ({ page }) => {
    // Check page title
    await expect(page.locator('h4')).toContainText('Journal Entries');

    // Should show "Create Journal Entry" button
    await expect(page.getByRole('button', { name: /create journal entry/i })).toBeVisible();
  });

  test('should create a balanced journal entry', async ({ page }) => {
    // Click "Create Journal Entry" button
    await page.getByRole('button', { name: /create journal entry/i }).click();

    // Dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Create Journal Entry')).toBeVisible();

    // Fill date (today)
    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/date/i).fill(today);

    // Fill description
    await page.getByLabel(/description/i).fill('Test journal entry for rent payment');

    // Fill reference
    await page.getByLabel(/reference/i).fill('REF-001');

    // Add ledger entries
    // Entry 1: Debit Rent Expense ₹10,000
    const firstAccountSelector = page.locator('[data-testid="account-selector"]').first();
    await firstAccountSelector.click();
    await page.getByRole('option', { name: /rent expense/i }).click();

    const firstDebitInput = page
      .locator('input[type="number"]')
      .filter({ hasText: /debit/i })
      .first();
    await firstDebitInput.fill('10000');

    // Entry 2: Credit Cash ₹10,000
    await page.getByRole('button', { name: /add entry/i }).click();

    const secondAccountSelector = page.locator('[data-testid="account-selector"]').nth(1);
    await secondAccountSelector.click();
    await page.getByRole('option', { name: /cash/i }).click();

    const firstCreditInput = page
      .locator('input[type="number"]')
      .filter({ hasText: /credit/i })
      .nth(1);
    await firstCreditInput.fill('10000');

    // Should show "Balanced" indicator
    await expect(page.getByText(/balanced/i)).toBeVisible();

    // Submit form
    await page.getByRole('button', { name: /create/i }).click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Journal entry should appear in the list
    await expect(page.getByText('Test journal entry for rent payment')).toBeVisible();
    await expect(page.getByText('REF-001')).toBeVisible();
  });

  test('should prevent unbalanced journal entries', async ({ page }) => {
    // Click "Create Journal Entry" button
    await page.getByRole('button', { name: /create journal entry/i }).click();

    // Fill basic info
    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/date/i).fill(today);
    await page.getByLabel(/description/i).fill('Unbalanced entry test');

    // Add only one entry: Debit ₹5,000
    const firstAccountSelector = page.locator('[data-testid="account-selector"]').first();
    await firstAccountSelector.click();
    await page.getByRole('option', { name: /rent expense/i }).click();

    const firstDebitInput = page
      .locator('input[type="number"]')
      .filter({ hasText: /debit/i })
      .first();
    await firstDebitInput.fill('5000');

    // Should show "Out of balance" warning
    await expect(page.getByText(/out of balance/i)).toBeVisible();

    // Try to submit - should fail
    await page.getByRole('button', { name: /create/i }).click();

    // Should show error message
    await expect(page.getByText(/debits and credits must be equal/i)).toBeVisible();

    // Dialog should still be open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should require at least two ledger entries', async ({ page }) => {
    // Click "Create Journal Entry" button
    await page.getByRole('button', { name: /create journal entry/i }).click();

    // Fill basic info
    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/date/i).fill(today);
    await page.getByLabel(/description/i).fill('Single entry test');

    // Try to remove one of the default entries
    const removeButtons = page.getByRole('button', { name: /delete/i });
    const count = await removeButtons.count();

    if (count > 2) {
      // Remove entries until only 2 remain
      for (let i = count; i > 2; i--) {
        await removeButtons.last().click();
      }
    }

    // Try to remove one more - should show error or be disabled
    await removeButtons.first().click();
    await expect(page.getByText(/at least two ledger entries are required/i)).toBeVisible();
  });

  test('should support multiple debits and credits', async ({ page }) => {
    // Create a compound journal entry (multiple debits, multiple credits)
    await page.getByRole('button', { name: /create journal entry/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/date/i).fill(today);
    await page.getByLabel(/description/i).fill('Compound journal entry');

    // Debit 1: Rent Expense ₹8,000
    // Debit 2: Cost of Sales ₹2,000
    // Credit: Cash ₹10,000

    // Entry 1: Debit Rent ₹8,000
    const selectors = page.locator('[data-testid="account-selector"]');
    await selectors.nth(0).click();
    await page.getByRole('option', { name: /rent expense/i }).click();

    const debitInputs = page.locator('input[name*="debit"]');
    await debitInputs.nth(0).fill('8000');

    // Add another entry
    await page.getByRole('button', { name: /add entry/i }).click();

    // Entry 2: Debit Cost of Sales ₹2,000
    await selectors.nth(1).click();
    await page.getByRole('option', { name: /cost of sales/i }).click();
    await debitInputs.nth(1).fill('2000');

    // Add another entry
    await page.getByRole('button', { name: /add entry/i }).click();

    // Entry 3: Credit Cash ₹10,000
    await selectors.nth(2).click();
    await page.getByRole('option', { name: /cash/i }).click();

    const creditInputs = page.locator('input[name*="credit"]');
    await creditInputs.nth(2).fill('10000');

    // Should be balanced
    await expect(page.getByText(/balanced/i)).toBeVisible();

    // Submit
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify entry was created
    await expect(page.getByText('Compound journal entry')).toBeVisible();
  });

  test('should generate sequential transaction numbers', async ({ page }) => {
    // Create first journal entry
    await page.getByRole('button', { name: /create journal entry/i }).click();
    await fillBasicJournalEntry(page, 'First entry', 5000);
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Get transaction number
    const firstNumber = await page
      .locator('[data-testid="transaction-number"]')
      .first()
      .textContent();

    // Create second journal entry
    await page.getByRole('button', { name: /create journal entry/i }).click();
    await fillBasicJournalEntry(page, 'Second entry', 3000);
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Get second transaction number
    const secondNumber = await page
      .locator('[data-testid="transaction-number"]')
      .first()
      .textContent();

    // Numbers should be sequential
    expect(firstNumber).toBeTruthy();
    expect(secondNumber).toBeTruthy();
    expect(secondNumber).not.toBe(firstNumber);
  });

  test('should allow editing a journal entry', async ({ page }) => {
    // Create a journal entry
    await page.getByRole('button', { name: /create journal entry/i }).click();
    await fillBasicJournalEntry(page, 'Original description', 7500);
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Click edit button
    await page.getByText('Original description').hover();
    await page.getByRole('button', { name: /edit/i }).first().click();

    // Dialog should open with existing data
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/description/i)).toHaveValue('Original description');

    // Update description
    await page.getByLabel(/description/i).clear();
    await page.getByLabel(/description/i).fill('Updated description');

    // Submit
    await page.getByRole('button', { name: /update/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify update
    await expect(page.getByText('Updated description')).toBeVisible();
    await expect(page.getByText('Original description')).not.toBeVisible();
  });

  test('should filter journal entries by date range', async ({ page }) => {
    // Create entries on different dates
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0]!;

    const today = new Date().toISOString().split('T')[0]!;

    // Create entry for yesterday
    await page.getByRole('button', { name: /create journal entry/i }).click();
    await page.getByLabel(/date/i).fill(yesterdayStr);
    await page.getByLabel(/description/i).fill('Yesterday entry');
    await fillJournalEntryAccounts(page, 5000);
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Create entry for today
    await page.getByRole('button', { name: /create journal entry/i }).click();
    await page.getByLabel(/date/i).fill(today);
    await page.getByLabel(/description/i).fill('Today entry');
    await fillJournalEntryAccounts(page, 3000);
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Filter by today only
    await page.getByLabel(/start date/i).fill(today);
    await page.getByLabel(/end date/i).fill(today);
    await page.getByRole('button', { name: /filter/i }).click();

    // Should only show today's entry
    await expect(page.getByText('Today entry')).toBeVisible();
    await expect(page.getByText('Yesterday entry')).not.toBeVisible();
  });

  test('should support project/cost centre allocation', async ({ page }) => {
    // This test assumes projects/cost centres exist
    // Create journal entry with project allocation
    await page.getByRole('button', { name: /create journal entry/i }).click();

    const today = new Date().toISOString().split('T')[0]!;
    await page.getByLabel(/date/i).fill(today);
    await page.getByLabel(/description/i).fill('Project expense');

    // Select a project
    await page.getByLabel(/project/i).click();
    await page.getByRole('option').first().click();

    await fillJournalEntryAccounts(page, 15000);

    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify entry shows project
    await expect(page.getByText('Project expense')).toBeVisible();
  });
});

// Helper function to fill basic journal entry
async function fillBasicJournalEntry(page: any, description: string, amount: number) {
  const today = new Date().toISOString().split('T')[0]!;
  await page.getByLabel(/date/i).fill(today);
  await page.getByLabel(/description/i).fill(description);
  await fillJournalEntryAccounts(page, amount);
}

// Helper function to fill accounts with balanced debit/credit
async function fillJournalEntryAccounts(page: any, amount: number) {
  // Debit: Rent Expense
  const selectors = page.locator('[data-testid="account-selector"]');
  await selectors.first().click();
  await page.getByRole('option', { name: /rent expense/i }).click();

  const debitInputs = page.locator('input[name*="debit"]');
  await debitInputs.first().fill(amount.toString());

  // Credit: Cash
  await selectors.nth(1).click();
  await page.getByRole('option', { name: /cash/i }).click();

  const creditInputs = page.locator('input[name*="credit"]');
  await creditInputs.nth(1).fill(amount.toString());
}
