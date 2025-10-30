const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

async function triggerAndWait() {
  const email = 'kumaran@vapourdesal.com';

  const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();

  console.log('=== BEFORE ===');
  console.log('Permissions:', userData.permissions);
  console.log('Last Update:', userData.lastClaimUpdate?.toDate?.());

  console.log('\n=== TRIGGERING with roles update ===');
  await userDoc.ref.update({
    roles: userData.roles,
  });

  console.log('Waiting 30 seconds for cold start...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  const updatedDoc = await userDoc.ref.get();
  const updatedData = updatedDoc.data();

  console.log('\n=== AFTER 30 SECONDS ===');
  console.log('Permissions:', updatedData.permissions);
  console.log('Last Update:', updatedData.lastClaimUpdate?.toDate?.());
  console.log('\nMatch:', 983280 === updatedData.permissions ? '✅ WORKING!' : '❌ Not working');

  process.exit(0);
}

triggerAndWait().catch(console.error);
