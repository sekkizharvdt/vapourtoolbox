const admin = require('firebase-admin');

// Initialize Firebase Admin with Application Default Credentials
// Make sure you're authenticated with: firebase login
admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

// Entity permissions
const VIEW_ENTITIES = 32;
const CREATE_ENTITIES = 64;
const EDIT_ENTITIES = 128;
const ENTITY_PERMISSIONS = VIEW_ENTITIES | CREATE_ENTITIES | EDIT_ENTITIES; // 224

async function grantEntityPermissions(email) {
  try {
    console.log(`\nProcessing user: ${email}`);

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
    const currentPermissions = userData.permissions || 0;

    console.log(`Current permissions: ${currentPermissions}`);
    console.log(`Current role: ${userData.roles?.join(', ')}`);

    // Add entity permissions (bitwise OR)
    const newPermissions = currentPermissions | ENTITY_PERMISSIONS;

    console.log(`New permissions: ${newPermissions}`);
    console.log(`Added: VIEW_ENTITIES (32), CREATE_ENTITIES (64), EDIT_ENTITIES (128)`);

    // Update Firestore
    await db.collection('users').doc(userRecord.uid).update({
      permissions: newPermissions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✓ Updated Firestore');

    // Update custom claims
    const existingClaims = userRecord.customClaims || {};
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      ...existingClaims,
      permissions: newPermissions,
    });
    console.log('✓ Updated custom claims');

    console.log(`\n✅ Successfully granted entity permissions to ${email}`);
    console.log('   User will need to sign out and sign in again for changes to take effect.\n');

  } catch (error) {
    console.error(`\n❌ Error processing ${email}:`, error.message);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Granting Entity Permissions (VIEW, CREATE, EDIT)');
  console.log('='.repeat(60));

  // Grant to accountant
  await grantEntityPermissions('revathi@vapourdesal.com');

  // Find and grant to procurement manager
  console.log('\nSearching for procurement manager...');
  const usersSnapshot = await db.collection('users')
    .where('roles', 'array-contains', 'PROCUREMENT_MANAGER')
    .get();

  if (usersSnapshot.empty) {
    console.log('No procurement manager found');
  } else {
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      await grantEntityPermissions(userData.email);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Done! Users must sign out and sign back in.');
  console.log('='.repeat(60));

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
