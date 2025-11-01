const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function forcePermissionRecalculation() {
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
    const currentData = userDoc.data();

    console.log('Current user data:');
    console.log('- Email:', currentData.email);
    console.log('- Roles:', currentData.roles);
    console.log('- Status:', currentData.status);
    console.log('- Current permissions:', currentData.permissions);
    console.log('- Binary:', currentData.permissions?.toString(2));

    // Strategy: Temporarily change status to trigger the Cloud Function
    // The function monitors: roles, status, email, permissions

    console.log('\n⏳ Step 1: Temporarily changing status to trigger Cloud Function...');
    await db.collection('users').doc(userId).update({
      status: 'pending_update'
    });

    console.log('✅ Status changed to "pending_update"');
    console.log('⏳ Waiting 3 seconds for Cloud Function to process...');

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n⏳ Step 2: Restoring status to "active"...');
    await db.collection('users').doc(userId).update({
      status: 'active'
    });

    console.log('✅ Status restored to "active"');
    console.log('⏳ Waiting 3 seconds for Cloud Function to process...');

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check the updated permissions
    console.log('\n⏳ Step 3: Checking updated permissions...');
    const updatedDoc = await db.collection('users').doc(userId).get();
    const updatedData = updatedDoc.data();

    console.log('\n📊 Updated user data:');
    console.log('- Permissions:', updatedData.permissions);
    console.log('- Binary:', updatedData.permissions?.toString(2));
    console.log('- Last claim update:', updatedData.lastClaimUpdate?.toDate());

    // Calculate expected permissions for SUPER_ADMIN
    const expectedPermissions = (1 << 26) - 1; // All bits 0-25
    console.log('\n🎯 Expected permissions for SUPER_ADMIN:', expectedPermissions);
    console.log('   Binary:', expectedPermissions.toString(2));

    if (updatedData.permissions === expectedPermissions) {
      console.log('\n✅ SUCCESS! Permissions have been correctly updated!');
      console.log('✅ User now has all permissions including MANAGE_CHART_OF_ACCOUNTS');
      console.log('\n📝 Next steps:');
      console.log('   1. Log out and log back in to refresh your token');
      console.log('   2. Navigate to the Chart of Accounts page');
      console.log('   3. You should now see the "Initialize Indian COA" button');
    } else {
      console.log('\n⚠️  Permissions updated but value is unexpected');
      console.log('   Expected:', expectedPermissions);
      console.log('   Got:', updatedData.permissions);
      console.log('   Difference:', expectedPermissions - updatedData.permissions);
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error('\nIf you see authentication errors, try running:');
    console.error('   firebase login --reauth');
  } finally {
    process.exit(0);
  }
}

forcePermissionRecalculation();
