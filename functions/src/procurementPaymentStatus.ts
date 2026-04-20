/**
 * Procurement Payment Status Sync
 *
 * Keeps each Goods Receipt's `paymentStatus` field aligned with the actual
 * payments made against its source PO (procurement review #36). A GR is a
 * per-delivery slice of a PO; when the buyer pays the vendor, users want to
 * see at a glance whether the PO has been fully settled or only partially.
 *
 * Design:
 * 1. Triggered whenever a VENDOR_PAYMENT transaction is written.
 * 2. From the payment's billAllocations we find which PO(s) are affected
 *    (via each bill's `purchaseOrderId`).
 * 3. For each affected PO we sum `paidAmount` across all VENDOR_BILL
 *    transactions tagged with that `purchaseOrderId` and compare it to the
 *    PO's `grandTotal` to compute the bucket.
 * 4. Every GR for that PO is updated with the bucket, the total paid, and
 *    a timestamp so UI can show "last synced at …" if needed.
 *
 * Why bills not allocations: VENDOR_BILL already tracks `paidAmount` /
 * `outstandingAmount` as a running total — summing bills is O(bills_per_PO)
 * and avoids scanning every historical payment.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

// Firestore collection names kept as literals here — the functions package
// doesn't import `@vapour/firebase` directly after build flattening.
const TRANSACTIONS = 'transactions';
const PURCHASE_ORDERS = 'purchaseOrders';
const GOODS_RECEIPTS = 'goodsReceipts';

type PaymentBucket = 'PENDING' | 'APPROVED' | 'PARTLY_CLEARED' | 'CLEARED';

interface PaymentAllocationShape {
  invoiceId?: string;
  allocatedAmount?: number;
}

/**
 * Sum the bills-paid total for one PO and write the derived status onto
 * every GR that references the PO.
 */
async function syncPOPaymentToGRs(db: admin.firestore.Firestore, poId: string): Promise<void> {
  const poSnap = await db.collection(PURCHASE_ORDERS).doc(poId).get();
  if (!poSnap.exists) {
    logger.warn('[procurementPaymentStatus] PO not found', { poId });
    return;
  }
  const po = poSnap.data() as { grandTotal?: number };
  const poTotal = Number(po.grandTotal) || 0;

  // Sum paidAmount across all bills for this PO. VENDOR_BILL docs maintain
  // `paidAmount` as a running total so we don't need to re-scan every payment.
  const billsSnap = await db
    .collection(TRANSACTIONS)
    .where('type', '==', 'VENDOR_BILL')
    .where('purchaseOrderId', '==', poId)
    .get();

  let totalPaid = 0;
  let anyBillExists = false;
  for (const billDoc of billsSnap.docs) {
    anyBillExists = true;
    const bill = billDoc.data() as { paidAmount?: number; isDeleted?: boolean };
    if (bill.isDeleted) continue;
    totalPaid += Number(bill.paidAmount) || 0;
  }

  let bucket: PaymentBucket;
  if (!anyBillExists) {
    // No bill yet means accounting hasn't created one — stay PENDING.
    bucket = 'PENDING';
  } else if (totalPaid <= 0.01) {
    bucket = 'APPROVED';
  } else if (totalPaid >= poTotal - 0.01) {
    bucket = 'CLEARED';
  } else {
    bucket = 'PARTLY_CLEARED';
  }

  const grsSnap = await db.collection(GOODS_RECEIPTS).where('purchaseOrderId', '==', poId).get();

  if (grsSnap.empty) {
    logger.info('[procurementPaymentStatus] No GRs to update for PO', { poId });
    return;
  }

  const batch = db.batch();
  const now = admin.firestore.Timestamp.now();
  for (const grDoc of grsSnap.docs) {
    batch.update(grDoc.ref, {
      paymentStatus: bucket,
      totalPaidAgainstPO: Number(totalPaid.toFixed(2)),
      paymentStatusUpdatedAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();

  logger.info('[procurementPaymentStatus] Synced GRs for PO', {
    poId,
    poTotal,
    totalPaid,
    bucket,
    grCount: grsSnap.size,
  });
}

export const syncPOPaymentStatusOnVendorPayment = onDocumentWritten(
  'transactions/{transactionId}',
  async (event) => {
    const change = event.data;
    const before = change?.before?.exists
      ? (change.before.data() as Record<string, unknown>)
      : null;
    const after = change?.after?.exists ? (change.after.data() as Record<string, unknown>) : null;

    // Only care about vendor payments — either side of the write.
    const beforeIsPayment = before?.type === 'VENDOR_PAYMENT';
    const afterIsPayment = after?.type === 'VENDOR_PAYMENT';
    if (!beforeIsPayment && !afterIsPayment) return;

    // Collect every bill touched by this write so we can find the affected POs.
    const billIds = new Set<string>();
    for (const data of [before, after]) {
      if (!data) continue;
      const allocations = (data.billAllocations as PaymentAllocationShape[] | undefined) || [];
      for (const alloc of allocations) {
        if (alloc?.invoiceId) billIds.add(alloc.invoiceId);
      }
    }

    if (billIds.size === 0) {
      logger.info('[procurementPaymentStatus] Vendor payment has no bill allocations, skipping', {
        transactionId: event.params.transactionId,
      });
      return;
    }

    const db = admin.firestore();

    // Resolve affected PO IDs via the bills' denormalised `purchaseOrderId`.
    const billSnaps = await Promise.all(
      Array.from(billIds).map((id) => db.collection(TRANSACTIONS).doc(id).get())
    );
    const poIds = new Set<string>();
    for (const snap of billSnaps) {
      if (!snap.exists) continue;
      const bill = snap.data() as { purchaseOrderId?: string };
      if (bill.purchaseOrderId) poIds.add(bill.purchaseOrderId);
    }

    if (poIds.size === 0) {
      logger.info('[procurementPaymentStatus] No bill → PO linkage found, skipping', {
        transactionId: event.params.transactionId,
      });
      return;
    }

    for (const poId of poIds) {
      try {
        await syncPOPaymentToGRs(db, poId);
      } catch (err) {
        logger.error('[procurementPaymentStatus] Failed to sync PO', { poId, error: err });
      }
    }
  }
);
