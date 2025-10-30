const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

async function triggerOneUser() {
  const email = 'kumaran@vapourdesal.com';

  // Find user in Firestore by email
  const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();

  if (usersSnapshot.empty) {
    console.log('User not found!');
    process.exit(1);
  }

  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();

  console.log('=== BEFORE TRIGGER ===');
  console.log('Email:', email);
  console.log('UID:', userDoc.id);
  console.log('Roles:', userData.roles);
  console.log('Permissions:', userData.permissions);
  console.log('Last Update:', userData.lastClaimUpdate?.toDate?.());

  console.log('\n=== TRIGGERING CLOUD FUNCTION ===');
  await userDoc.ref.update({
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log('Triggered! Waiting 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Check again
  const updatedDoc = await userDoc.ref.get();
  const updatedData = updatedDoc.data();

  console.log('\n=== AFTER TRIGGER ===');
  console.log('Permissions:', updatedData.permissions);
  console.log('Last Update:', updatedData.lastClaimUpdate?.toDate?.());

  // Calculate expected
  const PERMISSION_FLAGS = {
    VIEW_PROJECTS: 1 << 4,
    VIEW_ENTITIES: 1 << 5,
    CREATE_ENTITIES: 1 << 6,
    EDIT_ENTITIES: 1 << 7,
    MANAGE_PROCUREMENT: 1 << 16,
    VIEW_PROCUREMENT: 1 << 17,
    MANAGE_ESTIMATION: 1 << 18,
    VIEW_ESTIMATION: 1 << 19,
  };

  const expected =
    PERMISSION_FLAGS.VIEW_PROJECTS |
    PERMISSION_FLAGS.VIEW_ENTITIES |
    PERMISSION_FLAGS.CREATE_ENTITIES |
    PERMISSION_FLAGS.EDIT_ENTITIES |
    PERMISSION_FLAGS.MANAGE_PROCUREMENT |
    PERMISSION_FLAGS.VIEW_PROCUREMENT |
    PERMISSION_FLAGS.MANAGE_ESTIMATION |
    PERMISSION_FLAGS.VIEW_ESTIMATION;

  console.log('\n=== COMPARISON ===');
  console.log('Expected:', expected, '(' + expected.toString(2) + ')');
  console.log('Actual:', updatedData.permissions, '(' + updatedData.permissions.toString(2) + ')');
  console.log('Match:', expected === updatedData.permissions ? '✅ YES' : '❌ NO');

  process.exit(0);
}

triggerOneUser().catch(console.error);
