#!/usr/bin/env node
/**
 * Migration script: Reconcile payment statuses for all bills and invoices
 *
 * Run with: node scripts/migrate-reconcile-payment-statuses.js [--dry-run]
 *
 * Two-pass reconciliation:
 *   Pass 1 — Allocation-based: sums all payment allocations per bill/invoice
 *            and corrects amountPaid / outstandingAmount / paymentStatus.
 *   Pass 2 — Journal-entry settlement: for bills/invoices still UNPAID after
 *            Pass 1, computes per-entity net balance (including JEs, opening
 *            balances). If an entity's net position is fully settled, marks
 *            remaining UNPAID items as PAID with settledViaJournal flag.
 *
 * Use --dry-run to preview changes without writing to Firestore.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ── Resolve service account ────────────────────────────────────────────
const candidates = [
  path.join(__dirname, '../firebase-service-account.json'),
  path.join(__dirname, '../mcp-servers/accounting-audit/service-account-key.json'),
];

let serviceAccountPath = null;
for (const p of candidates) {
  if (fs.existsSync(p)) {
    serviceAccountPath = p;
    break;
  }
}

if (!serviceAccountPath) {
  console.error('❌ Error: No service account key found.');
  console.error('Looked in:');
  candidates.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}

console.log(`Using service account: ${path.relative(process.cwd(), serviceAccountPath)}\n`);

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
});

const db = admin.firestore();
const DRY_RUN = process.argv.includes('--dry-run');

// ── Helpers ────────────────────────────────────────────────────────────
const OPENING_BALANCE_ID = '__opening_balance__';

function computePaymentStatus(totalAmount, amountPaid) {
  const outstanding = parseFloat(Math.max(0, totalAmount - amountPaid).toFixed(2));
  let status;
  if (outstanding === 0 && totalAmount > 0) {
    status = 'PAID';
  } else if (amountPaid > 0) {
    status = 'PARTIALLY_PAID';
  } else {
    status = 'UNPAID';
  }
  return { status, outstanding };
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  console.log(
    DRY_RUN
      ? '🔍 DRY RUN — no changes will be written\n'
      : '🔧 LIVE RUN — changes will be committed\n'
  );

  const txRef = db.collection('transactions');

  // ──────────────────────────────────────────────────────────────────────
  //  Pass 1: Allocation-based reconciliation
  // ──────────────────────────────────────────────────────────────────────
  console.log('═══ Pass 1: Allocation-based reconciliation ═══\n');

  // 1a. Build allocation map: invoiceId → total allocated amount
  const paymentSnap = await txRef.where('type', 'in', ['CUSTOMER_PAYMENT', 'VENDOR_PAYMENT']).get();

  const allocationMap = new Map();
  paymentSnap.forEach((doc) => {
    const data = doc.data();
    if (data.isDeleted) return;

    const allocations =
      data.type === 'CUSTOMER_PAYMENT' ? data.invoiceAllocations || [] : data.billAllocations || [];

    for (const alloc of allocations) {
      if (alloc.invoiceId && alloc.allocatedAmount > 0 && alloc.invoiceId !== OPENING_BALANCE_ID) {
        const current = allocationMap.get(alloc.invoiceId) ?? 0;
        allocationMap.set(alloc.invoiceId, current + alloc.allocatedAmount);
      }
    }
  });

  console.log(`  Payments scanned: ${paymentSnap.size}`);
  console.log(`  Unique allocations: ${allocationMap.size}\n`);

  // 1b. Get all bills and invoices
  const [billSnap, invoiceSnap] = await Promise.all([
    txRef.where('type', '==', 'VENDOR_BILL').get(),
    txRef.where('type', '==', 'CUSTOMER_INVOICE').get(),
  ]);

  const allDocs = [...billSnap.docs, ...invoiceSnap.docs];
  let checked = 0;
  let pass1Fixed = 0;
  const pass1Details = [];

  let batch = db.batch();
  let batchCount = 0;

  for (const docSnap of allDocs) {
    const data = docSnap.data();
    if (data.isDeleted) continue;
    checked++;

    const totalAmountINR = data.baseAmount || data.totalAmount || 0;
    const correctPaid = allocationMap.get(docSnap.id) ?? 0;
    const { status: correctStatus, outstanding: correctOutstanding } = computePaymentStatus(
      totalAmountINR,
      correctPaid
    );

    const currentPaid = data.amountPaid ?? 0;
    const currentStatus = data.paymentStatus ?? 'UNPAID';
    const currentOutstanding = data.outstandingAmount;

    const paidMismatch = Math.abs(currentPaid - correctPaid) > 0.01;
    const statusMismatch = currentStatus !== correctStatus;
    const outstandingMissing = currentOutstanding === undefined || currentOutstanding === null;
    const outstandingMismatch =
      !outstandingMissing && Math.abs(currentOutstanding - correctOutstanding) > 0.01;

    if (paidMismatch || statusMismatch || outstandingMissing || outstandingMismatch) {
      if (!DRY_RUN) {
        batch.update(docSnap.ref, {
          amountPaid: correctPaid,
          outstandingAmount: correctOutstanding,
          paymentStatus: correctStatus,
          updatedAt: admin.firestore.Timestamp.now(),
        });
        batchCount++;

        if (batchCount >= 490) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      pass1Fixed++;
      pass1Details.push({
        number: data.transactionNumber || docSnap.id,
        type: data.type,
        entity: data.entityName || data.entityId || '-',
        was: `${currentStatus} (paid: ${currentPaid.toFixed(2)})`,
        now: `${correctStatus} (paid: ${correctPaid.toFixed(2)})`,
      });
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  console.log(`  Checked: ${checked}`);
  console.log(`  Fixed:   ${pass1Fixed}\n`);

  if (pass1Details.length > 0) {
    console.log('  Pass 1 changes:');
    for (const d of pass1Details) {
      console.log(`    ${d.type.padEnd(18)} ${d.number.padEnd(14)} ${d.entity}`);
      console.log(`      ${d.was}  →  ${d.now}`);
    }
    console.log();
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Pass 2: Journal-entry settlement (entity-level net balance)
  // ──────────────────────────────────────────────────────────────────────
  console.log('═══ Pass 2: Journal-entry settlement ═══\n');

  // 2a. Compute entity-level net balance from ALL transaction types
  const allTxnSnap = await txRef
    .where('type', 'in', [
      'CUSTOMER_INVOICE',
      'CUSTOMER_PAYMENT',
      'VENDOR_BILL',
      'VENDOR_PAYMENT',
      'JOURNAL_ENTRY',
      'DIRECT_PAYMENT',
      'DIRECT_RECEIPT',
    ])
    .get();

  const entityTxnBalance = new Map();
  const addToBalance = (entityId, delta) => {
    if (!entityId) return;
    entityTxnBalance.set(entityId, (entityTxnBalance.get(entityId) ?? 0) + delta);
  };

  allTxnSnap.forEach((txnDoc) => {
    const data = txnDoc.data();
    if (data.isDeleted) return;
    const amount = data.baseAmount || data.totalAmount || data.amount || 0;

    switch (data.type) {
      case 'CUSTOMER_INVOICE':
        addToBalance(data.entityId, amount);
        break;
      case 'VENDOR_BILL':
        addToBalance(data.entityId, -amount);
        break;
      case 'CUSTOMER_PAYMENT':
        addToBalance(data.entityId, -amount);
        break;
      case 'VENDOR_PAYMENT':
        addToBalance(data.entityId, amount);
        break;
      case 'DIRECT_PAYMENT':
        addToBalance(data.entityId, amount);
        break;
      case 'DIRECT_RECEIPT':
        addToBalance(data.entityId, -amount);
        break;
      case 'JOURNAL_ENTRY': {
        const entries = data.entries || [];
        const perEntity = new Map();
        entries.forEach((entry) => {
          if (!entry.entityId) return;
          perEntity.set(
            entry.entityId,
            (perEntity.get(entry.entityId) ?? 0) + (entry.debit || 0) - (entry.credit || 0)
          );
        });
        perEntity.forEach((delta, eid) => addToBalance(eid, delta));
        break;
      }
    }
  });

  // 2b. Add entity opening balances
  const entityIds = [...entityTxnBalance.keys()];
  const entityBalanceMap = new Map();
  entityTxnBalance.forEach((balance, eid) => entityBalanceMap.set(eid, balance));

  if (entityIds.length > 0) {
    const entitiesRef = db.collection('entities');
    // Firestore 'in' queries limited to 30 items
    for (let i = 0; i < entityIds.length; i += 30) {
      const batchIds = entityIds.slice(i, i + 30);
      const entitySnap = await entitiesRef
        .where(admin.firestore.FieldPath.documentId(), 'in', batchIds)
        .get();

      entitySnap.forEach((entityDoc) => {
        const eData = entityDoc.data();
        const openingBalance = eData.openingBalance || 0;
        const signedOpening = eData.openingBalanceType === 'CR' ? -openingBalance : openingBalance;
        entityBalanceMap.set(
          entityDoc.id,
          signedOpening + (entityTxnBalance.get(entityDoc.id) ?? 0)
        );
      });
    }
  }

  // Log entity balances for reference
  console.log('  Entity net balances (non-zero):');
  let nonZeroCount = 0;
  entityBalanceMap.forEach((balance, eid) => {
    if (Math.abs(balance) > 0.01) {
      nonZeroCount++;
    }
  });
  console.log(`    ${entityBalanceMap.size} entities, ${nonZeroCount} with non-zero balance\n`);

  // 2c. Re-read bills/invoices (they may have been updated by Pass 1)
  // For efficiency, filter to only UNPAID/PARTIALLY_PAID items
  let pass2Fixed = 0;
  const pass2Details = [];

  let jeBatch = db.batch();
  let jeBatchCount = 0;

  for (const docSnap of allDocs) {
    const data = docSnap.data();
    if (data.isDeleted) continue;

    // After Pass 1, check current status from details or original data
    const pass1Change = pass1Details.find(
      (d) => d.number === (data.transactionNumber || docSnap.id)
    );
    const currentStatus = pass1Change
      ? pass1Change.now.split(' ')[0]
      : (data.paymentStatus ?? 'UNPAID');

    if (currentStatus === 'PAID') continue;

    const entityId = data.entityId;
    if (!entityId) continue;

    const entityBalance = entityBalanceMap.get(entityId) ?? 0;
    const isSettled =
      (data.type === 'VENDOR_BILL' && entityBalance >= -0.01) ||
      (data.type === 'CUSTOMER_INVOICE' && entityBalance <= 0.01);

    if (!isSettled) continue;

    const totalAmountINR = data.baseAmount || data.totalAmount || 0;
    if (totalAmountINR <= 0) continue;

    if (!DRY_RUN) {
      jeBatch.update(docSnap.ref, {
        paymentStatus: 'PAID',
        amountPaid: totalAmountINR,
        outstandingAmount: 0,
        settledViaJournal: true,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      jeBatchCount++;

      if (jeBatchCount >= 490) {
        await jeBatch.commit();
        jeBatch = db.batch();
        jeBatchCount = 0;
      }
    }

    pass2Fixed++;
    pass2Details.push({
      number: data.transactionNumber || docSnap.id,
      type: data.type,
      entity: data.entityName || entityId,
      was: `${currentStatus} (paid: ${(data.amountPaid ?? 0).toFixed(2)})`,
      now: `PAID (settled via journal, entity balance: ${entityBalance.toFixed(2)})`,
    });
  }

  if (!DRY_RUN && jeBatchCount > 0) {
    await jeBatch.commit();
  }

  console.log(`  Fixed:   ${pass2Fixed}\n`);

  if (pass2Details.length > 0) {
    console.log('  Pass 2 changes:');
    for (const d of pass2Details) {
      console.log(`    ${d.type.padEnd(18)} ${d.number.padEnd(14)} ${d.entity}`);
      console.log(`      ${d.was}  →  ${d.now}`);
    }
    console.log();
  }

  // ── Summary ──────────────────────────────────────────────────────────
  const totalFixed = pass1Fixed + pass2Fixed;
  console.log('═══ Summary ═══\n');
  console.log(`  Bills/invoices checked: ${checked}`);
  console.log(`  Pass 1 (allocation):    ${pass1Fixed} fixed`);
  console.log(`  Pass 2 (JE settlement): ${pass2Fixed} fixed`);
  console.log(`  Total fixed:            ${totalFixed}`);
  console.log();

  if (DRY_RUN && totalFixed > 0) {
    console.log('  ⚠️  This was a dry run. Re-run without --dry-run to apply changes.');
  } else if (totalFixed > 0) {
    console.log('  ✅ All changes committed to Firestore.');
  } else {
    console.log('  ✅ No changes needed — all payment statuses are correct.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  });
