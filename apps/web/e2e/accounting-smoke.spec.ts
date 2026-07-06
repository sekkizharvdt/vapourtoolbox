/**
 * Accounting money-path smoke test (@smoke)
 *
 * Creates a customer invoice, records a full payment against it, and
 * asserts the invoice's outstanding amount reaches zero. This is the
 * deploy-gate check (Phase 4) — proves the invoice → GL → payment
 * allocation path works end-to-end against a real emulator + real
 * firestore.rules before hosting/functions/rules ship.
 *
 * Requires Firebase emulators + the dev server in emulator mode (see
 * auth.setup.ts). The fixtures this flow depends on — a minimal Chart of
 * Accounts (Accounts Receivable code 1200, Revenue code 4100, both
 * isSystemAccount per systemAccountResolver; a bank account with
 * isBankAccount: true) and a CUSTOMER-role entity (role casing must match
 * the EntityRole enum: 'CUSTOMER', not 'customer') — are seeded idempotently
 * in beforeAll below via firebase-admin, so the spec is self-contained.
 */

import { test, expect } from '@playwright/test';
import * as admin from 'firebase-admin';
import { isTestUserReady, signInForTest } from './auth.helpers';

function getAdminFirestore() {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST)
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  if (!process.env.FIRESTORE_EMULATOR_HOST) process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vapour-toolbox',
    });
  }
  return admin.firestore();
}

async function seedAccountingFixtures() {
  const db = getAdminFirestore();
  const now = admin.firestore.Timestamp.now();
  const account = (overrides: Record<string, unknown>) => ({
    tenantId: 'default-entity',
    isGroup: false,
    isActive: true,
    currentBalance: 0,
    debit: 0,
    credit: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
  await db
    .collection('accounts')
    .doc('e2e-acc-ar')
    .set(
      account({
        code: '1200',
        name: 'Trade Receivables (Debtors)',
        accountType: 'ASSET',
        isSystemAccount: true,
        isBankAccount: false,
      })
    );
  await db
    .collection('accounts')
    .doc('e2e-acc-revenue')
    .set(
      account({
        code: '4100',
        name: 'Sales Revenue',
        accountType: 'INCOME',
        isSystemAccount: true,
        isBankAccount: false,
      })
    );
  await db
    .collection('accounts')
    .doc('e2e-acc-bank')
    .set(
      account({
        code: '1100',
        name: 'E2E Test Bank',
        accountType: 'ASSET',
        isSystemAccount: false,
        isBankAccount: true,
      })
    );
  await db
    .collection('entities')
    .doc('e2e-smoke-customer')
    .set({
      code: 'ENT-SMOKE-001',
      name: 'E2E Smoke Customer',
      nameNormalized: 'e2e smoke customer',
      roles: ['CUSTOMER'],
      contactPerson: 'Smoke Test',
      email: 'smoke-customer@e2etest.com',
      phone: '+1234567899',
      billingAddress: {
        street: '1 Smoke St',
        city: 'Test City',
        state: 'Test State',
        country: 'USA',
        postalCode: '12345',
      },
      isActive: true,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
}

test.describe('Accounting money-path smoke @smoke', () => {
  test.beforeAll(async () => {
    await seedAccountingFixtures();
  });

  test.beforeEach(async ({ page }) => {
    const testUserReady = await isTestUserReady();
    if (!testUserReady) {
      test.skip(true, 'Test user not ready - Firebase emulator may not be running');
      return;
    }
    const signedIn = await signInForTest(page);
    if (!signedIn) {
      test.skip(true, 'Could not sign in');
    }
  });

  test('create invoice, record payment, outstanding reaches zero', async ({ page }) => {
    test.setTimeout(60000);
    const invoiceAmount = 10000;
    // Unique per run (incl. CI retries) so the final list-row lookup can
    // never collide with a stale invoice from an earlier attempt.
    const invoiceDescription = `E2E smoke test invoice ${Date.now()}`;

    // ── Step 1: create a POSTED customer invoice ──────────────────────────
    await page.goto('/accounting/invoices');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'New Invoice' }).click();
    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible({ timeout: 10000 });

    // MUI Autocomplete renders its option listbox in a body-level portal, not
    // nested inside the dialog — options must be queried from `page`, not
    // `createDialog`.
    await createDialog.getByLabel('Customer').fill('E2E Smoke Customer');
    await page.getByRole('option', { name: /E2E Smoke Customer/i }).click();

    await createDialog.getByLabel('Status').click();
    await page.getByRole('option', { name: 'Posted' }).click();

    await createDialog.getByLabel('Description').fill(invoiceDescription);

    // Default line item row: Description | Account | Qty | Unit Price | GST % | HSN | Amount (computed)
    const lineItemRow = createDialog.getByRole('row').filter({ has: page.getByRole('spinbutton') });
    await lineItemRow.getByRole('textbox').first().fill('E2E smoke line item');
    const unitPriceInput = lineItemRow.getByRole('spinbutton').nth(1);
    await unitPriceInput.fill(String(invoiceAmount));
    await unitPriceInput.blur();

    await createDialog.getByRole('button', { name: 'Create' }).click();
    await expect(createDialog).not.toBeVisible({ timeout: 15000 });

    // Invoice should now be in the list
    await expect(page.getByText(invoiceDescription).first()).toBeVisible({ timeout: 10000 });

    // ── Step 2: record a full payment against it ──────────────────────────
    await page.goto('/accounting/payments');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Customer Receipt', exact: true }).click();
    const paymentDialog = page.getByRole('dialog');
    await expect(paymentDialog).toBeVisible({ timeout: 10000 });

    await paymentDialog.getByLabel('Customer').fill('E2E Smoke Customer');
    await page.getByRole('option', { name: /E2E Smoke Customer/i }).click();

    await paymentDialog
      .getByLabel(/^Amount/i)
      .first()
      .fill(String(invoiceAmount));

    await paymentDialog.getByLabel('Bank Account (Received in)').fill('E2E Test Bank');
    await page.getByRole('option', { name: /E2E Test Bank/i }).click();

    // Auto-allocate the payment across outstanding invoices (oldest first)
    const autoAllocateButton = paymentDialog.getByRole('button', { name: /Auto.?Allocate/i });
    if (await autoAllocateButton.isVisible().catch(() => false)) {
      await autoAllocateButton.click();
    }

    await paymentDialog
      .getByRole('button', { name: /Save|Record|Create/i })
      .last()
      .click();
    await expect(paymentDialog).not.toBeVisible({ timeout: 15000 });

    // ── Step 3: outstanding on the invoice should now be zero ─────────────
    // The invoices list table has no per-row outstanding/paid-status column
    // (only the "Outstanding (INR)" stat card, which aggregates every
    // invoice in the system) — verify the actual persisted state directly
    // instead of guessing at a UI element that doesn't exist.
    const db = getAdminFirestore();
    const snapshot = await db
      .collection('transactions')
      .where('type', '==', 'CUSTOMER_INVOICE')
      .where('description', '==', invoiceDescription)
      .get();
    expect(snapshot.empty).toBe(false);
    const invoiceData = snapshot.docs[0]!.data();
    expect(invoiceData.outstandingAmount).toBeLessThan(0.01);
    expect(invoiceData.paymentStatus).toBe('PAID');
  });
});
