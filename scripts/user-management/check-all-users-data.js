const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

async function checkAllUsers() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('Checking ALL Users in Firestore');
    console.log('='.repeat(70) + '\n');

    // Get all users
    const usersSnapshot = await db.collection('users').get();

    console.log(`Total users found: ${usersSnapshot.size}\n`);

    const eligibleUsers = [];
    const ineligibleUsers = [];

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      const isEligible = userData.domain === 'internal' && userData.isActive === true;

      const userInfo = {
        email: userData.email,
        displayName: userData.displayName,
        domain: userData.domain || 'NOT SET',
        isActive: userData.isActive,
        status: userData.status,
        roles: (userData.roles || []).join(', ') || 'NONE',
      };

      if (isEligible) {
        eligibleUsers.push(userInfo);
      } else {
        ineligibleUsers.push(userInfo);
      }
    });

    console.log('✅ ELIGIBLE for Project Manager Dropdown:');
    console.log('   (domain="internal" AND isActive=true)\n');
    if (eligibleUsers.length === 0) {
      console.log('   ❌ NO USERS ARE ELIGIBLE!\n');
    } else {
      eligibleUsers.forEach((user) => {
        console.log(`   ✅ ${user.displayName} (${user.email})`);
        console.log(`      Domain: ${user.domain}, isActive: ${user.isActive}, Status: ${user.status}`);
        console.log(`      Roles: ${user.roles}\n`);
      });
    }

    console.log('='.repeat(70));
    console.log('❌ NOT ELIGIBLE for Project Manager Dropdown:\n');
    if (ineligibleUsers.length === 0) {
      console.log('   None - All users are eligible!\n');
    } else {
      ineligibleUsers.forEach((user) => {
        console.log(`   ❌ ${user.displayName} (${user.email})`);
        console.log(`      Domain: ${user.domain} ${user.domain !== 'internal' ? '⚠️  WRONG!' : ''}`);
        console.log(`      isActive: ${user.isActive} ${!user.isActive ? '⚠️  SHOULD BE TRUE!' : ''}`);
        console.log(`      Status: ${user.status}`);
        console.log(`      Roles: ${user.roles}\n`);
      });
    }

    console.log('='.repeat(70));
    console.log('\nSUMMARY:');
    console.log(`  ✅ Eligible: ${eligibleUsers.length}`);
    console.log(`  ❌ Not Eligible: ${ineligibleUsers.length}`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

checkAllUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
