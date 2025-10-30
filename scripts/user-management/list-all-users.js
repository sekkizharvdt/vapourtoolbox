#!/usr/bin/env node

/**
 * List All Users
 * Shows all users in Firebase Auth and Firestore
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'vapour-toolbox',
});

async function listAllUsers() {
  try {
    console.log('\n🔍 Listing all users...\n');

    // List all users from Firebase Auth
    console.log('📧 Firebase Auth Users:');
    console.log('═══════════════════════════════════════════════════════\n');

    const listUsersResult = await admin.auth().listUsers(1000);

    for (const userRecord of listUsersResult.users) {
      console.log(`✉️  ${userRecord.email}`);
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Display Name: ${userRecord.displayName || 'N/A'}`);
      console.log(`   Email Verified: ${userRecord.emailVerified}`);
      console.log(`   Created: ${new Date(userRecord.metadata.creationTime).toLocaleString()}`);
      console.log(`   Custom Claims:`, userRecord.customClaims || 'None');
      console.log('');
    }

    console.log(`Total Auth Users: ${listUsersResult.users.length}\n`);

    // List all users from Firestore
    console.log('📄 Firestore User Documents:');
    console.log('═══════════════════════════════════════════════════════\n');

    const usersSnapshot = await admin.firestore().collection('users').get();

    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`📋 ${data.email}`);
      console.log(`   UID: ${doc.id}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Roles: ${JSON.stringify(data.roles)}`);
      console.log(`   Department: ${data.department || 'N/A'}`);
      console.log(`   Active: ${data.isActive}`);
      console.log(`   Created: ${data.createdAt?.toDate().toLocaleString() || 'N/A'}`);
      console.log('');
    });

    console.log(`Total Firestore Documents: ${usersSnapshot.size}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listAllUsers();
