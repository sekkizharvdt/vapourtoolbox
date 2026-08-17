#!/usr/bin/env node
/**
 * Repoint procurement lines at the bought-out products that replaced their
 * materials, after scripts/analysis/migrate-boughtout-taxonomy.js has run.
 *
 * Plan of record: docs/reviews/2026-08-16-materials-taxonomy-cleanup.md
 *
 * 18 lines reference a material the migration moved. They split into two groups
 * that deserve different treatment:
 *
 *   OPEN (15)   — 3 items on DRAFT purchase requests, 12 items on UPLOADED
 *                 vendor quotes. These are live working documents; if a user
 *                 edits one, the material lookup now comes up empty because
 *                 `queryMaterials` drops `isMigrated` docs. Repoint them.
 *
 *   CLOSED (3)  — one Grommet running PR/2026/0016 (CONVERTED_TO_RFQ) →
 *                 RFQ/2026/009 (PO_PROCESSED) → PO/2026/004 (COMPLETED).
 *                 A completed order is a record of what was actually bought.
 *                 Rewriting it to point at a re-shaped catalogue would edit
 *                 history for no operational gain: the source material document
 *                 still exists (flagged, not deleted) and the line carries
 *                 denormalized code/name (rule 26), so those documents display
 *                 exactly as they did before. LEFT ALONE, and reported.
 *
 * DRY RUN BY DEFAULT. Nothing is written without --apply.
 *
 *   node ./scripts/analysis/repoint-migrated-references.js
 *   node ./scripts/analysis/repoint-migrated-references.js --apply
 *
 * Run from the repo root so `firebase-admin` resolves.
 */

const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const key = require('../../docs/inputs/firebase-service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

/** Parent statuses that mean "this document is finished — do not rewrite it". */
const TERMINAL_STATUSES = new Set([
  'CONVERTED_TO_RFQ',
  'PO_PROCESSED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'PO_CREATED',
]);

/** Line collection → [parent id field, parent collection]. */
const LINE_SOURCES = {
  purchaseRequestItems: ['purchaseRequestId', 'purchaseRequests'],
  rfqItems: ['rfqId', 'rfqs'],
  purchaseOrderItems: ['purchaseOrderId', 'purchaseOrders'],
  vendorQuoteItems: ['quoteId', 'vendorQuotes'],
  goodsReceiptItems: ['goodsReceiptId', 'goodsReceipts'],
};

(async () => {
  // materialId → { code, productId }, for everything the migration moved.
  const materials = await db.collection('materials').get();
  const moved = new Map();
  materials.forEach((d) => {
    const m = d.data();
    if (m.isMigrated === true && m.migratedToBoughtOutItemId) {
      moved.set(d.id, { code: m.materialCode, productId: m.migratedToBoughtOutItemId });
    }
  });

  const productSnap = await db.collection('bought_out_items').get();
  const products = new Map();
  productSnap.forEach((d) => products.set(d.id, { id: d.id, ...d.data() }));

  const planned = [];
  const skipped = [];
  const problems = [];

  for (const [collectionName, [parentField, parentCollection]] of Object.entries(LINE_SOURCES)) {
    const lines = await db.collection(collectionName).get();

    for (const lineDoc of lines.docs) {
      const line = lineDoc.data();
      if (!line.materialId || !moved.has(line.materialId)) continue;

      const { code, productId } = moved.get(line.materialId);
      const product = products.get(productId);
      const matches = (product?.variants ?? []).filter((v) => v.migratedFromMaterialCode === code);

      if (!product) {
        problems.push({ collectionName, id: lineDoc.id, code, reason: 'product missing' });
        continue;
      }

      // A butt-weld fitting document carried NO schedule (`applicableSchedules`
      // was the literal string "All"), and the migration expanded it into one
      // variant per schedule the mating pipe offers. So a single source code can
      // match many variants — taking the first would silently commit the line to
      // Sch 5 when the requester never said a schedule at all, and Sch 5 vs
      // Sch 160 is a different article at a different price.
      //
      // Point the line at the PRODUCT and leave the variant unset: the product
      // is known, the size genuinely is not. The buyer picks it, which is the
      // same thing they would have had to do before the migration.
      const variant = matches.length === 1 ? matches[0] : undefined;

      if (matches.length === 0) {
        problems.push({ collectionName, id: lineDoc.id, code, reason: 'no matching variant' });
        continue;
      }

      // Read the parent's status — a finished document is not rewritten.
      let parentStatus = null;
      let parentNumber = '';
      if (line[parentField]) {
        const parent = await db.collection(parentCollection).doc(line[parentField]).get();
        if (parent.exists) {
          parentStatus = parent.data().status ?? null;
          parentNumber = parent.data().number ?? '';
        }
      }

      const entry = {
        collectionName,
        id: lineDoc.id,
        code,
        parentNumber,
        parentStatus,
        product,
        variant,
        ambiguousSizes: matches.length > 1 ? matches.length : 0,
      };
      if (parentStatus && TERMINAL_STATUSES.has(parentStatus)) skipped.push(entry);
      else planned.push(entry);
    }
  }

  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN — no writes'}\n`);
  console.log(`repointing : ${planned.length}`);
  for (const p of planned) {
    console.log(
      `   ${p.collectionName.padEnd(20)} ${String(p.code).padEnd(26)} ` +
        `${String(p.parentNumber).padEnd(15)} ${String(p.parentStatus).padEnd(18)} ` +
        `→ ${p.product.itemCode} / ` +
        (p.variant
          ? p.variant.variantCode
          : `SIZE NOT SET (${p.ambiguousSizes} schedules — source had none)`)
    );
  }

  console.log(`\nleft alone (finished documents) : ${skipped.length}`);
  for (const s of skipped) {
    console.log(
      `   ${s.collectionName.padEnd(20)} ${String(s.code).padEnd(26)} ` +
        `${String(s.parentNumber).padEnd(15)} ${s.parentStatus}`
    );
  }

  if (problems.length) {
    console.log(`\n⚠ unresolvable : ${problems.length}`);
    problems.forEach((p) => console.log('   ' + JSON.stringify(p)));
  }

  if (!APPLY) {
    console.log('\nRe-run with --apply to write.');
    process.exit(0);
  }

  const now = admin.firestore.Timestamp.now();
  let written = 0;
  for (let i = 0; i < planned.length; i += 400) {
    const batch = db.batch();
    for (const p of planned.slice(i, i + 400)) {
      batch.update(db.collection(p.collectionName).doc(p.id), {
        boughtOutItemId: p.product.id,
        boughtOutItemCode: p.product.itemCode,
        boughtOutItemName: p.product.name,
        // Only when the source resolved to exactly one size.
        ...(p.variant && {
          boughtOutVariantId: p.variant.id,
          boughtOutVariantCode: p.variant.variantCode,
        }),
        catalogRef: {
          kind: 'BOUGHT_OUT',
          id: p.product.id,
          code: p.product.itemCode,
          name: p.product.name,
        },
        // materialId/Code/Name are deliberately LEFT IN PLACE. They are the
        // provenance of the line — what it was raised against — and clearing
        // them would lose the only trail back to the pre-migration catalogue.
        // Consumers read catalogRef first (design 2026-06-15 §3.1).
        updatedAt: now,
      });
      written++;
    }
    await batch.commit();
  }

  console.log(`\nrepointed ${written} lines; ${skipped.length} finished documents untouched.`);
  process.exit(0);
})().catch((err) => {
  console.error('repoint failed:', err);
  process.exit(1);
});
