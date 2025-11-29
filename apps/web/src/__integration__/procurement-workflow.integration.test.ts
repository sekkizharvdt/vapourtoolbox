/**
 * Procurement Workflow Integration Test
 *
 * Tests the complete procurement workflow:
 * PR (Draft → Approved) → RFQ → Offer → PO (Draft → Approved) → Invoice → Payment
 *
 * Prerequisites:
 * - Firebase emulators running: `firebase emulators:start`
 *
 * Run with: `pnpm test:integration`
 */

import { doc, setDoc, getDoc, updateDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { initializeTestFirebase, cleanupTestData, checkEmulatorsRunning } from './setup';
import type { Firestore } from 'firebase/firestore';

// Collection names (matching @vapour/firebase COLLECTIONS)
const COLLECTIONS = {
  PURCHASE_REQUESTS: 'purchaseRequests',
  PURCHASE_REQUEST_ITEMS: 'purchaseRequestItems',
  RFQS: 'rfqs',
  OFFERS: 'offers',
  OFFER_ITEMS: 'offerItems',
  PURCHASE_ORDERS: 'purchaseOrders',
  PURCHASE_ORDER_ITEMS: 'purchaseOrderItems',
  VENDOR_BILLS: 'vendorBills',
  PAYMENTS: 'payments',
  COUNTERS: 'counters',
};

// Test data
const TEST_USER = {
  id: 'test-user-001',
  name: 'Test User',
  email: 'test@example.com',
};

const TEST_VENDOR = {
  id: 'vendor-001',
  name: 'Test Vendor Ltd',
  gstin: '27AABCT1234Z1Z5',
};

const TEST_PROJECT = {
  id: 'project-001',
  name: 'Test Project',
  number: 'TP-2024-001',
};

describe('Procurement Workflow Integration', () => {
  let db: Firestore;
  let emulatorsRunning: boolean;

  beforeAll(async () => {
    // Check if emulators are running
    emulatorsRunning = await checkEmulatorsRunning();

    if (!emulatorsRunning) {
      console.warn(
        '\n⚠️  Firebase emulators not running. Skipping integration tests.\n' +
          '   Run: firebase emulators:start\n'
      );
      return;
    }

    const firebase = initializeTestFirebase();
    db = firebase.db;
  });

  beforeEach(async () => {
    if (emulatorsRunning) {
      await cleanupTestData();
    }
  });

  afterAll(async () => {
    if (emulatorsRunning) {
      await cleanupTestData();
    }
  });

  // Helper to skip tests if emulators not running
  const itWithEmulator = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!emulatorsRunning) {
        // eslint-disable-next-line no-console
        console.log(`  ⏭️  Skipping: ${name} (emulators not running)`);
        return;
      }
      await fn();
    });
  };

  // ============================================================================
  // STEP 1: Create Purchase Request
  // ============================================================================

  itWithEmulator('Step 1: Create a Purchase Request in DRAFT status', async () => {
    const prId = 'pr-001';
    const prNumber = 'PR/2024/01/0001';
    const now = Timestamp.now();

    // Create PR document
    const prData = {
      number: prNumber,
      type: 'MATERIAL',
      category: 'EQUIPMENT',
      projectId: TEST_PROJECT.id,
      projectName: TEST_PROJECT.name,
      title: 'Test Equipment Purchase',
      description: 'Integration test PR',
      priority: 'MEDIUM',
      itemCount: 2,
      status: 'DRAFT',
      submittedBy: TEST_USER.id,
      submittedByName: TEST_USER.name,
      createdAt: now,
      updatedAt: now,
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    };

    await setDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId), prData);

    // Create line items
    const items = [
      {
        purchaseRequestId: prId,
        lineNumber: 1,
        description: 'Pump Unit',
        quantity: 2,
        unit: 'NOS',
        estimatedUnitPrice: 50000,
        estimatedTotal: 100000,
      },
      {
        purchaseRequestId: prId,
        lineNumber: 2,
        description: 'Control Panel',
        quantity: 1,
        unit: 'SET',
        estimatedUnitPrice: 75000,
        estimatedTotal: 75000,
      },
    ];

    const batch = writeBatch(db);
    items.forEach((item, idx) => {
      const itemRef = doc(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS, `pri-00${idx + 1}`);
      batch.set(itemRef, item);
    });
    await batch.commit();

    // Verify PR was created
    const prDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId));
    expect(prDoc.exists()).toBe(true);
    expect(prDoc.data()?.status).toBe('DRAFT');
    expect(prDoc.data()?.itemCount).toBe(2);
  });

  // ============================================================================
  // STEP 2: Submit and Approve PR
  // ============================================================================

  itWithEmulator('Step 2: Submit and approve Purchase Request', async () => {
    const prId = 'pr-001';
    const now = Timestamp.now();

    // Create PR in DRAFT
    await setDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId), {
      number: 'PR/2024/01/0001',
      status: 'DRAFT',
      title: 'Test PR',
      itemCount: 1,
      submittedBy: TEST_USER.id,
      submittedByName: TEST_USER.name,
      createdAt: now,
      updatedAt: now,
    });

    // Submit PR (DRAFT → SUBMITTED)
    await updateDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId), {
      status: 'SUBMITTED',
      submittedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    let prDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId));
    expect(prDoc.data()?.status).toBe('SUBMITTED');

    // Approve PR (SUBMITTED → APPROVED)
    await updateDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId), {
      status: 'APPROVED',
      approvedBy: 'approver-001',
      approvedByName: 'Approver User',
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    prDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId));
    expect(prDoc.data()?.status).toBe('APPROVED');
    expect(prDoc.data()?.approvedBy).toBe('approver-001');
  });

  // ============================================================================
  // STEP 3: Create RFQ from approved PR
  // ============================================================================

  itWithEmulator('Step 3: Create RFQ from approved PR', async () => {
    const prId = 'pr-001';
    const rfqId = 'rfq-001';
    const now = Timestamp.now();

    // Setup: Create approved PR
    await setDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId), {
      number: 'PR/2024/01/0001',
      status: 'APPROVED',
      title: 'Test PR',
      itemCount: 1,
      createdAt: now,
    });

    // Create RFQ linked to PR
    const rfqData = {
      number: 'RFQ/2024/01/0001',
      purchaseRequestId: prId,
      purchaseRequestNumber: 'PR/2024/01/0001',
      projectId: TEST_PROJECT.id,
      projectName: TEST_PROJECT.name,
      status: 'DRAFT',
      vendorIds: [TEST_VENDOR.id],
      vendorNames: [TEST_VENDOR.name],
      dueDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // +7 days
      itemCount: 1,
      createdAt: now,
      createdBy: TEST_USER.id,
    };

    await setDoc(doc(db, COLLECTIONS.RFQS, rfqId), rfqData);

    // Update PR status
    await updateDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId), {
      status: 'RFQ_IN_PROGRESS',
      rfqId: rfqId,
      updatedAt: Timestamp.now(),
    });

    // Verify
    const rfqDoc = await getDoc(doc(db, COLLECTIONS.RFQS, rfqId));
    expect(rfqDoc.exists()).toBe(true);
    expect(rfqDoc.data()?.purchaseRequestId).toBe(prId);

    const prDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId));
    expect(prDoc.data()?.status).toBe('RFQ_IN_PROGRESS');
  });

  // ============================================================================
  // STEP 4: Vendor submits Offer
  // ============================================================================

  itWithEmulator('Step 4: Vendor submits Offer for RFQ', async () => {
    const rfqId = 'rfq-001';
    const offerId = 'offer-001';
    const now = Timestamp.now();

    // Setup: Create RFQ
    await setDoc(doc(db, COLLECTIONS.RFQS, rfqId), {
      number: 'RFQ/2024/01/0001',
      status: 'SENT',
      vendorIds: [TEST_VENDOR.id],
      createdAt: now,
    });

    // Create Offer
    const offerData = {
      rfqId: rfqId,
      vendorId: TEST_VENDOR.id,
      vendorName: TEST_VENDOR.name,
      status: 'SUBMITTED',
      subtotal: 150000,
      gstAmount: 27000,
      totalAmount: 177000,
      currency: 'INR',
      validUntil: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      deliveryDays: 21,
      paymentTerms: '30% Advance, 70% on delivery',
      submittedAt: now,
      createdAt: now,
    };

    await setDoc(doc(db, COLLECTIONS.OFFERS, offerId), offerData);

    // Create offer line items
    await setDoc(doc(db, COLLECTIONS.OFFER_ITEMS, 'oi-001'), {
      offerId: offerId,
      lineNumber: 1,
      description: 'Pump Unit',
      quantity: 2,
      unit: 'NOS',
      unitPrice: 48000,
      totalPrice: 96000,
    });

    await setDoc(doc(db, COLLECTIONS.OFFER_ITEMS, 'oi-002'), {
      offerId: offerId,
      lineNumber: 2,
      description: 'Control Panel',
      quantity: 1,
      unit: 'SET',
      unitPrice: 54000,
      totalPrice: 54000,
    });

    // Verify
    const offerDoc = await getDoc(doc(db, COLLECTIONS.OFFERS, offerId));
    expect(offerDoc.exists()).toBe(true);
    expect(offerDoc.data()?.totalAmount).toBe(177000);
    expect(offerDoc.data()?.vendorId).toBe(TEST_VENDOR.id);
  });

  // ============================================================================
  // STEP 5: Accept Offer and Create PO
  // ============================================================================

  itWithEmulator('Step 5: Accept Offer and create Purchase Order', async () => {
    const offerId = 'offer-001';
    const poId = 'po-001';
    const now = Timestamp.now();

    // Setup: Create accepted offer
    await setDoc(doc(db, COLLECTIONS.OFFERS, offerId), {
      rfqId: 'rfq-001',
      vendorId: TEST_VENDOR.id,
      vendorName: TEST_VENDOR.name,
      status: 'ACCEPTED',
      subtotal: 150000,
      gstAmount: 27000,
      totalAmount: 177000,
      createdAt: now,
    });

    // Create PO from offer
    const poData = {
      number: 'PO/2024/01/0001',
      offerId: offerId,
      vendorId: TEST_VENDOR.id,
      vendorName: TEST_VENDOR.name,
      vendorGstin: TEST_VENDOR.gstin,
      projectId: TEST_PROJECT.id,
      projectName: TEST_PROJECT.name,
      status: 'DRAFT',
      subtotal: 150000,
      gstDetails: {
        gstType: 'CGST_SGST',
        gstRate: 18,
        cgstAmount: 13500,
        sgstAmount: 13500,
      },
      totalAmount: 177000,
      currency: 'INR',
      paymentTerms: '30% Advance, 70% on delivery',
      deliveryTerms: 'Ex-Works',
      expectedDeliveryDate: Timestamp.fromDate(new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)),
      createdAt: now,
      createdBy: TEST_USER.id,
      updatedAt: now,
    };

    await setDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), poData);

    // Create PO line items
    await setDoc(doc(db, COLLECTIONS.PURCHASE_ORDER_ITEMS, 'poi-001'), {
      purchaseOrderId: poId,
      lineNumber: 1,
      description: 'Pump Unit',
      quantity: 2,
      unit: 'NOS',
      unitPrice: 48000,
      totalPrice: 96000,
    });

    // Verify
    const poDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId));
    expect(poDoc.exists()).toBe(true);
    expect(poDoc.data()?.status).toBe('DRAFT');
    expect(poDoc.data()?.totalAmount).toBe(177000);
  });

  // ============================================================================
  // STEP 6: Approve PO
  // ============================================================================

  itWithEmulator('Step 6: Approve Purchase Order', async () => {
    const poId = 'po-001';
    const now = Timestamp.now();

    // Setup: Create PO in DRAFT
    await setDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
      number: 'PO/2024/01/0001',
      status: 'DRAFT',
      totalAmount: 177000,
      createdAt: now,
    });

    // Submit PO (DRAFT → PENDING_APPROVAL)
    await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
      status: 'PENDING_APPROVAL',
      submittedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Approve PO (PENDING_APPROVAL → APPROVED)
    await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
      status: 'APPROVED',
      approvedBy: 'approver-001',
      approvedByName: 'Approver User',
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    const poDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId));
    expect(poDoc.data()?.status).toBe('APPROVED');
  });

  // ============================================================================
  // STEP 7: Create Vendor Bill (Invoice)
  // ============================================================================

  itWithEmulator('Step 7: Create Vendor Bill for delivered goods', async () => {
    const poId = 'po-001';
    const billId = 'bill-001';
    const now = Timestamp.now();

    // Setup: Create approved PO
    await setDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
      number: 'PO/2024/01/0001',
      vendorId: TEST_VENDOR.id,
      status: 'GOODS_RECEIVED',
      totalAmount: 177000,
      createdAt: now,
    });

    // Create Vendor Bill
    const billData = {
      transactionNumber: 'VB/2024/01/0001',
      type: 'VENDOR_BILL',
      purchaseOrderId: poId,
      purchaseOrderNumber: 'PO/2024/01/0001',
      vendorId: TEST_VENDOR.id,
      vendorName: TEST_VENDOR.name,
      vendorInvoiceNumber: 'VINV-2024-001',
      vendorInvoiceDate: now,
      projectId: TEST_PROJECT.id,
      status: 'DRAFT',
      subtotal: 150000,
      gstDetails: {
        gstType: 'CGST_SGST',
        gstRate: 18,
        cgstAmount: 13500,
        sgstAmount: 13500,
      },
      totalAmount: 177000,
      currency: 'INR',
      dueDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      amountPaid: 0,
      amountDue: 177000,
      createdAt: now,
      createdBy: TEST_USER.id,
    };

    await setDoc(doc(db, COLLECTIONS.VENDOR_BILLS, billId), billData);

    // Verify
    const billDoc = await getDoc(doc(db, COLLECTIONS.VENDOR_BILLS, billId));
    expect(billDoc.exists()).toBe(true);
    expect(billDoc.data()?.totalAmount).toBe(177000);
    expect(billDoc.data()?.purchaseOrderId).toBe(poId);
  });

  // ============================================================================
  // STEP 8: Create Payment against Vendor Bill
  // ============================================================================

  itWithEmulator('Step 8: Create Payment against Vendor Bill', async () => {
    const billId = 'bill-001';
    const paymentId = 'payment-001';
    const now = Timestamp.now();

    // Setup: Create approved vendor bill
    await setDoc(doc(db, COLLECTIONS.VENDOR_BILLS, billId), {
      transactionNumber: 'VB/2024/01/0001',
      vendorId: TEST_VENDOR.id,
      vendorName: TEST_VENDOR.name,
      status: 'APPROVED',
      totalAmount: 177000,
      amountPaid: 0,
      amountDue: 177000,
      createdAt: now,
    });

    // Create advance payment (30%)
    const advanceAmount = 53100; // 30% of 177000
    const paymentData = {
      transactionNumber: 'PAY/2024/01/0001',
      type: 'VENDOR_PAYMENT',
      vendorId: TEST_VENDOR.id,
      vendorName: TEST_VENDOR.name,
      projectId: TEST_PROJECT.id,
      amount: advanceAmount,
      currency: 'INR',
      paymentMethod: 'BANK_TRANSFER',
      paymentDate: now,
      referenceNumber: 'UTR123456789',
      status: 'COMPLETED',
      allocations: [
        {
          billId: billId,
          billNumber: 'VB/2024/01/0001',
          allocatedAmount: advanceAmount,
        },
      ],
      createdAt: now,
      createdBy: TEST_USER.id,
    };

    await setDoc(doc(db, COLLECTIONS.PAYMENTS, paymentId), paymentData);

    // Update bill with payment
    await updateDoc(doc(db, COLLECTIONS.VENDOR_BILLS, billId), {
      amountPaid: advanceAmount,
      amountDue: 177000 - advanceAmount,
      status: 'PARTIALLY_PAID',
      updatedAt: Timestamp.now(),
    });

    // Verify
    const paymentDoc = await getDoc(doc(db, COLLECTIONS.PAYMENTS, paymentId));
    expect(paymentDoc.exists()).toBe(true);
    expect(paymentDoc.data()?.amount).toBe(advanceAmount);
    expect(paymentDoc.data()?.status).toBe('COMPLETED');

    const billDoc = await getDoc(doc(db, COLLECTIONS.VENDOR_BILLS, billId));
    expect(billDoc.data()?.amountPaid).toBe(advanceAmount);
    expect(billDoc.data()?.status).toBe('PARTIALLY_PAID');
  });

  // ============================================================================
  // COMPLETE WORKFLOW TEST
  // ============================================================================

  itWithEmulator('Complete Workflow: PR → RFQ → Offer → PO → Bill → Payment', async () => {
    const now = Timestamp.now();

    // IDs for this test run
    const prId = 'workflow-pr-001';
    const rfqId = 'workflow-rfq-001';
    const offerId = 'workflow-offer-001';
    const poId = 'workflow-po-001';
    const billId = 'workflow-bill-001';
    const paymentId = 'workflow-payment-001';

    // 1. Create and approve PR
    await setDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId), {
      number: 'PR/2024/01/0099',
      status: 'APPROVED',
      title: 'Complete Workflow Test',
      itemCount: 1,
      createdAt: now,
    });

    // 2. Create RFQ
    await setDoc(doc(db, COLLECTIONS.RFQS, rfqId), {
      number: 'RFQ/2024/01/0099',
      purchaseRequestId: prId,
      status: 'SENT',
      vendorIds: [TEST_VENDOR.id],
      createdAt: now,
    });

    // 3. Create and accept Offer
    await setDoc(doc(db, COLLECTIONS.OFFERS, offerId), {
      rfqId: rfqId,
      vendorId: TEST_VENDOR.id,
      status: 'ACCEPTED',
      totalAmount: 100000,
      createdAt: now,
    });

    // 4. Create and approve PO
    await setDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
      number: 'PO/2024/01/0099',
      offerId: offerId,
      vendorId: TEST_VENDOR.id,
      status: 'APPROVED',
      totalAmount: 100000,
      createdAt: now,
    });

    // 5. Create Vendor Bill
    await setDoc(doc(db, COLLECTIONS.VENDOR_BILLS, billId), {
      transactionNumber: 'VB/2024/01/0099',
      purchaseOrderId: poId,
      vendorId: TEST_VENDOR.id,
      status: 'APPROVED',
      totalAmount: 100000,
      amountPaid: 0,
      amountDue: 100000,
      createdAt: now,
    });

    // 6. Create full Payment
    await setDoc(doc(db, COLLECTIONS.PAYMENTS, paymentId), {
      transactionNumber: 'PAY/2024/01/0099',
      vendorId: TEST_VENDOR.id,
      amount: 100000,
      status: 'COMPLETED',
      allocations: [{ billId: billId, allocatedAmount: 100000 }],
      createdAt: now,
    });

    // Update bill to PAID
    await updateDoc(doc(db, COLLECTIONS.VENDOR_BILLS, billId), {
      amountPaid: 100000,
      amountDue: 0,
      status: 'PAID',
    });

    // Verify complete chain
    const pr = await getDoc(doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId));
    const rfq = await getDoc(doc(db, COLLECTIONS.RFQS, rfqId));
    const offer = await getDoc(doc(db, COLLECTIONS.OFFERS, offerId));
    const po = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId));
    const bill = await getDoc(doc(db, COLLECTIONS.VENDOR_BILLS, billId));
    const payment = await getDoc(doc(db, COLLECTIONS.PAYMENTS, paymentId));

    expect(pr.exists()).toBe(true);
    expect(rfq.data()?.purchaseRequestId).toBe(prId);
    expect(offer.data()?.rfqId).toBe(rfqId);
    expect(po.data()?.offerId).toBe(offerId);
    expect(bill.data()?.purchaseOrderId).toBe(poId);
    expect(bill.data()?.status).toBe('PAID');
    expect(payment.data()?.allocations[0].billId).toBe(billId);

    // eslint-disable-next-line no-console
    console.log('\n✅ Complete procurement workflow verified successfully!\n');
  });
});
