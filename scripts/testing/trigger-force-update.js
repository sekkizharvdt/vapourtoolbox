const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

async function forceUpdate() {
  const email = 'kumaran@vapourdesal.com';

  // Find user
  const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();

  if (usersSnapshot.empty) {
    console.log('User not found!');
    process.exit(1);
  }

  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();

  console.log('=== BEFORE ===');
  console.log('UID:', userDoc.id);
  console.log('Roles:', userData.roles);
  console.log('Permissions:', userData.permissions);

  // Force Cloud Function to run by touching the roles array
  // (adding and immediately removing doesn't change the data but triggers the function)
  console.log('\n=== FORCING TRIGGER by updating roles ===');
  await userDoc.ref.update({
    roles: userData.roles, // Same value but triggers onDocumentWritten
  });

  console.log('Triggered! Waiting 10 seconds for Cloud Function...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Check result
  const updatedDoc = await userDoc.ref.get();
  const updatedData = updatedDoc.data();

  console.log('\n=== AFTER ===');
  console.log('Permissions:', updatedData.permissions);
  console.log('Last Update:', updatedData.lastClaimUpdate?.toDate?.());

  // Expected
  const expected = 16 + 32 + 64 + 128 + 65536 + 131072 + 262144 + 524288;
  console.log('\n=== RESULT ===');
  console.log('Expected:', expected);
  console.log('Actual:', updatedData.permissions);
  console.log('Match:', expected === updatedData.permissions ? '✅ FIXED!' : '❌ Still wrong');

  process.exit(0);
}

forceUpdate().catch(console.error);
