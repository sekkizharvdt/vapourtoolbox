const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

async function checkUserForPM(email) {
  try {
    console.log(`\nChecking user: ${email}`);

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`\nFound in Auth: ${userRecord.uid}`);

    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(userRecord.uid).get();

    if (!userDoc.exists) {
      console.log(`\n❌ ERROR: User document not found in Firestore`);
      return;
    }

    const userData = userDoc.data();
    console.log(`\n📄 User Document Data:`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Display Name: ${userData.displayName}`);
    console.log(`   Domain: ${userData.domain || 'NOT SET ❌'}`);
    console.log(`   isActive: ${userData.isActive}`);
    console.log(`   Status: ${userData.status}`);
    console.log(`   Roles: ${(userData.roles || []).join(', ')}`);

    // Check if eligible for PM dropdown
    const isInternal = userData.domain === 'internal';
    const isActive = userData.isActive === true;

    console.log(`\n✅ Eligible for Project Manager Dropdown?`);
    console.log(`   Domain is 'internal': ${isInternal ? '✅' : '❌'}`);
    console.log(`   isActive is true: ${isActive ? '✅' : '❌'}`);
    console.log(`   Result: ${isInternal && isActive ? '✅ YES' : '❌ NO'}`);

    if (!isInternal) {
      console.log(`\n⚠️  FIX NEEDED: domain field is missing or not 'internal'`);
      console.log(`   Current value: ${userData.domain}`);
    }

    if (!isActive) {
      console.log(`\n⚠️  FIX NEEDED: isActive is not true`);
      console.log(`   Current value: ${userData.isActive}`);
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
  }
}

async function listAllEligiblePMs() {
  try {
    console.log(`\n\n${'='.repeat(60)}`);
    console.log('Checking ALL users eligible for PM dropdown');
    console.log('='.repeat(60));

    // Query exactly as the CreateProjectDialog does
    const usersSnapshot = await db.collection('users')
      .where('domain', '==', 'internal')
      .where('isActive', '==', true)
      .orderBy('displayName')
      .get();

    console.log(`\nFound ${usersSnapshot.size} eligible users:`);

    if (usersSnapshot.empty) {
      console.log('❌ NO USERS FOUND - This is why the dropdown is empty!');
    } else {
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        console.log(`   ✅ ${userData.displayName} (${userData.email})`);
      });
    }

  } catch (error) {
    console.error(`\n❌ Error querying users:`, error.message);
    if (error.code === 9) {
      console.log('\n⚠️  Index may still be building. Wait 1-2 minutes and try again.');
    }
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('User PM Dropdown Diagnostic Tool');
  console.log('='.repeat(60));

  // Check specific user
  await checkUserForPM('revathi@vapourdesal.com');

  // List all eligible users
  await listAllEligiblePMs();

  console.log('\n' + '='.repeat(60));
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
