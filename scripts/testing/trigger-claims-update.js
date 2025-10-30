const admin = require('firebase-admin');

// Initialize Firebase Admin with Application Default Credentials
admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

async function triggerClaimsUpdate(email) {
  try {
    console.log(`\nTriggering claims update for: ${email}`);

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`Found user: ${userRecord.uid}`);

    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(userRecord.uid).get();

    if (!userDoc.exists) {
      console.log(`ERROR: User document not found in Firestore for ${email}`);
      return;
    }

    const userData = userDoc.data();
    console.log(`Current permissions in Firestore: ${userData.permissions}`);

    // Trigger the Cloud Function by updating the document
    // (just update the updatedAt field to trigger the function)
    await db.collection('users').doc(userRecord.uid).update({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✓ Updated user document - Cloud Function will now update custom claims');
    console.log('\nWaiting 3 seconds for Cloud Function to process...\n');

    // Wait for Cloud Function to process
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check the updated claims
    const updatedUser = await admin.auth().getUser(userRecord.uid);
    console.log('Updated custom claims:', updatedUser.customClaims);

    console.log('\n✅ Success! Tell the user to:');
    console.log('   1. Sign out');
    console.log('   2. Sign back in');
    console.log('   3. Try accessing Entities again\n');

  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Triggering Custom Claims Update');
  console.log('='.repeat(60));

  await triggerClaimsUpdate('revathi@vapourdesal.com');

  console.log('='.repeat(60));
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
