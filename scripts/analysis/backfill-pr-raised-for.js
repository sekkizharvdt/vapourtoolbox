/**
 * One-off backfill: purchase requests from `type` to `raisedFor` + `isBudgetary`.
 *
 * The old `PurchaseRequestType` ('PROJECT' | 'BUDGETARY' | 'INTERNAL') mixed two
 * questions — what the request is for, and whether it is a price check. Every
 * live document maps deterministically onto the split, so this runs once rather
 * than shipping lift-on-load fallbacks (CLAUDE.md rule 31):
 *
 *   PROJECT  + real project id   → raisedFor PROJECT,  isBudgetary false
 *   PROJECT  + cost-centre id    → raisedFor INTERNAL, costCentre CC-ADMIN
 *   BUDGETARY                    → raisedFor PROJECT,  isBudgetary true
 *   INTERNAL                     → raisedFor INTERNAL, costCentre CC-ADMIN
 *
 * It also drops `priority` (deleted with the form field — its only consumer was
 * the approval notification) and stamps `itemType` onto line items that predate
 * that field, from their parent's category.
 *
 * Run from the repo root so firebase-admin resolves:
 *   node scripts/analysis/backfill-pr-raised-for.js --dry-run
 *   node scripts/analysis/backfill-pr-raised-for.js --commit
 */

const admin = require('firebase-admin');
const path = require('path');

const ADMIN_COST_CENTRE_CODE = 'CC-ADMIN';
const CATEGORY_TO_ITEM_TYPE = {
  RAW_MATERIAL: 'MATERIAL',
  BOUGHT_OUT: 'BOUGHT_OUT',
  SERVICE: 'SERVICE',
};

const commit = process.argv.includes('--commit');
if (!commit && !process.argv.includes('--dry-run')) {
  console.error('Pass --dry-run to preview or --commit to write.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(
    require(path.join(process.cwd(), 'docs/inputs/firebase-service-account-key.json'))
  ),
});
const db = admin.firestore();
const { FieldValue } = admin.firestore;

async function main() {
  const [prSnap, projectSnap, costCentreSnap, itemSnap] = await Promise.all([
    db.collection('purchaseRequests').get(),
    db.collection('projects').get(),
    db.collection('costCentres').where('code', '==', ADMIN_COST_CENTRE_CODE).get(),
    db.collection('purchaseRequestItems').get(),
  ]);

  const adminCostCentre = costCentreSnap.docs[0];
  if (!adminCostCentre) {
    throw new Error(
      `No cost centre with code ${ADMIN_COST_CENTRE_CODE}. Internal requests have nowhere to be charged — create it before running this.`
    );
  }

  const projectIds = new Set(projectSnap.docs.map((d) => d.id));
  const prCategory = new Map();
  const updates = [];

  prSnap.docs.forEach((docSnap) => {
    const pr = docSnap.data();
    prCategory.set(docSnap.id, pr.category);

    if (pr.raisedFor) return; // already migrated — safe to re-run (rule 9)

    const pointsAtProject = Boolean(pr.projectId && projectIds.has(pr.projectId));
    let patch;

    if (pr.type === 'BUDGETARY') {
      patch = { raisedFor: 'PROJECT', isBudgetary: true };
    } else if (pr.type === 'INTERNAL' || !pointsAtProject) {
      patch = {
        raisedFor: 'INTERNAL',
        isBudgetary: false,
        costCentreId: adminCostCentre.id,
        costCentreCode: adminCostCentre.data().code,
        projectId: FieldValue.delete(),
        projectName: FieldValue.delete(),
      };
    } else {
      patch = { raisedFor: 'PROJECT', isBudgetary: false };
    }

    updates.push({
      ref: docSnap.ref,
      number: pr.number,
      from: pr.type,
      patch: { ...patch, type: FieldValue.delete(), priority: FieldValue.delete() },
    });
  });

  // Items predating `itemType` inherit their PR's category.
  const itemUpdates = [];
  itemSnap.docs.forEach((docSnap) => {
    const item = docSnap.data();
    if (item.itemType) return;
    const itemType = CATEGORY_TO_ITEM_TYPE[prCategory.get(item.purchaseRequestId)];
    if (!itemType) return; // orphaned item — leave it alone rather than guess
    itemUpdates.push({ ref: docSnap.ref, patch: { itemType } });
  });

  console.log(`Purchase requests to migrate: ${updates.length} / ${prSnap.size}`);
  updates.forEach((u) =>
    console.log(
      `  ${u.number}: ${u.from} → raisedFor=${u.patch.raisedFor} isBudgetary=${u.patch.isBudgetary}` +
        (u.patch.costCentreCode ? ` costCentre=${u.patch.costCentreCode}` : '')
    )
  );
  console.log(`Line items needing itemType: ${itemUpdates.length} / ${itemSnap.size}`);

  if (!commit) {
    console.log('\nDry run — nothing written. Re-run with --commit to apply.');
    return;
  }

  // Chunked at 500 writes per batch (rule 20).
  const all = [...updates, ...itemUpdates];
  for (let i = 0; i < all.length; i += 500) {
    const batch = db.batch();
    all.slice(i, i + 500).forEach(({ ref, patch }) => batch.update(ref, patch));
    await batch.commit();
    console.log(`Committed ${Math.min(i + 500, all.length)} / ${all.length} writes`);
  }
  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
