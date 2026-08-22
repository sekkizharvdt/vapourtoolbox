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
import {
  computePOPaymentSummary,
  type BillLike,
  type PaymentLike,
  type POLike,
} from './poPaymentSummaryLogic';
import { derivePaid } from './utils/amountHelpers';
import { logger } from 'firebase-functions/v2';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
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

// PO statuses from which a payment can auto-advance to IN_PROGRESS. Mirrors
// purchaseOrderStateMachine's ISSUED/ACKNOWLEDGED -> IN_PROGRESS transitions
// (apps/web/src/lib/workflow/stateMachines.ts) — functions can't import that
// app-local module, so this guard is kept intentionally narrow and duplicated
// here rather than pulled into a shared package for one check.
const PO_STATUSES_ADVANCEABLE_TO_IN_PROGRESS = new Set(['ISSUED', 'ACKNOWLEDGED']);

/**
 * Sum the bills-paid total for one PO and write the derived status onto
 * every GR that references the PO.
 */
export async function syncPOPaymentToGRs(
  db: admin.firestore.Firestore,
  poId: string
): Promise<void> {
  // rule8-exempt: the PO status write is idempotent by construction — it
  // only fires from PO_STATUSES_ADVANCEABLE_TO_IN_PROGRESS, a narrow guard
  // mirroring purchaseOrderStateMachine's ISSUED/ACKNOWLEDGED -> IN_PROGRESS
  // transitions, so a repeat Firestore trigger is a no-op, not an invalid
  // transition.
  const poSnap = await db.collection(PURCHASE_ORDERS).doc(poId).get();
  if (!poSnap.exists) {
    logger.warn('[procurementPaymentStatus] PO not found', { poId });
    return;
  }
  const po = poSnap.data() as { grandTotal?: number; status?: string };
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
    const bill = billDoc.data() as {
      amountPaid?: number;
      paidAmount?: number;
      isDeleted?: boolean;
    };
    if (bill.isDeleted) continue;
    // derivePaid resolves amountPaid first: paidAmount is initialised to 0 and
    // never updated, so reading it left every PO looking entirely unpaid.
    totalPaid += derivePaid(bill);
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

  // Auto-advance ISSUED/ACKNOWLEDGED -> IN_PROGRESS once any payment has been
  // made against the PO (feedback i7brfS9rrdfGVxRTHHZu). Idempotent: only
  // fires from the two eligible statuses, so a repeat trigger is a no-op.
  if (totalPaid > 0.01 && po.status && PO_STATUSES_ADVANCEABLE_TO_IN_PROGRESS.has(po.status)) {
    await poSnap.ref.update({
      status: 'IN_PROGRESS',
      updatedAt: admin.firestore.Timestamp.now(),
    });
    logger.info('[procurementPaymentStatus] Advanced PO to IN_PROGRESS on payment', { poId });
  }

  const grsSnap = await db.collection(GOODS_RECEIPTS).where('purchaseOrderId', '==', poId).get();

  if (grsSnap.empty) {
    logger.info('[procurementPaymentStatus] No GRs to update for PO', { poId });
    return;
  }

  // Chunk by 500 (Firestore batch limit) — a PO can in theory receive many
  // partial deliveries; keep the fan-out safe.
  const now = admin.firestore.Timestamp.now();
  for (let i = 0; i < grsSnap.docs.length; i += 500) {
    const batch = db.batch();
    for (const grDoc of grsSnap.docs.slice(i, i + 500)) {
      batch.update(grDoc.ref, {
        paymentStatus: bucket,
        totalPaidAgainstPO: Number(totalPaid.toFixed(2)),
        paymentStatusUpdatedAt: now,
        updatedAt: now,
      });
    }
    await batch.commit();
  }

  logger.info('[procurementPaymentStatus] Synced GRs for PO', {
    poId,
    poTotal,
    totalPaid,
    bucket,
    grCount: grsSnap.size,
  });
}

/**
 * Rebuild the `paymentSummary` projection on a PO and write it to the PO doc.
 *
 * **This is how procurement sees payments at all.** `transactions` requires
 * VIEW_ACCOUNTING and four of the nine live users hold MANAGE_PROCUREMENT
 * without it, so the numbers have to be published onto a document procurement
 * can already read. The projection carries only the fields §7 of the request
 * asks for — totals, milestone status, and payment date/amount/reference. Do
 * not widen it here without treating that as a permissions decision.
 *
 * Recomputed from source every time, never incremented, so repeated or
 * out-of-order triggers converge (rule 21). The PO write is a transaction
 * (rule 19).
 */
export async function syncPOPaymentSummary(
  db: admin.firestore.Firestore,
  poId: string
): Promise<void> {
  const poRef = db.collection(PURCHASE_ORDERS).doc(poId);
  const poSnap = await poRef.get();
  if (!poSnap.exists) {
    logger.warn('[poPaymentSummary] PO not found', { poId });
    return;
  }
  const po = poSnap.data() as POLike;

  // Bills for this PO. Equality-only on two fields, so single-field indexes
  // serve it — no composite index needed (rule 2 applies to where + orderBy).
  const billsSnap = await db
    .collection(TRANSACTIONS)
    .where('type', '==', 'VENDOR_BILL')
    .where('purchaseOrderId', '==', poId)
    .get();

  const bills: BillLike[] = billsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<BillLike, 'id'>),
  }));
  const billIds = new Set(bills.map((b) => b.id));

  // Payments reaching this PO two ways: allocated to one of its bills, or
  // tagged directly (an advance with no bill behind it). Fetching all vendor
  // payments to filter by allocation is acceptable at this data size — 204
  // documents — and avoids an array-contains index on a nested object field
  // that Firestore cannot express anyway.
  const paymentsSnap = await db
    .collection(TRANSACTIONS)
    .where('type', '==', 'VENDOR_PAYMENT')
    .get();

  const payments: PaymentLike[] = [];
  for (const doc of paymentsSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const allocations = (data.billAllocations as PaymentAllocationShape[] | undefined) ?? [];
    const touchesOurBills = allocations.some(
      (a) => a?.invoiceId && billIds.has(a.invoiceId) && (a.allocatedAmount ?? 0) > 0
    );
    const taggedToUs = data.purchaseOrderId === poId;
    if (!touchesOurBills && !taggedToUs) continue;

    const paymentDate = data.paymentDate ?? data.date;
    payments.push({
      id: doc.id,
      ...(data as Omit<PaymentLike, 'id' | 'paymentDateSeconds'>),
      paymentDateSeconds:
        paymentDate instanceof admin.firestore.Timestamp ? paymentDate.seconds : 0,
    });
  }

  const summary = computePOPaymentSummary(po, bills, payments);

  // Timestamps are stamped here rather than inside the pure logic so that stays
  // testable without firebase.
  const now = admin.firestore.Timestamp.now();
  const payload = {
    ...summary,
    history: summary.history.map(({ paymentDateSeconds, ...rest }) => ({
      ...rest,
      paymentDate: new admin.firestore.Timestamp(paymentDateSeconds, 0),
    })),
    syncedAt: now,
  };

  await db.runTransaction(async (tx) => {
    tx.update(poRef, { paymentSummary: payload, updatedAt: now });
  });

  logger.info('[poPaymentSummary] Rebuilt', {
    poId,
    paid: summary.paidAmount,
    total: summary.totalAmount,
    status: summary.status,
    milestones: summary.milestones.length,
  });
}

/**
 * Resolve which POs a transaction write affects.
 *
 * Three routes, matching the three ways a PO's payment position can move:
 * a bill written against it, a payment allocated to one of its bills, and a
 * payment tagged to it directly. Both sides of the write are inspected so that
 * clearing a link still re-syncs the PO that just lost it.
 */
async function affectedPOIds(
  db: admin.firestore.Firestore,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): Promise<Set<string>> {
  const poIds = new Set<string>();
  const billIds = new Set<string>();

  for (const data of [before, after]) {
    if (!data) continue;

    // A bill carries its PO directly.
    if (data.type === 'VENDOR_BILL' && typeof data.purchaseOrderId === 'string') {
      poIds.add(data.purchaseOrderId);
    }

    if (data.type === 'VENDOR_PAYMENT') {
      // A direct payment carries its PO too.
      if (typeof data.purchaseOrderId === 'string') poIds.add(data.purchaseOrderId);

      const allocations = (data.billAllocations as PaymentAllocationShape[] | undefined) ?? [];
      for (const alloc of allocations) {
        if (alloc?.invoiceId) billIds.add(alloc.invoiceId);
      }
    }
  }

  // Allocated payments reach their PO through the bill.
  if (billIds.size > 0) {
    const billSnaps = await Promise.all(
      Array.from(billIds).map((id) => db.collection(TRANSACTIONS).doc(id).get())
    );
    for (const snap of billSnaps) {
      if (!snap.exists) continue;
      const bill = snap.data() as { purchaseOrderId?: string };
      if (bill.purchaseOrderId) poIds.add(bill.purchaseOrderId);
    }
  }

  return poIds;
}

export const syncPOPaymentStatusOnVendorPayment = onDocumentWritten(
  'transactions/{transactionId}',
  async (event) => {
    const change = event.data;
    const before = change?.before?.exists
      ? (change.before.data() as Record<string, unknown>)
      : null;
    const after = change?.after?.exists ? (change.after.data() as Record<string, unknown>) : null;

    // Bills matter as well as payments: a new or edited bill changes a
    // milestone's pending amount before any money moves. Only reacting to
    // VENDOR_PAYMENT was one of two reasons this trigger was inert.
    const relevant = (data: Record<string, unknown> | null) =>
      data?.type === 'VENDOR_PAYMENT' || data?.type === 'VENDOR_BILL';
    if (!relevant(before) && !relevant(after)) return;

    const db = admin.firestore();
    const poIds = await affectedPOIds(db, before, after);

    if (poIds.size === 0) {
      logger.info('[procurementPaymentStatus] Write touches no PO, skipping', {
        transactionId: event.params.transactionId,
      });
      return;
    }

    for (const poId of poIds) {
      // Each PO is independent: one failing must not stop the others (rule 27).
      try {
        await syncPOPaymentSummary(db, poId);
      } catch (err) {
        logger.error('[poPaymentSummary] Failed to rebuild summary', {
          poId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      try {
        await syncPOPaymentToGRs(db, poId);
      } catch (err) {
        logger.error('[procurementPaymentStatus] Failed to sync GRs', {
          poId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
);

/**
 * Rebuild the projection when the PO itself moves.
 *
 * An amendment changes grandTotal and the milestone amounts, so the summary
 * computed against the previous order value is stale the moment it lands.
 * Guarded against its own write: the trigger fires on the paymentSummary
 * update it just made, and without this check that recurses forever.
 */
export const syncPOPaymentSummaryOnPOWrite = onDocumentWritten(
  'purchaseOrders/{poId}',
  async (event) => {
    const change = event.data;
    if (!change?.after?.exists) return;

    const before = change.before?.exists ? (change.before.data() as Record<string, unknown>) : null;
    const after = change.after.data() as Record<string, unknown>;

    // Only the inputs to the projection matter. Comparing them also breaks the
    // self-trigger loop: a write that only changed paymentSummary/updatedAt
    // leaves these identical and returns here.
    //
    // Built as an array, not an object with `?? null` defaults: JSON.stringify
    // already renders a missing array element as null, and a fallback chain on
    // an amount field is exactly what rule 21 forbids — even in a comparison
    // key, because the next person to read it cannot tell it is not arithmetic.
    const inputs = (d: Record<string, unknown> | null) =>
      JSON.stringify([
        d?.grandTotal,
        (d?.commercialTerms as { paymentSchedule?: unknown } | undefined)?.paymentSchedule,
      ]);

    if (before && inputs(before) === inputs(after)) return;

    try {
      await syncPOPaymentSummary(admin.firestore(), event.params.poId);
    } catch (err) {
      logger.error('[poPaymentSummary] Failed to rebuild summary on PO write', {
        poId: event.params.poId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
);

/**
 * Rebuild every PO's payment summary.
 *
 * The repair path for the projection: if a trigger failed, or a batch of
 * transactions was backfilled behind the trigger's back, the stored summaries
 * drift and there is nothing procurement can do about it from their side.
 * Mirrors `recalculateAccountBalances` on the Data Health page.
 *
 * Gated on MANAGE_PROCUREMENT **or** MANAGE_ACCOUNTING: the projection spans
 * both modules, and either owner has a legitimate reason to repair it.
 */
export const recalculatePOPaymentSummaries = onCall(
  { timeoutSeconds: 540, memory: '1GiB' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const permissions = (request.auth.token.permissions as number | undefined) ?? 0;
    const MANAGE_PROCUREMENT = 1 << 16; // 65536
    const MANAGE_ACCOUNTING = 1 << 14; // 16384
    const allowed =
      (permissions & MANAGE_PROCUREMENT) !== 0 || (permissions & MANAGE_ACCOUNTING) !== 0;
    if (!allowed) {
      throw new HttpsError(
        'permission-denied',
        'Only users who manage procurement or accounting can rebuild PO payment summaries'
      );
    }

    const db = admin.firestore();
    const posSnap = await db.collection(PURCHASE_ORDERS).get();

    let rebuilt = 0;
    const failures: Array<{ poId: string; error: string }> = [];

    for (const doc of posSnap.docs) {
      try {
        await syncPOPaymentSummary(db, doc.id);
        rebuilt++;
      } catch (err) {
        // One bad PO must not abort the sweep — collect and report (rule 27).
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ poId: doc.id, error: message });
        logger.error('[poPaymentSummary] Rebuild failed during recalculation', {
          poId: doc.id,
          error: message,
        });
      }
    }

    logger.info('[poPaymentSummary] Recalculation complete', {
      total: posSnap.size,
      rebuilt,
      failed: failures.length,
    });

    return { total: posSnap.size, rebuilt, failures };
  }
);
