#!/usr/bin/env node
/**
 * Force-sync custom claims for all active users.
 * Sets tenantId directly in Auth custom claims using the Admin SDK.
 *
 * Usage:
 *   node scripts/sync-user-claims.js [--dry-run]
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

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== SYNCING CLAIMS ===');

  const snapshot = await db.collection('users').where('status', '==', 'active').get();
  console.log(`Found ${snapshot.size} active users\n`);

  let synced = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const userId = doc.id;
    const email = data.email || '(no email)';
    const tenantId = data.tenantId || 'default-entity';
    const permissions = data.permissions;
    const permissions2 = typeof data.permissions2 === 'number' ? data.permissions2 : 0;
    const domain = email.endsWith('@vapourdesal.com') ? 'internal' : 'external';

    if (typeof permissions !== 'number') {
      console.log(`  ⏭️  ${email}: no permissions set — skipping`);
      skipped++;
      continue;
    }

    try {
      const userRecord = await admin.auth().getUser(userId);
      const currentClaims = userRecord.customClaims || {};

      const newClaims = {
        permissions,
        domain,
        tenantId,
      };
      if (permissions2 > 0) {
        newClaims.permissions2 = permissions2;
      }

      // Check if claims need updating
      const needsUpdate =
        currentClaims.permissions !== permissions ||
        currentClaims.domain !== domain ||
        currentClaims.tenantId !== tenantId ||
        (currentClaims.permissions2 || 0) !== permissions2;

      if (!needsUpdate) {
        console.log(`  ✅ ${email}: claims already correct (tenantId=${tenantId})`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(
          `  [DRY RUN] ${email}: would set tenantId=${tenantId}, current=${currentClaims.tenantId || '(none)'}`
        );
      } else {
        await admin.auth().setCustomUserClaims(userId, newClaims);
        console.log(`  🔧 ${email}: synced claims (tenantId=${tenantId})`);
      }
      synced++;
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.log(`  ⚠️  ${email}: Auth record not found — skipping`);
        skipped++;
      } else {
        console.error(`  ❌ ${email}: ${err.message}`);
      }
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Synced: ${synced}, Skipped: ${skipped}`);
}

main().catch(console.error);
