#!/usr/bin/env node
/**
 * Migration: offers + vendorOffers → vendorQuotes + vendorQuoteItems
 *
 * Stage 2/3 prerequisite. Idempotent — reruns skip already-migrated docs by
 * checking the `migratedFromId` field on vendorQuotes.
 *
 * What it does:
 *   - Reads every doc from `offers` and creates a matching `vendorQuotes` doc
 *     with sourceType=RFQ_RESPONSE, carrying all fields + migratedFromId +
 *     migratedFromCollection.
 *   - Reads every child from `offerItems` and writes as `vendorQuoteItems`.
 *   - Reads every doc from `vendorOffers` and creates a matching `vendorQuotes`
 *     with sourceType=STANDING_QUOTE.
 *   - Reads every child from `vendorOfferItems` and writes as `vendorQuoteItems`.
 *   - Does NOT delete the old collections. That happens in Stage 3 after
 *     consumers have moved off.
 *
 * Safe to run multiple times.
 *
 * Usage:
 *   node scripts/migrate-offers-to-vendor-quotes.js [--dry-run]
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.resolve(
  __dirname,
  '../mcp-servers/firebase-feedback/service-account-key.json'
);

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
});

const db = admin.firestore();
const DRY_RUN = process.argv.includes('--dry-run');

function log(...args) {
  console.log(DRY_RUN ? '[DRY RUN]' : '[MIGRATE]', ...args);
}

/** Return a Set of old-source IDs that have already been migrated. */
async function fetchAlreadyMigrated() {
  const snap = await db.collection('vendorQuotes').get();
  const byOldId = new Set();
  snap.forEach((d) => {
    const data = d.data();
    if (data.migratedFromId) byOldId.add(`${data.migratedFromCollection}:${data.migratedFromId}`);
  });
  return byOldId;
}

async function migrateOffer(offerDoc, alreadyMigrated) {
  const key = `offers:${offerDoc.id}`;
  if (alreadyMigrated.has(key)) {
    log(`skip ${key} (already migrated)`);
    return null;
  }

  const o = offerDoc.data();
  const quoteDoc = {
    number: o.number || o.offerNumber || `Q-MIGRATED-${offerDoc.id.slice(0, 8)}`,
    tenantId: o.tenantId,

    sourceType: 'RFQ_RESPONSE',
    rfqId: o.rfqId,
    rfqNumber: o.rfqNumber,
    rfqMode: 'ONLINE',

    vendorId: o.vendorId,
    vendorName: o.vendorName,
    vendorOfferNumber: o.vendorOfferNumber,
    vendorOfferDate: o.vendorOfferDate,

    fileUrl: o.offerFileUrl,
    additionalDocuments: o.additionalDocuments,
    itemsParsed: o.itemsParsed !== false,

    subtotal: o.subtotal || 0,
    taxAmount: o.taxAmount || 0,
    totalAmount: o.totalAmount || 0,
    currency: o.currency || 'INR',
    discount: o.discount,

    paymentTerms: o.paymentTerms,
    deliveryTerms: o.deliveryTerms,
    validityDate: o.validityDate,
    warrantyTerms: o.warrantyTerms,

    exWorks: o.exWorks,
    transportation: o.transportation,
    packingForwarding: o.packingForwarding,
    insurance: o.insurance,
    erectionAfterPurchase: o.erectionAfterPurchase,
    inspection: o.inspection,

    deviations: o.deviations,
    deviationsCheckedAt: o.deviationsCheckedAt,

    status: o.status || 'UPLOADED',
    evaluationScore: o.evaluationScore,
    evaluationNotes: o.evaluationNotes,
    isRecommended: !!o.isRecommended,
    recommendationReason: o.recommendationReason,
    redFlags: o.redFlags,

    itemCount: 0, // filled after items migrated
    acceptedCount: 0,
    isActive: true,

    createdBy: o.uploadedBy || o.createdBy || 'migration',
    createdByName: o.uploadedByName || 'Migration',
    createdAt: o.createdAt || o.uploadedAt || admin.firestore.Timestamp.now(),
    evaluatedBy: o.evaluatedBy,
    evaluatedByName: o.evaluatedByName,
    evaluatedAt: o.evaluatedAt,
    updatedAt: o.updatedAt || admin.firestore.Timestamp.now(),

    migratedFromId: offerDoc.id,
    migratedFromCollection: 'offers',
    migratedAt: admin.firestore.Timestamp.now(),
  };

  // Strip undefineds — Firestore rejects them.
  for (const k of Object.keys(quoteDoc)) if (quoteDoc[k] === undefined) delete quoteDoc[k];

  if (DRY_RUN) {
    log(`would create vendorQuote from offers/${offerDoc.id} (${quoteDoc.number})`);
    return { quoteDoc, oldId: offerDoc.id };
  }

  const quoteRef = await db.collection('vendorQuotes').add(quoteDoc);
  log(`created vendorQuote ${quoteRef.id} from offers/${offerDoc.id}`);

  // Migrate children.
  const itemsSnap = await db.collection('offerItems').where('offerId', '==', offerDoc.id).get();

  let itemCount = 0;
  const batch = db.batch();
  itemsSnap.forEach((i) => {
    const it = i.data();
    const quoteItem = {
      quoteId: quoteRef.id,
      rfqItemId: it.rfqItemId,
      itemType: 'MATERIAL', // offerItems were always material-flavoured
      lineNumber: it.lineNumber || itemCount + 1,
      description: it.description || '',

      materialId: it.materialId,
      materialCode: it.materialCode,
      materialName: it.materialName,

      quantity: it.quotedQuantity || it.quantity || 0,
      unit: it.unit || 'NOS',
      unitPrice: it.unitPrice || 0,
      amount: it.amount || (it.quotedQuantity || 0) * (it.unitPrice || 0),
      gstRate: it.gstRate,
      gstAmount: it.gstAmount,

      deliveryPeriod: it.deliveryPeriod,
      deliveryDate: it.deliveryDate,
      makeModel: it.makeModel,

      meetsSpec: it.meetsSpec,
      deviations: it.deviations,

      vendorNotes: it.vendorNotes,
      evaluationNotes: it.evaluationNotes,

      priceAccepted: false, // re-evaluate during Stage 3

      createdAt: it.createdAt || admin.firestore.Timestamp.now(),
      updatedAt: it.updatedAt || admin.firestore.Timestamp.now(),

      migratedFromId: i.id,
      migratedFromCollection: 'offerItems',
    };
    for (const k of Object.keys(quoteItem)) if (quoteItem[k] === undefined) delete quoteItem[k];
    batch.set(db.collection('vendorQuoteItems').doc(), quoteItem);
    itemCount++;
  });
  if (itemCount > 0) await batch.commit();
  if (itemCount > 0) {
    await quoteRef.update({ itemCount });
  }

  log(`  migrated ${itemCount} offer items`);
  return { quoteId: quoteRef.id, itemCount };
}

async function migrateVendorOffer(offerDoc, alreadyMigrated) {
  const key = `vendorOffers:${offerDoc.id}`;
  if (alreadyMigrated.has(key)) {
    log(`skip ${key} (already migrated)`);
    return null;
  }

  const o = offerDoc.data();
  const quoteDoc = {
    number: o.offerNumber || `Q-MIGRATED-${offerDoc.id.slice(0, 8)}`,
    tenantId: o.tenantId,

    sourceType: 'STANDING_QUOTE',
    // no rfqId / rfqMode

    vendorId: o.vendorId,
    vendorName: o.vendorName,
    vendorOfferDate: o.offerDate,

    fileUrl: o.fileUrl,
    fileName: o.fileName,
    itemsParsed: true,

    subtotal: o.totalAmount || 0,
    taxAmount: 0,
    totalAmount: o.totalAmount || 0,
    currency: o.currency || 'INR',

    validityDate: o.validityDate,
    remarks: o.remarks,

    status:
      o.status === 'REVIEWED' ? 'EVALUATED' : o.status === 'ARCHIVED' ? 'ARCHIVED' : 'UPLOADED',
    isRecommended: false,

    itemCount: o.itemCount || 0,
    acceptedCount: o.acceptedCount || 0,
    isActive: o.isActive !== false,

    createdBy: o.createdBy || 'migration',
    createdByName: o.createdByName || 'Migration',
    createdAt: o.createdAt || admin.firestore.Timestamp.now(),
    updatedAt: o.updatedAt || admin.firestore.Timestamp.now(),
    updatedBy: o.updatedBy,

    migratedFromId: offerDoc.id,
    migratedFromCollection: 'vendorOffers',
    migratedAt: admin.firestore.Timestamp.now(),
  };
  for (const k of Object.keys(quoteDoc)) if (quoteDoc[k] === undefined) delete quoteDoc[k];

  if (DRY_RUN) {
    log(`would create vendorQuote from vendorOffers/${offerDoc.id} (${quoteDoc.number})`);
    return { quoteDoc, oldId: offerDoc.id };
  }

  const quoteRef = await db.collection('vendorQuotes').add(quoteDoc);
  log(`created vendorQuote ${quoteRef.id} from vendorOffers/${offerDoc.id}`);

  // Migrate children.
  const itemsSnap = await db
    .collection('vendorOfferItems')
    .where('offerId', '==', offerDoc.id)
    .get();

  let itemCount = 0;
  const batch = db.batch();
  itemsSnap.forEach((i) => {
    const it = i.data();
    const quoteItem = {
      quoteId: quoteRef.id,
      itemType: it.itemType || 'MATERIAL',
      lineNumber: it.lineNumber || itemCount + 1,
      description: it.description || '',

      materialId: it.materialId,
      serviceId: it.serviceId,
      boughtOutItemId: it.boughtOutItemId,
      linkedItemName: it.linkedItemName,
      linkedItemCode: it.linkedItemCode,

      quantity: it.quantity || 0,
      unit: it.unit || 'NOS',
      unitPrice: it.unitPrice || 0,
      amount: it.amount || (it.quantity || 0) * (it.unitPrice || 0),
      gstRate: it.gstRate,
      gstAmount: it.gstAmount,

      notes: it.notes,

      priceAccepted: !!it.priceAccepted,
      priceAcceptedAt: it.priceAcceptedAt,
      priceAcceptedBy: it.priceAcceptedBy,

      createdAt: it.createdAt || admin.firestore.Timestamp.now(),
      updatedAt: it.updatedAt || admin.firestore.Timestamp.now(),

      migratedFromId: i.id,
      migratedFromCollection: 'vendorOfferItems',
    };
    for (const k of Object.keys(quoteItem)) if (quoteItem[k] === undefined) delete quoteItem[k];
    batch.set(db.collection('vendorQuoteItems').doc(), quoteItem);
    itemCount++;
  });
  if (itemCount > 0) await batch.commit();
  if (itemCount > 0 && itemCount !== quoteDoc.itemCount) {
    await quoteRef.update({ itemCount });
  }

  log(`  migrated ${itemCount} vendorOffer items`);
  return { quoteId: quoteRef.id, itemCount };
}

async function main() {
  log('Starting offers + vendorOffers → vendorQuotes migration');
  log(`Project: ${admin.app().options.credential?.projectId || '?'}`);

  const alreadyMigrated = await fetchAlreadyMigrated();
  log(`Already migrated: ${alreadyMigrated.size} quotes`);

  const offersSnap = await db.collection('offers').get();
  const vendorOffersSnap = await db.collection('vendorOffers').get();
  log(`Found ${offersSnap.size} offers and ${vendorOffersSnap.size} vendorOffers`);

  let offersMigrated = 0;
  let vendorOffersMigrated = 0;

  for (const d of offersSnap.docs) {
    const r = await migrateOffer(d, alreadyMigrated);
    if (r) offersMigrated++;
  }
  for (const d of vendorOffersSnap.docs) {
    const r = await migrateVendorOffer(d, alreadyMigrated);
    if (r) vendorOffersMigrated++;
  }

  log('==== Summary ====');
  log(`Offers migrated:       ${offersMigrated}/${offersSnap.size}`);
  log(`VendorOffers migrated: ${vendorOffersMigrated}/${vendorOffersSnap.size}`);
  log(DRY_RUN ? 'Dry run complete — no writes performed.' : 'Migration complete.');
  log('Old collections are intact. They will be decommissioned in Stage 3.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
