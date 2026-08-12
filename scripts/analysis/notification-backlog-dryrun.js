/**
 * Notification backlog — DRY RUN (reads only, writes nothing).
 *
 * Counts open taskNotifications whose source document has already reached a
 * terminal state, i.e. the ones the Phase 0.2 auto-close wiring would have
 * closed had it existed. Run from the repo root so firebase-admin resolves:
 *
 *   node scripts/analysis/notification-backlog-dryrun.js
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
    rows.push({
      entityType,
      open: notifications.length,
      sourceTerminal: closable.length,
      note: closable.length === notifications.length ? 'all stale' : '',
    });
  }

  rows.sort((a, b) => b.open - a.open);
  console.table(rows);

  console.log(`\nWould complete (source already terminal): ${closableTotal}`);
  console.log(`Would acknowledge (informational older than 30 days): ${informationalOld.length}`);
  console.log(
    `\nRemaining open afterwards: ~${snap.size - closableTotal} — the genuinely live queue.`
  );
  console.log('\nDRY RUN — nothing was written.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Dry run failed:', err);
    process.exit(1);
  });
