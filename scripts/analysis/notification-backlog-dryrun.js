/**
 * Notification backlog — audit, and optionally clear it.
 *
 * Finds open taskNotifications whose source document has already reached a
 * terminal state: the ones the Phase 0.2 auto-close wiring would have closed
 * had it existed. Run from the repo root so firebase-admin resolves:
 *
 *   node scripts/analysis/notification-backlog-dryrun.js            # read-only
 *   node scripts/analysis/notification-backlog-dryrun.js --apply    # writes
 *
 * `--apply` performs three passes, all chunked at 500 ops (rule 20):
 *
 *   1. complete notifications whose source is terminal
 *   2. acknowledge informational notifications older than 30 days
 *   3. clear `autoCompletable` on the categories no workflow can close
 *      (WCC_READY_FOR_BILLING, DOCUMENT_INTERNAL_REVIEW — plan D7), so a
 *      person can tick them off
 *
 * Every touched document is stamped `backfill: { at, pass }`, so what the
 * script changed can be found later and undone:
 *
 *   db.collection('taskNotifications').where('backfill.pass', '==', 'complete-stale')
 *
 * This writes to other users' inboxes, not only the operator's. Run the
 * read-only pass first and read the table.
 *
 * Plan: docs/reviews/2026-08-12-flow-my-work-plan.md (Phase 0.4).
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../docs/inputs/firebase-service-account-key.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

/** entityType → { collection, terminal: Set<status> } */
const SOURCES = {
  FEEDBACK: { collection: 'feedback', terminal: new Set(['closed', 'wont_fix']) },
  PURCHASE_REQUEST: {
    collection: 'purchaseRequests',
    terminal: new Set(['APPROVED', 'REJECTED', 'CANCELLED', 'CONVERTED_TO_RFQ', 'COMPLETED']),
  },
  PURCHASE_ORDER: {
    collection: 'purchaseOrders',
    terminal: new Set(['APPROVED', 'REJECTED', 'ISSUED', 'COMPLETED', 'CANCELLED', 'CLOSED']),
  },
  PURCHASE_ORDER_AMENDMENT: {
    collection: 'purchaseOrderAmendments',
    terminal: new Set(['APPROVED', 'REJECTED', 'CANCELLED']),
  },
  RFQ: { collection: 'rfqs', terminal: new Set(['COMPLETED', 'CANCELLED', 'CLOSED']) },
  PROPOSAL: {
    collection: 'proposals',
    terminal: new Set(['APPROVED', 'REJECTED', 'SUBMITTED_TO_CLIENT', 'WON', 'LOST', 'CANCELLED']),
  },
  PROJECT: { collection: 'projects', terminal: new Set([]) }, // charter status is nested — reported separately
  GOODS_RECEIPT: {
    collection: 'goodsReceipts',
    terminal: new Set(['COMPLETED', 'BILLED', 'CANCELLED', 'PAID']),
  },
  HR_LEAVE_REQUEST: {
    collection: 'hrLeaveRequests',
    terminal: new Set(['APPROVED', 'REJECTED', 'CANCELLED']),
  },
  HR_TRAVEL_EXPENSE: {
    collection: 'hrTravelExpenses',
    terminal: new Set(['APPROVED', 'REJECTED', 'CANCELLED', 'PAID', 'REIMBURSED']),
  },
  INVOICE: {
    collection: 'transactions',
    terminal: new Set(['APPROVED', 'REJECTED', 'PAID', 'CANCELLED', 'VOID']),
  },
  BILL: {
    collection: 'transactions',
    terminal: new Set(['APPROVED', 'REJECTED', 'PAID', 'CANCELLED', 'VOID']),
  },
  WORK_COMPLETION_CERTIFICATE: {
    collection: 'workCompletionCertificates',
    terminal: new Set(['BILLED', 'CANCELLED', 'COMPLETED']),
  },
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Firestore's hard cap on operations in one batch (rule 20). */
const BATCH_SIZE = 500;

/** Categories that are autoCompletable with no workflow able to complete them. */
const UNCLOSABLE_CATEGORIES = new Set(['WCC_READY_FOR_BILLING', 'DOCUMENT_INTERNAL_REVIEW']);

const APPLY = process.argv.includes('--apply');

/**
 * Commit `updates` in chunks. Each entry is { ref, data }.
 * Returns the number of documents written.
 */
async function commitInChunks(updates, label) {
  if (updates.length === 0) return 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const slice = updates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    slice.forEach(({ ref, data }) => batch.update(ref, data));
    await batch.commit();
    console.log(
      `   ${label}: committed ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`
    );
  }

  return updates.length;
}

async function main() {
  const snap = await db
    .collection('taskNotifications')
    .where('status', 'in', ['pending', 'in_progress'])
    .get();

  console.log(`Open notifications: ${snap.size}\n`);

  const byEntity = new Map();
  const informationalOld = [];
  const now = Date.now();

  snap.forEach((d) => {
    const x = d.data();
    const key = x.entityType || '(none)';
    if (!byEntity.has(key)) byEntity.set(key, []);
    byEntity.get(key).push({ id: d.id, ...x });

    const created = x.createdAt?.toDate?.();
    if (x.type === 'informational' && created && now - created.getTime() > THIRTY_DAYS_MS) {
      informationalOld.push(d.id);
    }
  });

  const rows = [];
  let closableTotal = 0;
  const closableIds = [];

  for (const [entityType, notifications] of byEntity) {
    const source = SOURCES[entityType];
    if (!source || source.terminal.size === 0) {
      rows.push({
        entityType,
        open: notifications.length,
        sourceTerminal: '—',
        note: source ? 'nested status — needs manual review' : 'no source mapping',
      });
      continue;
    }

    const ids = [...new Set(notifications.map((n) => n.entityId).filter(Boolean))];
    const statusById = new Map();

    // Chunked getAll — 30 refs at a time, mirroring the client `in` limit
    for (let i = 0; i < ids.length; i += 30) {
      const refs = ids.slice(i, i + 30).map((id) => db.collection(source.collection).doc(id));
      const docs = await db.getAll(...refs);
      docs.forEach((doc) => {
        statusById.set(doc.id, doc.exists ? doc.data().status : '(missing)');
      });
    }

    const closable = notifications.filter((n) => {
      const status = statusById.get(n.entityId);
      return status === '(missing)' || source.terminal.has(status);
    });

    closableTotal += closable.length;
    closable.forEach((n) => closableIds.push(n.id));
    rows.push({
      entityType,
      open: notifications.length,
      sourceTerminal: closable.length,
      note: closable.length === notifications.length ? 'all stale' : '',
    });
  }

  rows.sort((a, b) => b.open - a.open);
  console.table(rows);

  // Items nobody can close: autoCompletable, but no workflow completes them and
  // the UI hides the manual button for exactly that flag (plan D7).
  const stuckIds = [];
  byEntity.forEach((notifications) => {
    notifications.forEach((n) => {
      if (
        n.autoCompletable &&
        UNCLOSABLE_CATEGORIES.has(n.category) &&
        !closableIds.includes(n.id)
      ) {
        stuckIds.push(n.id);
      }
    });
  });

  console.log(`\nComplete (source already terminal):            ${closableTotal}`);
  console.log(`Acknowledge (informational older than 30 days): ${informationalOld.length}`);
  console.log(`Un-stick (autoCompletable with no closer):      ${stuckIds.length}`);
  console.log(
    `\nRemaining open afterwards: ~${snap.size - closableTotal} — the genuinely live queue.`
  );

  if (!APPLY) {
    console.log('\nDRY RUN — nothing was written. Re-run with --apply to commit.');
    return;
  }

  console.log('\nAPPLYING…\n');
  const at = admin.firestore.Timestamp.now();
  const col = db.collection('taskNotifications');

  const completed = await commitInChunks(
    closableIds.map((id) => ({
      ref: col.doc(id),
      data: {
        status: 'completed',
        autoCompletedAt: at,
        completionConfirmed: true,
        read: true,
        updatedAt: at,
        backfill: { at, pass: 'complete-stale' },
      },
    })),
    'complete-stale'
  );

  // Acknowledging only touches items still open — anything completed by the
  // pass above is already gone from the list.
  const acknowledged = await commitInChunks(
    informationalOld
      .filter((id) => !closableIds.includes(id))
      .map((id) => ({
        ref: col.doc(id),
        data: {
          status: 'acknowledged',
          acknowledgedAt: at,
          read: true,
          updatedAt: at,
          backfill: { at, pass: 'acknowledge-old-informational' },
        },
      })),
    'acknowledge-old'
  );

  const unstuck = await commitInChunks(
    stuckIds.map((id) => ({
      ref: col.doc(id),
      data: {
        autoCompletable: false,
        updatedAt: at,
        backfill: { at, pass: 'unstick-autocompletable' },
      },
    })),
    'unstick'
  );

  console.log(
    `\nDone. completed=${completed} acknowledged=${acknowledged} unstuck=${unstuck}\n` +
      `Undo a pass with: where('backfill.pass', '==', '<pass>')`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Dry run failed:', err);
    process.exit(1);
  });
