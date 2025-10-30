#!/usr/bin/env node

/**
 * Check User Claims
 * Verifies that custom claims are properly set for a user
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'vapour-toolbox',
});

async function checkUserClaims() {
  const userEmail = 'sekkizhar@vapourdesal.com'; // Your email

  try {
    console.log(`\n🔍 Checking claims for: ${userEmail}\n`);

    // Get user by email
    const user = await admin.auth().getUserByEmail(userEmail);

    console.log('✅ User found!');
    console.log('   User ID:', user.uid);
    console.log('   Email:', user.email);
    console.log('   Email Verified:', user.emailVerified);
    console.log('\n📋 Custom Claims:');
    console.log(JSON.stringify(user.customClaims, null, 2));

    // Check Firestore document
    console.log('\n📄 Checking Firestore document...');
    const userDoc = await admin.firestore().collection('users').doc(user.uid).get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('✅ Firestore document found!');
      console.log('   Status:', userData.status);
      console.log('   Active:', userData.isActive);
      console.log('   Roles:', userData.roles);
      console.log('   Department:', userData.department);
    } else {
      console.log('❌ No Firestore document found!');
    }

    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUserClaims();
