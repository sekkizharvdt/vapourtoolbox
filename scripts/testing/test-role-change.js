const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

async function testRoleChange() {
  const email = 'kumaran@vapourdesal.com';

  const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();

  console.log('=== INITIAL STATE ===');
  console.log('Roles:', userData.roles);
  console.log('Permissions:', userData.permissions);
  console.log('Last Update:', userData.lastClaimUpdate?.toDate?.());

  // Step 1: Change role to TEAM_MEMBER temporarily
  console.log('\n=== STEP 1: Changing to TEAM_MEMBER ===');
  await userDoc.ref.update({
    roles: ['TEAM_MEMBER'],
  });

  console.log('Waiting 10 seconds...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  let doc = await userDoc.ref.get();
  let data = doc.data();
  console.log('After step 1:');
  console.log('  Permissions:', data.permissions);
  console.log('  Last Update:', data.lastClaimUpdate?.toDate?.());

  // Step 2: Change back to PROCUREMENT_MANAGER
  console.log('\n=== STEP 2: Changing back to PROCUREMENT_MANAGER ===');
  await userDoc.ref.update({
    roles: ['PROCUREMENT_MANAGER'],
  });

  console.log('Waiting 10 seconds...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  doc = await userDoc.ref.get();
  data = doc.data();
  console.log('After step 2:');
  console.log('  Permissions:', data.permissions);
  console.log('  Last Update:', data.lastClaimUpdate?.toDate?.());

  console.log('\n=== RESULT ===');
  const expected = 983280;
  console.log('Expected:', expected);
  console.log('Actual:', data.permissions);
  console.log('Match:', expected === data.permissions ? '✅ FUNCTION IS WORKING!' : '❌ Function not triggering');

  process.exit(0);
}

testRoleChange().catch(console.error);
