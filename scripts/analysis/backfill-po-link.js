#!/usr/bin/env node
/**
 * Batch 0 backfill for the PO-wise payment work
 * (docs/reviews/2026-08-22-po-wise-payment-plan.md).
 *
 * Two independent fixes, both idempotent, both dry-run by default:
 *
 * 1. VENDOR_BILL PO link. `CreateBillDialog` used to write the selected PO's id
 *    as `sourceDocumentId`, while the CF payment rollup, arePOPaymentsComplete
 *    and three-way match all query `purchaseOrderId`. Moves the id across and
 *    clears the old key, because `sourceDocumentId` is polymorphic —
 *    vendorBillIntegrationService stores a three-way-match id in it — so a PO
 *    id left there is indistinguishable from a match id.
 *
 * 2. PurchaseOrder.taxableValue. Computed at write time and discarded, so no
 *    live PO carries it. Restored as `grandTotal - totalTax`, which is an exact
 *    identity (grandTotal is defined as taxableValue + totalTax), not an
 *    estimate.
 *
 * 3. Stranded goods-receipt bill locks. A failure between claiming the GR and
 *    persisting the bill used to skip the lock release, leaving
 *    `paymentRequestId: 'CREATING'` forever and making the GR unbillable.
 *    Clears the sentinel ONLY where no bill actually exists for that GR.
 *
 * Usage, from the repo root so firebase-admin resolves:
 *   node ./scripts/analysis/backfill-po-link.js          # dry run, prints the plan
 *   node ./scripts/analysis/backfill-po-link.js --apply  # writes
 */

const admin = require('firebase-admin');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(__dirname, '..', '..', 'docs', 'inputs', 'firebase-service-account-key.json');

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const roundToPaisa = (n) => Math.round(n * 100) / 100;

async function backfillBillPOLink() {
  console.log('\n=== 1. VENDOR_BILL: sourceDocumentId -> purchaseOrderId ===');
  const snap = await db.collection('transactions').where('type', '==', 'VENDOR_BILL').get();

  const todo = [];
  snap.forEach((d) => {
    const b = d.data();
    if (b.purchaseOrderId) return; // already canonical
    if (!b.sourceDocumentId) return; // no PO link to move
    todo.push({
      ref: d.ref,
      number: b.transactionNumber,
      poId: b.sourceDocumentId,
      poNumber: b.sourcePoNumber,
    });
  });

  if (todo.length === 0) {
    console.log('  nothing to do');
    return;
  }

  // Only move ids that actually resolve to a PO — sourceDocumentId also holds
  // three-way-match ids, which must be left alone.
  const resolved = [];
  for (const row of todo) {
    const po = await db.collection('purchaseOrders').doc(row.poId).get();
    if (!po.exists) {
      console.log(`  SKIP ${row.number}: sourceDocumentId ${row.poId} is not a purchaseOrder`);
      continue;
    }
    resolved.push({ ...row, resolvedNumber: po.data().number });
    console.log(`  ${row.number} -> PO ${po.data().number} (${row.poId})`);
  }

  if (!APPLY || resolved.length === 0) return;

  const batch = db.batch();
  for (const row of resolved) {
    batch.update(row.ref, {
      purchaseOrderId: row.poId,
      sourcePoNumber: row.poNumber || row.resolvedNumber,
      sourceModule: 'procurement',
      sourceDocumentId: admin.firestore.FieldValue.delete(),
    });
  }
  await batch.commit();
  console.log(`  applied to ${resolved.length} bill(s)`);
}

async function backfillTaxableValue() {
  console.log('\n=== 2. purchaseOrders.taxableValue ===');
  const snap = await db.collection('purchaseOrders').get();

  const todo = [];
  snap.forEach((d) => {
    const po = d.data();
    if (typeof po.taxableValue === 'number') return;
    const value = roundToPaisa((po.grandTotal || 0) - (po.totalTax || 0));
    todo.push({
      ref: d.ref,
      number: po.number,
      value,
      grandTotal: po.grandTotal,
      totalTax: po.totalTax,
    });
  });

  if (todo.length === 0) {
    console.log('  nothing to do');
    return;
  }
  todo.forEach((r) =>
    console.log(`  ${r.number}: taxableValue = ${r.value}  (${r.grandTotal} - ${r.totalTax})`)
  );

  if (!APPLY) return;
  const batch = db.batch();
  todo.forEach((r) => batch.update(r.ref, { taxableValue: r.value }));
  await batch.commit();
  console.log(`  applied to ${todo.length} PO(s)`);
}

async function clearStrandedGRLocks() {
  console.log("\n=== 3. goodsReceipts stranded at paymentRequestId: 'CREATING' ===");
  const snap = await db
    .collection('goodsReceipts')
    .where('paymentRequestId', '==', 'CREATING')
    .get();

  if (snap.empty) {
    console.log('  nothing to do');
    return;
  }

  const clearable = [];
  for (const d of snap.docs) {
    const gr = d.data();
    // Never clear a lock where a bill really was created — that would let a
    // retry raise a second bill for the same receipt.
    const bills = await db
      .collection('transactions')
      .where('type', '==', 'VENDOR_BILL')
      .where('goodsReceiptId', '==', d.id)
      .get();
    const live = bills.docs.filter((b) => !b.data().isDeleted);
    if (live.length > 0) {
      console.log(
        `  SKIP ${gr.number}: ${live.length} bill(s) exist (${live
          .map((b) => b.data().transactionNumber)
          .join(', ')}) — set paymentRequestId to the bill id by hand`
      );
      continue;
    }
    clearable.push({ ref: d.ref, number: gr.number });
    console.log(`  ${gr.number}: no bill found, lock is safe to release`);
  }

  if (!APPLY || clearable.length === 0) return;
  const batch = db.batch();
  clearable.forEach((r) =>
    batch.update(r.ref, {
      paymentRequestId: null,
      updatedAt: admin.firestore.Timestamp.now(),
    })
  );
  await batch.commit();
  console.log(`  applied to ${clearable.length} goods receipt(s)`);
}

(async () => {
  console.log(APPLY ? '*** APPLY MODE — writing ***' : '*** DRY RUN — pass --apply to write ***');
  await backfillBillPOLink();
  await backfillTaxableValue();
  await clearStrandedGRLocks();
  console.log('\ndone');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
