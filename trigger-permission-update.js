const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function triggerPermissionUpdate() {
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

    console.log('Triggering permission update for user:', email);
    console.log('Current permissions:', userDoc.data().permissions);

    // Touch the document to trigger the onUserUpdate Cloud Function
    // We'll update the lastClaimUpdate field
    await db.collection('users').doc(userId).update({
      lastClaimUpdate: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Update triggered! The Cloud Function will recalculate permissions in a few seconds.');
    console.log('Wait 5-10 seconds, then refresh your browser and check the permissions value in Firestore.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

triggerPermissionUpdate();
