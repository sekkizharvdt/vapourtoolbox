const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

async function debugUser() {
  const email = 'kumaran@vapourdesal.com';

  // Get user from Auth first to get UID
  const user = await admin.auth().getUserByEmail(email);
  const userId = user.uid;

  console.log('User ID:', userId);

  // Get Firestore document
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();

  console.log('\n=== FIRESTORE DATA ===');
  console.log('Roles:', userData.roles);
  console.log('Permissions:', userData.permissions);
  console.log('Last Update:', userData.lastClaimUpdate?.toDate());

  // Auth custom claims
  console.log('\n=== AUTH CUSTOM CLAIMS ===');
  console.log(JSON.stringify(user.customClaims, null, 2));

  // Calculate expected permissions
  const PERMISSION_FLAGS = {
    MANAGE_USERS: 1 << 0,
    VIEW_USERS: 1 << 1,
    MANAGE_ROLES: 1 << 2,
    MANAGE_PROJECTS: 1 << 3,
    VIEW_PROJECTS: 1 << 4,
    VIEW_ENTITIES: 1 << 5,
    CREATE_ENTITIES: 1 << 6,
    EDIT_ENTITIES: 1 << 7,
    DELETE_ENTITIES: 1 << 8,
    MANAGE_COMPANY_SETTINGS: 1 << 9,
    VIEW_ANALYTICS: 1 << 10,
    EXPORT_DATA: 1 << 11,
    MANAGE_TIME_TRACKING: 1 << 12,
    VIEW_TIME_TRACKING: 1 << 13,
    MANAGE_ACCOUNTING: 1 << 14,
    VIEW_ACCOUNTING: 1 << 15,
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

  console.log('\n=== EXPECTED ===');
  console.log('PROCUREMENT_MANAGER should have:', expected);
  console.log('Binary:', expected.toString(2));

  process.exit(0);
}

debugUser().catch(console.error);
