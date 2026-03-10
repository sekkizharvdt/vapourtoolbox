#!/usr/bin/env node
/**
 * Migration script: Backfill entityId on accounts missing it.
 *
 * Accounts created via CreateAccountDialog before the fix did not include
 * entityId: 'default-entity', making them invisible to the Chart of Accounts
 * query which filters by entityId.
 *
 * Usage: node scripts/migrate-account-entityid.js
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

async function migrate() {
  const accountsRef = db.collection('accounts');
  const snapshot = await accountsRef.get();

  const missingEntityId = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.entityId) {
      missingEntityId.push({ id: doc.id, code: data.code, name: data.name });
    }
  });

  if (missingEntityId.length === 0) {
    console.log('No accounts missing entityId. Nothing to do.');
    return;
  }

  console.log(`Found ${missingEntityId.length} accounts missing entityId:`);
  missingEntityId.forEach((a) => console.log(`  - ${a.code} ${a.name} (${a.id})`));

  // Batch update
  const batchSize = 500;
  for (let i = 0; i < missingEntityId.length; i += batchSize) {
    const batch = db.batch();
    const chunk = missingEntityId.slice(i, i + batchSize);
    chunk.forEach((a) => {
      batch.update(accountsRef.doc(a.id), { entityId: 'default-entity' });
    });
    await batch.commit();
    console.log(`Updated batch ${Math.floor(i / batchSize) + 1} (${chunk.length} accounts)`);
  }

  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
