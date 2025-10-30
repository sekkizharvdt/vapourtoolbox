#!/usr/bin/env node

/**
 * Create Pending User Document
 * Creates a Firestore document for an existing Firebase Auth user
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'vapour-toolbox',
});

async function createPendingUser() {
  const userEmail = 'revathi@vapourdesal.com'; // Remote user email

  try {
    console.log(`\n📝 Creating Firestore document for: ${userEmail}\n`);

    // Get user from Firebase Auth
    const user = await admin.auth().getUserByEmail(userEmail);

    console.log('✅ User found in Firebase Auth!');
    console.log('   User ID:', user.uid);
    console.log('   Display Name:', user.displayName);

    // Check if Firestore document already exists
    const userDocRef = admin.firestore().collection('users').doc(user.uid);
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
      console.log('\n⚠️  Firestore document already exists!');
      console.log('   Status:', userDoc.data().status);
      process.exit(0);
    }

    // Create pending user document
    const pendingUserData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      status: 'pending',
      isActive: false,
      roles: [],
      department: '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await userDocRef.set(pendingUserData);

    console.log('\n✅ Created pending Firestore document!');
    console.log('   Status: pending');
    console.log('   Roles: []');
    console.log('   isActive: false');
    console.log('\n🎉 User will now appear in the User Management page for approval.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createPendingUser();
