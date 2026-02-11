/**
 * Procurement-Accounting Integration Bridge
 *
 * This module provides functions to automatically create accounting entries
 * from procurement workflows, eliminating manual data re-entry and ensuring
 * accurate financial recording.
 *
 * Integration Points:
 * 1. Purchase Order Approval → Advance Payment (if required)
 * 2. Goods Receipt Approval → Vendor Bill
 * 3. Payment Authorization → Vendor Payment
 */

import {
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  collection,
  Timestamp,
  runTransaction,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  GoodsReceipt,
  GoodsReceiptItem,
  CurrencyCode,
  PaymentAllocation,
} from '@vapour/types';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'accountingIntegration' });
import { generateBillGLEntries, type BillGLInput } from '../accounting/glEntry';
import { createPaymentWithAllocationsAtomic } from '../accounting/paymentHelpers';
import { saveTransaction } from '../accounting/transactionService';
import {
  createTaskNotification,
  findTaskNotificationByEntity,
  completeActionableTask,
} from '../tasks/taskNotificationService';

/**
 * Error types for integration failures
 */
export class AccountingIntegrationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AccountingIntegrationError';
  }
}

/**
 * Create a Vendor Bill from an approved Goods Receipt
 *
 * This function automatically generates a vendor bill when goods are received
 * and inspected. The bill is created with line items matching the goods receipt,
 * including GST calculations and linked to the original purchase order.
 *
 * Workflow: Goods Receipt Approved → VENDOR_BILL created
 *
 * @param db - Firestore instance
 * @param goodsReceipt - The goods receipt to convert to a bill
 * @param userId - User ID creating the bill
 * @param userEmail - User email for audit trail
 * @returns Bill transaction ID
 * @throws AccountingIntegrationError if bill creation fails
 */
export async function createBillFromGoodsReceipt(
  db: Firestore,
  goodsReceipt: GoodsReceipt,
  userId: string,
  userEmail: string
): Promise<string> {
  try {
    // Validate goods receipt is approved
    if (goodsReceipt.status !== 'COMPLETED') {
      throw new AccountingIntegrationError(
        'Goods receipt must be completed before creating bill',
        'INVALID_STATUS',
        { status: goodsReceipt.status }
      );
    }

    // Phase0#5: Atomically claim the GR for bill creation to prevent race conditions
    // (e.g. two users clicking "Create Bill" at the same time)
    const grRef = doc(db, COLLECTIONS.GOODS_RECEIPTS, goodsReceipt.id);
    await runTransaction(db, async (transaction) => {
      const grSnap = await transaction.get(grRef);
      if (!grSnap.exists()) {
        throw new AccountingIntegrationError('Goods receipt not found', 'GR_NOT_FOUND');
      }
      const grData = grSnap.data();
      if (grData.paymentRequestId) {
        throw new AccountingIntegrationError(
          'Bill already exists or is being created for this goods receipt',
          'BILL_EXISTS',
          { billId: grData.paymentRequestId }
        );
      }
      // Set a lock to prevent concurrent bill creation
      transaction.update(grRef, {
        paymentRequestId: 'CREATING',
        updatedAt: Timestamp.now(),
      });
    });

    // Fetch the purchase order for vendor and project details
    const poRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, goodsReceipt.purchaseOrderId);
    const poDoc = await getDoc(poRef);

    if (!poDoc.exists()) {
      throw new AccountingIntegrationError('Purchase order not found', 'PO_NOT_FOUND', {
        poId: goodsReceipt.purchaseOrderId,
      });
    }

    const purchaseOrder = docToTyped<PurchaseOrder>(poDoc.id, poDoc.data());

    // PR-10: Validate project ID exists before creating bill with GL entries
    const projectId = purchaseOrder.projectIds?.[0] || goodsReceipt.projectId;
    if (projectId) {
      const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
      const projectDoc = await getDoc(projectRef);
      if (!projectDoc.exists()) {
        throw new AccountingIntegrationError(
          'Referenced project not found. Verify the project exists before creating a bill.',
          'PROJECT_NOT_FOUND',
          { projectId }
        );
      }
    }

    // PE-12: Validate vendor entity exists before creating accounting documents
    if (purchaseOrder.vendorId) {
      const vendorRef = doc(db, COLLECTIONS.ENTITIES, purchaseOrder.vendorId);
      const vendorDoc = await getDoc(vendorRef);
      if (!vendorDoc.exists()) {
        throw new AccountingIntegrationError(
          'Referenced vendor entity not found. Verify the vendor exists before creating a bill.',
          'VENDOR_NOT_FOUND',
          { vendorId: purchaseOrder.vendorId }
        );
      }
    }

    // Fetch goods receipt items and purchase order items in parallel (avoid sequential queries)
    const [grItemsSnapshot, poItemsSnapshot] = await Promise.all([
      getDocs(
        query(
          collection(db, COLLECTIONS.GOODS_RECEIPT_ITEMS),
          where('goodsReceiptId', '==', goodsReceipt.id)
        )
      ),
      getDocs(
        query(
          collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS),
          where('purchaseOrderId', '==', purchaseOrder.id)
        )
      ),
    ]);

    const goodsReceiptItems = grItemsSnapshot.docs.map((doc) =>
      docToTyped<GoodsReceiptItem>(doc.id, doc.data())
    );
    const purchaseOrderItems = poItemsSnapshot.docs.map((doc) =>
      docToTyped<PurchaseOrderItem>(doc.id, doc.data())
    );

    // Calculate bill amounts based on accepted quantities in goods receipt
    let subtotal = 0;
    let totalGST = 0;

    for (const grItem of goodsReceiptItems) {
      // Find corresponding PO item
      const poItem = purchaseOrderItems.find((p) => p.id === grItem.poItemId);
      if (!poItem) {
        logger.warn('PO item not found for GR item', { grItemId: grItem.id });
        continue;
      }

      // Calculate amount based on accepted quantity
      const acceptedQty = grItem.acceptedQuantity || 0;
      const itemSubtotal = acceptedQty * poItem.unitPrice;
      const itemGST = (itemSubtotal * (poItem.gstRate || 0)) / 100;

      subtotal += itemSubtotal;
      totalGST += itemGST;
    }

    // PR-13: Throw error when no accepted items — bill should only reflect accepted quantities
    if (subtotal === 0) {
      throw new AccountingIntegrationError(
        'Cannot create bill: no accepted items found in goods receipt. Verify goods receipt items have accepted quantities before creating a bill.',
        'NO_ACCEPTED_ITEMS'
      );
    }

    const totalAmount = subtotal + totalGST;

    // Determine GST split based on PO tax structure (proportional)
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (purchaseOrder.igst > 0) {
      // Interstate - all IGST
      igstAmount = totalGST;
    } else {
      // Intrastate - split CGST/SGST (round to avoid odd paisa)
      cgstAmount = Math.round((totalGST / 2) * 100) / 100;
      sgstAmount = Math.round((totalGST - cgstAmount) * 100) / 100;
    }

    // Generate transaction number
    const timestamp = Date.now();
    const transactionNumber = `BILL-${timestamp}`;

    // Determine GST type based on which tax is applied
    const gstType = igstAmount > 0 ? 'IGST' : 'CGST_SGST';

    // Prepare GL input for bill
    const glInput: BillGLInput = {
      transactionNumber,
      transactionDate: Timestamp.now(),
      subtotal,
      gstDetails: {
        gstType,
        taxableAmount: subtotal,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalGST,
      },
      currency: (purchaseOrder.currency as CurrencyCode) || 'INR',
      description: `Bill for Goods Receipt ${goodsReceipt.number || goodsReceipt.id}`,
      entityId: purchaseOrder.vendorId,
      projectId: purchaseOrder.projectIds[0], // Use first project
    };

    // Generate GL entries
    const glResult = await generateBillGLEntries(db, glInput);

    if (!glResult.success) {
      throw new AccountingIntegrationError(
        'Failed to generate GL entries for bill',
        'GL_GENERATION_FAILED',
        { errors: glResult.errors }
      );
    }

    // Create the bill transaction
    const billData = {
      // Transaction metadata
      type: 'VENDOR_BILL',
      transactionNumber,
      date: Timestamp.now(),
      dueDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30 days
      status: 'APPROVED',

      // Amounts
      subtotal,
      totalAmount,
      amountPaid: 0, // Legacy field name
      paidAmount: 0, // Standard field name per VendorBill type
      outstandingAmount: totalAmount,
      paymentStatus: 'UNPAID' as const,
      currency: (purchaseOrder.currency as CurrencyCode) || 'INR',

      // Vendor details
      entityId: purchaseOrder.vendorId,
      entityName: purchaseOrder.vendorName || '',

      // GST details
      gstDetails: {
        gstType,
        taxableAmount: subtotal,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalGST,
      },

      // PR-21: Line items based on GR accepted quantities (consistent with totals above)
      lineItems: goodsReceiptItems
        .filter((grItem) => (grItem.acceptedQuantity || 0) > 0)
        .map((grItem, index) => {
          const poItem = purchaseOrderItems.find((p) => p.id === grItem.poItemId);
          const acceptedQty = grItem.acceptedQuantity || 0;
          const unitPrice = poItem?.unitPrice || 0;
          const itemAmount = acceptedQty * unitPrice;
          const gstRate = poItem?.gstRate || 0;
          const itemGst = (itemAmount * gstRate) / 100;
          return {
            id: `item-${index + 1}`,
            description: poItem?.description || grItem.description || '',
            quantity: acceptedQty,
            unitPrice,
            amount: itemAmount,
            gstRate,
            gstAmount: itemGst,
            totalAmount: itemAmount + itemGst,
          };
        }),

      // References
      projectId: purchaseOrder.projectIds[0] || goodsReceipt.projectId,
      costCentreId: purchaseOrder.projectIds[0] || goodsReceipt.projectId,
      purchaseOrderId: purchaseOrder.id,
      goodsReceiptId: goodsReceipt.id,

      // GL entries
      entries: glResult.entries,
      glGeneratedAt: Timestamp.now(),

      // Notes
      notes: `Auto-generated from Goods Receipt ${goodsReceipt.number || goodsReceipt.id}`,
      description: `Bill for PO ${purchaseOrder.number || purchaseOrder.id}`,

      // Audit trail
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: userId,
      updatedBy: userId,
      createdByEmail: userEmail,
    };

    // Create the bill with double-entry validation
    // This will throw UnbalancedEntriesError if entries don't balance
    let billId: string;
    try {
      billId = await saveTransaction(db, billData);
    } catch (billError) {
      // Phase0#5: Clear the lock on failure so user can retry
      await updateDoc(grRef, {
        paymentRequestId: null,
        updatedAt: Timestamp.now(),
      });
      throw billError;
    }

    // Update goods receipt with actual bill reference (replaces 'CREATING' lock)
    await updateDoc(grRef, {
      paymentRequestId: billId,
      updatedAt: Timestamp.now(),
    });

    // Auto-complete the GR_BILL_REQUIRED task notification if one exists
    try {
      const notification = await findTaskNotificationByEntity(
        'GOODS_RECEIPT',
        goodsReceipt.id,
        'GR_BILL_REQUIRED'
      );
      if (notification) {
        await completeActionableTask(notification.id, userId, true);
        logger.info('Auto-completed GR_BILL_REQUIRED notification', {
          notificationId: notification.id,
        });
      }
    } catch (notifError) {
      // Don't fail bill creation if notification auto-complete fails
      logger.warn('Failed to auto-complete GR_BILL_REQUIRED notification', { notifError });
    }

    // Phase0#9: Notify procurement user that the bill has been created
    if (goodsReceipt.sentToAccountingById) {
      try {
        await createTaskNotification({
          type: 'informational',
          category: 'GR_BILL_CREATED',
          userId: goodsReceipt.sentToAccountingById,
          assignedBy: userId,
          title: `Bill Created for ${goodsReceipt.number}`,
          message: `Vendor bill ${transactionNumber} has been created for goods receipt ${goodsReceipt.number} (PO: ${goodsReceipt.poNumber}).`,
          entityType: 'GOODS_RECEIPT',
          entityId: goodsReceipt.id,
          projectId: goodsReceipt.projectId,
          linkUrl: `/procurement/goods-receipts/${goodsReceipt.id}`,
          priority: 'MEDIUM',
        });
      } catch (notifError) {
        logger.warn('Failed to notify procurement of bill creation', { notifError });
      }
    }

    logger.info('Created bill from goods receipt', {
      billId,
      goodsReceiptId: goodsReceipt.id,
    });

    return billId;
  } catch (error) {
    if (error instanceof AccountingIntegrationError) {
      throw error;
    }
    throw new AccountingIntegrationError(
      'Failed to create bill from goods receipt',
      'BILL_CREATION_FAILED',
      error
    );
  }
}

/**
 * Send a completed Goods Receipt to the accounting team for bill creation.
 * Updates the GR with sent-to-accounting fields and creates a task notification.
 */
export async function sendGRToAccounting(
  db: Firestore,
  goodsReceipt: GoodsReceipt,
  accountingUserId: string,
  accountingUserName: string,
  currentUserId: string,
  currentUserName: string
): Promise<string> {
  // Update GR with sent-to-accounting fields
  const grRef = doc(db, COLLECTIONS.GOODS_RECEIPTS, goodsReceipt.id);
  const sentAt = Timestamp.now();
  await updateDoc(grRef, {
    sentToAccountingAt: sentAt,
    accountingAssigneeId: accountingUserId,
    accountingAssigneeName: accountingUserName,
    sentToAccountingById: currentUserId,
    sentToAccountingByName: currentUserName,
    updatedAt: Timestamp.now(),
  });

  // Create actionable task notification for accounting user
  // If notification fails, roll back the GR update to avoid orphaned state
  let notificationId: string;
  try {
    notificationId = await createTaskNotification({
      type: 'actionable',
      category: 'GR_BILL_REQUIRED',
      userId: accountingUserId,
      assignedBy: currentUserId,
      assignedByName: currentUserName,
      title: `Create Bill for ${goodsReceipt.number}`,
      message: `Goods receipt ${goodsReceipt.number} (PO: ${goodsReceipt.poNumber}) is completed and requires a vendor bill. Project: ${goodsReceipt.projectName}`,
      entityType: 'GOODS_RECEIPT',
      entityId: goodsReceipt.id,
      projectId: goodsReceipt.projectId,
      linkUrl: '/accounting/grn-bills',
      priority: 'HIGH',
      autoCompletable: true,
    });
  } catch (notifError) {
    // Roll back the GR update so user can retry
    logger.error('Failed to create notification, rolling back GR update', { notifError });
    await updateDoc(grRef, {
      sentToAccountingAt: null,
      accountingAssigneeId: null,
      accountingAssigneeName: null,
      sentToAccountingById: null,
      sentToAccountingByName: null,
      updatedAt: Timestamp.now(),
    });
    throw notifError;
  }

  logger.info('Sent GR to accounting for bill creation', {
    goodsReceiptId: goodsReceipt.id,
    accountingUserId,
    notificationId,
  });

  return notificationId;
}

/**
 * GRN with denormalized PO data for the accounting GRN Bills page.
 */
export interface GRNPendingBill {
  gr: GoodsReceipt;
  vendorName: string;
  poTotalAmount: number;
  currency: string;
}

/**
 * Get all completed GRNs that are pending bill creation,
 * enriched with vendor and amount data from the PO.
 */
export async function getGRNsPendingBilling(db: Firestore): Promise<GRNPendingBill[]> {
  const q = query(
    collection(db, COLLECTIONS.GOODS_RECEIPTS),
    where('status', '==', 'COMPLETED'),
    where('sentToAccountingAt', '!=', null)
  );

  const snapshot = await getDocs(q);
  const grs = snapshot.docs
    .map((d) => docToTyped<GoodsReceipt>(d.id, d.data()))
    .filter((gr) => !gr.paymentRequestId); // Exclude GRs that already have bills

  if (grs.length === 0) return [];

  // Batch-fetch PO docs for vendor name and amount
  const uniquePOIds = [...new Set(grs.map((gr) => gr.purchaseOrderId))];
  const poMap = new Map<string, PurchaseOrder>();

  // Firestore getDoc in parallel (no in-query needed since PO IDs are unique)
  const poDocs = await Promise.all(
    uniquePOIds.map((poId) => getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId)))
  );
  for (const poDoc of poDocs) {
    if (poDoc.exists()) {
      poMap.set(poDoc.id, docToTyped<PurchaseOrder>(poDoc.id, poDoc.data()));
    }
  }

  return grs.map((gr) => {
    const po = poMap.get(gr.purchaseOrderId);
    return {
      gr,
      vendorName: po?.vendorName || '—',
      poTotalAmount: po?.grandTotal || 0,
      currency: po?.currency || 'INR',
    };
  });
}

/**
 * Create an Advance Payment from a Purchase Order
 *
 * When a purchase order requires advance payment, this function creates
 * a vendor payment transaction for the advance amount.
 *
 * Workflow: PO Approved (with advance) → VENDOR_PAYMENT created
 *
 * @param db - Firestore instance
 * @param purchaseOrder - The purchase order requiring advance payment
 * @param bankAccountId - Bank account to pay from
 * @param userId - User ID creating the payment
 * @param userEmail - User email for audit trail
 * @returns Payment transaction ID
 * @throws AccountingIntegrationError if payment creation fails
 */
export async function createAdvancePaymentFromPO(
  db: Firestore,
  purchaseOrder: PurchaseOrder,
  bankAccountId: string,
  userId: string,
  userEmail: string
): Promise<string> {
  try {
    // Validate advance payment is required
    if (!purchaseOrder.advancePaymentRequired) {
      throw new AccountingIntegrationError(
        'Purchase order does not require advance payment',
        'ADVANCE_NOT_REQUIRED'
      );
    }

    if (!purchaseOrder.advanceAmount || purchaseOrder.advanceAmount <= 0) {
      throw new AccountingIntegrationError('Invalid advance amount', 'INVALID_AMOUNT', {
        advanceAmount: purchaseOrder.advanceAmount,
      });
    }

    // Check if advance payment already exists
    if (purchaseOrder.advancePaymentId) {
      throw new AccountingIntegrationError(
        'Advance payment already exists for this PO',
        'PAYMENT_EXISTS',
        { paymentId: purchaseOrder.advancePaymentId }
      );
    }

    // Generate transaction number
    const timestamp = Date.now();
    const transactionNumber = `PAY-ADV-${timestamp}`;

    // Create payment data
    const paymentData = {
      // Transaction metadata
      type: 'VENDOR_PAYMENT',
      transactionNumber,
      date: Timestamp.now(),
      paymentDate: Timestamp.now(),
      status: 'POSTED',

      // Amount
      amount: purchaseOrder.advanceAmount,
      currency: (purchaseOrder.currency as CurrencyCode) || 'INR',

      // Vendor details
      entityId: purchaseOrder.vendorId,
      entityName: purchaseOrder.vendorName || '',

      // Payment details
      paymentMethod: 'BANK_TRANSFER',
      bankAccountId,
      referenceNumber: `ADV-${purchaseOrder.number || purchaseOrder.id}`,

      // References
      projectId: purchaseOrder.projectIds[0],
      costCentreId: purchaseOrder.projectIds[0],
      purchaseOrderId: purchaseOrder.id,

      // Notes
      notes: `Advance payment for PO ${purchaseOrder.number || purchaseOrder.id}`,
      description: `Advance payment (${purchaseOrder.advancePercentage || 0}% of PO value)`,

      // Allocations (empty for advance, will be adjusted when final bill is created)
      allocations: [],

      // Audit trail
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: userId,
      updatedBy: userId,
      createdByEmail: userEmail,
    };

    // Create payment using atomic helper (includes GL entries)
    const paymentId = await createPaymentWithAllocationsAtomic(db, paymentData, []);

    // Update purchase order with payment reference
    const poRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, purchaseOrder.id);
    await updateDoc(poRef, {
      advancePaymentId: paymentId,
      advancePaymentStatus: 'PAID',
      paymentProgress: purchaseOrder.advancePercentage || 0,
      updatedAt: Timestamp.now(),
    });

    logger.info('Created advance payment for PO', {
      paymentId,
      purchaseOrderId: purchaseOrder.id,
    });

    return paymentId;
  } catch (error) {
    if (error instanceof AccountingIntegrationError) {
      throw error;
    }
    throw new AccountingIntegrationError(
      'Failed to create advance payment',
      'PAYMENT_CREATION_FAILED',
      error
    );
  }
}

/**
 * Create a Payment from an approved Goods Receipt
 *
 * When a goods receipt is approved for payment, this function creates a vendor
 * payment and allocates it to the associated bill.
 *
 * Workflow: Goods Receipt approved for payment → VENDOR_PAYMENT created
 *
 * @param db - Firestore instance
 * @param goodsReceipt - The goods receipt approved for payment
 * @param bankAccountId - Bank account to pay from
 * @param userId - User ID creating the payment
 * @param userEmail - User email for audit trail
 * @returns Payment transaction ID
 * @throws AccountingIntegrationError if payment creation fails
 */
export async function createPaymentFromApprovedReceipt(
  db: Firestore,
  goodsReceipt: GoodsReceipt,
  bankAccountId: string,
  userId: string,
  userEmail: string
): Promise<string> {
  try {
    // Validate goods receipt is approved for payment
    if (!goodsReceipt.approvedForPayment) {
      throw new AccountingIntegrationError(
        'Goods receipt not approved for payment',
        'NOT_APPROVED'
      );
    }

    // Check if bill exists for this receipt
    if (!goodsReceipt.paymentRequestId) {
      throw new AccountingIntegrationError(
        'No bill found for this goods receipt. Create bill first.',
        'BILL_NOT_FOUND'
      );
    }

    // Fetch the bill
    const billRef = doc(db, COLLECTIONS.TRANSACTIONS, goodsReceipt.paymentRequestId);
    const billDoc = await getDoc(billRef);

    if (!billDoc.exists()) {
      throw new AccountingIntegrationError('Bill document not found', 'BILL_DOCUMENT_NOT_FOUND', {
        billId: goodsReceipt.paymentRequestId,
      });
    }

    const bill = billDoc.data();

    // Check if bill is already paid
    if (bill.status === 'PAID') {
      throw new AccountingIntegrationError('Bill is already fully paid', 'ALREADY_PAID', {
        billId: goodsReceipt.paymentRequestId,
      });
    }

    // Calculate payment amount (outstanding amount from bill)
    const outstandingAmount = bill.outstandingAmount || bill.totalAmount;
    const billTotalAmount = bill.totalAmount || outstandingAmount;

    // Generate transaction number
    const timestamp = Date.now();
    const transactionNumber = `PAY-${timestamp}`;

    // Create payment allocation
    const allocation: PaymentAllocation = {
      invoiceId: goodsReceipt.paymentRequestId,
      invoiceNumber: bill.transactionNumber,
      originalAmount: billTotalAmount,
      allocatedAmount: outstandingAmount,
      remainingAmount: 0, // Full payment
    };

    // Create payment data
    const paymentData = {
      // Transaction metadata
      type: 'VENDOR_PAYMENT',
      transactionNumber,
      date: Timestamp.now(),
      paymentDate: Timestamp.now(),
      status: 'POSTED',

      // Amount
      amount: outstandingAmount,
      currency: (bill.currency as CurrencyCode) || 'INR',

      // Vendor details
      entityId: bill.entityId,
      entityName: bill.entityName || '',

      // Payment details
      paymentMethod: 'BANK_TRANSFER',
      bankAccountId,
      referenceNumber: `GR-${goodsReceipt.number || goodsReceipt.id}`,

      // References
      projectId: bill.projectId,
      costCentreId: bill.costCentreId,
      goodsReceiptId: goodsReceipt.id,

      // Notes
      notes: `Payment for Goods Receipt ${goodsReceipt.number || goodsReceipt.id}`,
      description: `Payment for Bill ${bill.transactionNumber}`,

      // Allocations - link to the bill
      allocations: [],

      // Audit trail
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: userId,
      updatedBy: userId,
      createdByEmail: userEmail,
    };

    // Create payment using atomic helper (includes GL entries and allocation)
    const paymentId = await createPaymentWithAllocationsAtomic(db, paymentData, [allocation]);

    logger.info('Created payment for goods receipt', {
      paymentId,
      goodsReceiptId: goodsReceipt.id,
    });

    return paymentId;
  } catch (error) {
    if (error instanceof AccountingIntegrationError) {
      throw error;
    }
    throw new AccountingIntegrationError(
      'Failed to create payment from goods receipt',
      'PAYMENT_CREATION_FAILED',
      error
    );
  }
}
