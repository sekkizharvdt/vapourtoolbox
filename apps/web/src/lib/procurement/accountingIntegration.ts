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
  addDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  GoodsReceipt,
  GoodsReceiptItem,
  CurrencyCode,
  PaymentAllocation,
} from '@vapour/types';
import { generateBillGLEntries, type BillGLInput } from '../accounting/glEntryGenerator';
import { createPaymentWithAllocationsAtomic } from '../accounting/paymentHelpers';

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

    // Check if bill already exists for this receipt
    if (goodsReceipt.paymentRequestId) {
      throw new AccountingIntegrationError(
        'Bill already exists for this goods receipt',
        'BILL_EXISTS',
        { billId: goodsReceipt.paymentRequestId }
      );
    }

    // Fetch the purchase order for vendor and project details
    const poRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, goodsReceipt.purchaseOrderId);
    const poDoc = await getDoc(poRef);

    if (!poDoc.exists()) {
      throw new AccountingIntegrationError('Purchase order not found', 'PO_NOT_FOUND', {
        poId: goodsReceipt.purchaseOrderId,
      });
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const purchaseOrder = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;

    // Fetch goods receipt items to calculate actual amounts
    const grItemsQuery = query(
      collection(db, COLLECTIONS.GOODS_RECEIPT_ITEMS),
      where('goodsReceiptId', '==', goodsReceipt.id)
    );
    const grItemsSnapshot = await getDocs(grItemsQuery);
    const goodsReceiptItems = grItemsSnapshot.docs.map((doc) => {
      return {
        id: doc.id,
        ...doc.data(),
      } as unknown as GoodsReceiptItem;
    });

    // Fetch purchase order items for financial data
    const poItemsQuery = query(
      collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS),
      where('purchaseOrderId', '==', purchaseOrder.id)
    );
    const poItemsSnapshot = await getDocs(poItemsQuery);
    const purchaseOrderItems = poItemsSnapshot.docs.map((doc): PurchaseOrderItem => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return {
        id: doc.id,
        ...doc.data(),
      } as PurchaseOrderItem;
    });

    // Calculate bill amounts based on accepted quantities in goods receipt
    let subtotal = 0;
    let totalGST = 0;

    for (const grItem of goodsReceiptItems) {
      // Find corresponding PO item
      const poItem = purchaseOrderItems.find((p) => p.id === grItem.poItemId);
      if (!poItem) {
        console.warn(`[accountingIntegration] PO item not found for GR item: ${grItem.id}`);
        continue;
      }

      // Calculate amount based on accepted quantity
      const acceptedQty = grItem.acceptedQuantity || 0;
      const itemSubtotal = acceptedQty * poItem.unitPrice;
      const itemGST = (itemSubtotal * (poItem.gstRate || 0)) / 100;

      subtotal += itemSubtotal;
      totalGST += itemGST;
    }

    // If no items were accepted, use full PO amounts (shouldn't happen but failsafe)
    if (subtotal === 0) {
      console.warn('[accountingIntegration] No accepted items found, using full PO amounts');
      subtotal = purchaseOrder.subtotal;
      totalGST = purchaseOrder.totalTax;
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
      // Intrastate - split CGST/SGST
      cgstAmount = totalGST / 2;
      sgstAmount = totalGST / 2;
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
      status: 'UNPAID',

      // Amounts
      subtotal,
      totalAmount,
      amountPaid: 0,
      outstandingAmount: totalAmount,
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

      // Line items (from purchase order items)
      lineItems: purchaseOrderItems.map((item, index) => ({
        id: `item-${index + 1}`,
        description: item.description || '',
        quantity: item.quantity || 0,
        unitPrice: item.unitPrice || 0,
        amount: item.amount || 0,
        gstRate: item.gstRate || 0,
        gstAmount: item.gstAmount || 0,
        totalAmount: (item.amount || 0) + (item.gstAmount || 0),
      })),

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

    // Create the bill
    const billRef = await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), billData);

    // Update goods receipt with bill reference
    const grRef = doc(db, COLLECTIONS.GOODS_RECEIPTS, goodsReceipt.id);
    await updateDoc(grRef, {
      paymentRequestId: billRef.id,
      updatedAt: Timestamp.now(),
    });

    console.warn(
      `[Accounting Integration] Created bill ${billRef.id} from goods receipt ${goodsReceipt.id}`
    );

    return billRef.id;
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

    console.warn(
      `[Accounting Integration] Created advance payment ${paymentId} for PO ${purchaseOrder.id}`
    );

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

    console.warn(
      `[Accounting Integration] Created payment ${paymentId} for goods receipt ${goodsReceipt.id}`
    );

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
