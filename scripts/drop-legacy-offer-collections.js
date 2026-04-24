#!/usr/bin/env node
/**
 * Drop legacy offers / offerItems / vendorOffers / vendorOfferItems collections.
 *
 * Safety checks before deleting:
 *   1. Every parent doc (offer / vendorOffer) must have a corresponding
 *      vendorQuote carrying `migratedFromId === <oldDocId>` and
 *      `migratedFromCollection === '<sourceCollection>'`.
 *   2. If any doc lacks a migration marker, the script aborts without
 *      touching anything and prints the unaccounted ids.
 *
 * Idempotent — reruns just report "already empty".
 *
 * Usage:
 *   node scripts/drop-legacy-offer-collections.js [--dry-run]
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
  console.log(DRY_RUN ? '[DRY RUN]' : '[DROP]', ...args);
}

async function verifyAllMigrated(sourceCollection, oldDocs) {
  const unmigrated = [];
  for (const d of oldDocs) {
    const snap = await db
      .collection('vendorQuotes')
      .where('migratedFromId', '==', d.id)
      .where('migratedFromCollection', '==', sourceCollection)
      .limit(1)
      .get();
    if (snap.empty) unmigrated.push(d.id);
  }
  return unmigrated;
}

async function deleteCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  if (snap.empty) {
    log(`${collectionName}: already empty`);
    return 0;
  }
  if (DRY_RUN) {
    log(`${collectionName}: would delete ${snap.size} docs`);
    return snap.size;
  }

  // Firestore batch limit is 500 ops — chunk it.
  let deleted = 0;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + 400);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += chunk.length;
    log(`${collectionName}: deleted ${deleted}/${docs.length}`);
  }
  return deleted;
}

async function main() {
  log('=== Legacy collection drop ===');
  log(`Project: ${admin.app().options.credential?.projectId || '?'}`);

  // --- Fetch old parents ---
  const [offersSnap, vendorOffersSnap] = await Promise.all([
    db.collection('offers').get(),
    db.collection('vendorOffers').get(),
  ]);

  log(`Found ${offersSnap.size} offers, ${vendorOffersSnap.size} vendorOffers`);

  // --- Safety check: every old parent must have a migration marker ---
  const offersUnmigrated = await verifyAllMigrated('offers', offersSnap.docs);
  const vendorOffersUnmigrated = await verifyAllMigrated('vendorOffers', vendorOffersSnap.docs);

  if (offersUnmigrated.length || vendorOffersUnmigrated.length) {
    console.error(
      '\n❌ ABORT — some legacy docs have no corresponding vendorQuote with migratedFromId.'
    );
    if (offersUnmigrated.length) {
      console.error(`  offers/: ${offersUnmigrated.join(', ')}`);
    }
    if (vendorOffersUnmigrated.length) {
      console.error(`  vendorOffers/: ${vendorOffersUnmigrated.join(', ')}`);
    }
    console.error('\nRun `node scripts/migrate-offers-to-vendor-quotes.js` first.');
    process.exit(1);
  }

  log('✅ Safety check passed — every legacy parent doc is migrated');

  // --- Delete items first, then parents (matches dependency direction) ---
  const offerItemsDeleted = await deleteCollection('offerItems');
  const vendorOfferItemsDeleted = await deleteCollection('vendorOfferItems');
  const offersDeleted = await deleteCollection('offers');
  const vendorOffersDeleted = await deleteCollection('vendorOffers');

  log('\n==== Summary ====');
  log(`offerItems deleted:       ${offerItemsDeleted}`);
  log(`vendorOfferItems deleted: ${vendorOfferItemsDeleted}`);
  log(`offers deleted:           ${offersDeleted}`);
  log(`vendorOffers deleted:     ${vendorOffersDeleted}`);
  log(DRY_RUN ? '\nDry run complete — no writes performed.' : '\nLegacy drop complete.');
}

main().catch((err) => {
  console.error('Drop failed:', err);
  process.exit(1);
});
