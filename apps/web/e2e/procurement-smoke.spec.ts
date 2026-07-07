/**
 * Procurement smoke test (@smoke)
 *
 * Asserts the PO list renders seeded purchase orders with the correct
 * workflow-status labels, and that terminal-state rows hide destructive
 * actions (CLAUDE.md rule 10 at the list level).
 *
 * WHY THIS DOESN'T WALK THE FULL TWO-APPROVER FLOW: the approval actions
 * live on the PO detail page (/procurement/pos/[id]), and under
 * `output: 'export'` the `next dev` server CANNOT render any dynamic [id]
 * route for a real document id — generateStaticParams() declares only
 * 'placeholder', and dev hard-errors ("missing param ... required with
 * output: export") on BOTH hard navigation (page.goto) and client-side
 * router.push. Production only works because firebase.json hosting
 * rewrites serve the placeholder HTML for every URL and the client
 * re-parses the real id from the pathname (rule 30). Verified empirically
 * 2026-07-06 — see the Phase 4 execution notes in
 * docs/archive/2026-07-05-automated-verification-plan.md. Extending smoke
 * coverage to detail pages requires running against a real emulator-mode
 * `next build` served by the Firebase hosting emulator (production-faithful
 * rewrites); that is recorded there as the follow-up, not attempted here.
 * The two-approver transition logic itself is enforced server-side by
 * firestore.rules (Phase 3 rules tests) and the state machine.
 *
 * Requires Firebase emulators + the dev server in emulator mode (see
 * auth.setup.ts). POs are seeded directly via firebase-admin.
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

function basePO(poNumber: string, overrides: Record<string, unknown>) {
  const now = admin.firestore.Timestamp.now();
  return {
    number: poNumber,
    tenantId: 'default-entity',
    rfqId: 'e2e-rfq-smoke',
    offerId: 'e2e-offer-smoke',
    selectedOfferNumber: 'OFFER/SMOKE/0001',
    vendorId: 'e2e-entity-active-vendor',
    vendorName: 'E2E Test Vendor',
    projectIds: [],
    projectNames: [],
    title: 'E2E Smoke PO',
    subtotal: 10000,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalTax: 0,
    grandTotal: 10000,
    currency: 'INR',
    paymentTerms: 'Net 30',
    deliveryTerms: 'FOB',
    otherClauses: [],
    deliveryAddress: '1 Smoke Test Way',
    pdfVersion: 1,
    advancePaymentRequired: false,
    deliveryProgress: 0,
    paymentProgress: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: 'e2e-po-creator',
    updatedBy: 'e2e-po-creator',
    ...overrides,
  };
}

test.describe('Procurement smoke @smoke', () => {
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

  test('PO list shows workflow status labels; terminal rows hide destructive actions', async ({
    page,
  }) => {
    test.setTimeout(60000);

    const db = getAdminFirestore();
    const runId = Date.now();
    const pendingNumber = `PO-SMOKE-PENDING-${runId}`;
    const completedNumber = `PO-SMOKE-DONE-${runId}`;

    await db
      .collection('purchaseOrders')
      .add(basePO(pendingNumber, { status: 'PENDING_APPROVAL' }));
    await db.collection('purchaseOrders').add(basePO(completedNumber, { status: 'COMPLETED' }));

    await page.goto('/procurement/pos');
    await page.waitForLoadState('domcontentloaded');

    // Status labels come from getPOStatusText via the row's Chip (rule 29).
    const pendingRow = page.locator('tr').filter({ hasText: pendingNumber });
    await expect(pendingRow).toBeVisible({ timeout: 15000 });
    await expect(pendingRow.getByText('Pending First Approval')).toBeVisible();

    const completedRow = page.locator('tr').filter({ hasText: completedNumber });
    await expect(completedRow).toBeVisible();
    await expect(completedRow.getByText('Completed', { exact: true })).toBeVisible();

    // Rule 10 at the list level: Move to Trash only offered while the PO is
    // still DRAFT / PENDING_APPROVAL — a COMPLETED PO must not offer it.
    await expect(pendingRow.getByRole('button', { name: 'Move to Trash' })).toBeVisible();
    await expect(completedRow.getByRole('button', { name: 'Move to Trash' })).toHaveCount(0);
  });
});
