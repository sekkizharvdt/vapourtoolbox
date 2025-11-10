#!/usr/bin/env node

/**
 * Force sync custom claims for a user
 * This bypasses permission checks and directly updates Firebase Auth custom claims
 *
 * Usage: node scripts/force-sync-claims.js <email>
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');

if (!require('fs').existsSync(serviceAccountPath)) {
  console.error('❌ Error: firebase-service-account.json not found');
  console.error('Please download it from Firebase Console → Project Settings → Service Accounts');
  console.error('Place it in the project root directory');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
});

const db = admin.firestore();

async function syncUserClaims(email) {
  try {
    console.log(`\n🔍 Looking up user: ${email}`);

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    const userId = userRecord.uid;

    console.log(`✓ Found user: ${userId}`);

    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.error(`❌ User document not found in Firestore`);
      process.exit(1);
    }

    const userData = userDoc.data();
    const { status, isActive, permissions } = userData;

    console.log(`\n📋 Current Firestore Data:`);
    console.log(`   Email: ${email}`);
    console.log(`   Status: ${status}`);
    console.log(`   IsActive: ${isActive}`);
    console.log(`   Permissions: ${permissions}`);

    // Check current custom claims
    const currentClaims = userRecord.customClaims || {};
    console.log(`\n🔐 Current Custom Claims:`);
    console.log(`   Permissions: ${currentClaims.permissions || 'none'}`);
    console.log(`   Domain: ${currentClaims.domain || 'none'}`);

    // Determine domain
    const domain = email.endsWith('@vapourdesal.com') ? 'internal' : 'external';

    if (status === 'active' && isActive === true && typeof permissions === 'number') {
      const newClaims = {
        permissions,
        domain,
      };

      // Set custom claims
      await admin.auth().setCustomUserClaims(userId, newClaims);

      console.log(`\n✅ Successfully updated custom claims!`);
      console.log(`   New Permissions: ${permissions}`);
      console.log(`   New Domain: ${domain}`);
      console.log(`\n⚠️  User must sign out and sign back in to see changes`);
    } else {
      console.error(`\n❌ Cannot sync claims:`);
      console.error(`   Status is not 'active': ${status}`);
      console.error(`   IsActive is not true: ${isActive}`);
      console.error(`   Permissions is not a number: ${typeof permissions}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Error syncing claims:`, error.message);
    process.exit(1);
  }
}

// Main
const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/force-sync-claims.js <email>');
  console.error('Example: node scripts/force-sync-claims.js user@vapourdesal.com');
  process.exit(1);
}

syncUserClaims(email)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
