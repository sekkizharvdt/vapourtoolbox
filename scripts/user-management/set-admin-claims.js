#!/usr/bin/env node

/**
 * Set Admin Custom Claims
 *
 * This script sets custom claims for your first admin user.
 * Run this ONCE to give yourself SUPER_ADMIN access.
 *
 * Usage:
 *   node set-admin-claims.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Load service account key
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'vapour-toolbox',
});

async function setAdminClaims() {
  // Your user ID from Firestore
  const userId = 'wTT35QYJ9og7gr1FAWuDpUvDc6F3';
  const userEmail = 'sekkizhar@vapourdesal.com';

  console.log('🔧 Setting custom claims for admin user...');
  console.log(`   User ID: ${userId}`);
  console.log(`   Email: ${userEmail}\n`);

  try {
    // Verify user exists in Firebase Auth
    const user = await admin.auth().getUser(userId);
    console.log(`✅ User found: ${user.email}`);

    // Set custom claims
    await admin.auth().setCustomUserClaims(userId, {
      roles: ['SUPER_ADMIN'],
      permissions: 67108863, // All permissions (26 bits: 11111111111111111111111111)
      domain: 'internal'
    });

    console.log('\n✅ SUCCESS! Custom claims set:');
    console.log('   Roles: [SUPER_ADMIN]');
    console.log('   Permissions: 67108863 (all 26 permissions)');
    console.log('   Domain: internal\n');

    // Verify claims were set
    const updatedUser = await admin.auth().getUser(userId);
    console.log('📋 Verification - Current custom claims:');
    console.log(JSON.stringify(updatedUser.customClaims, null, 2));

    console.log('\n⚠️  IMPORTANT NEXT STEPS:');
    console.log('   1. Go to your browser');
    console.log('   2. Sign out of the application');
    console.log('   3. Sign back in with Google');
    console.log('   4. You should now have full admin access!\n');

    console.log('🎉 You can now access:');
    console.log('   - http://localhost:3001/dashboard');
    console.log('   - http://localhost:3001/dashboard/users\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nFull error details:');
    console.error(error);
    process.exit(1);
  }
}

// Run the function
setAdminClaims();
