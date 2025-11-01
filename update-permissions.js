const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function updatePermissions() {
  try {
    const email = 'sekkizhar@vapourdesal.com';

    // Find user by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.error('User not found with email:', email);
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const currentPerms = userDoc.data().permissions || 0;

    console.log('Current permissions:', currentPerms);
    console.log('Binary:', currentPerms.toString(2));

    // Add bit 20 (MANAGE_CHART_OF_ACCOUNTS = 1048576)
    const newPerms = currentPerms | (1 << 20);

    console.log('New permissions:', newPerms);
    console.log('Binary:', newPerms.toString(2));

    // Update Firestore
    await db.collection('users').doc(userId).update({
      permissions: newPerms,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Updated permissions in Firestore');

    // Update custom claims
    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      ...userRecord.customClaims,
      permissions: newPerms
    });

    console.log('✅ Updated custom claims');
    console.log('User needs to refresh their browser or re-login for changes to take effect');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

updatePermissions();
