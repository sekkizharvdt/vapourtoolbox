/**
 * Seed Test Data for Firebase Emulator
 *
 * This script creates test users and data in the Firebase Emulator
 * for E2E testing with Playwright
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin with emulator settings
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const auth = admin.auth();
const db = admin.firestore();

// Test users
const TEST_USERS = [
  {
    uid: 'test-admin-001',
    email: 'test-admin@vapourtoolbox.com',
    displayName: 'Test Admin',
    emailVerified: true,
    customClaims: {
      role: 'admin',
      tenantId: 'test-tenant-001',
      status: 'approved',
    },
  },
  {
    uid: 'test-user-001',
    email: 'test-user@vapourtoolbox.com',
    displayName: 'Test User',
    emailVerified: true,
    customClaims: {
      role: 'user',
      tenantId: 'test-tenant-001',
      status: 'approved',
    },
  },
  {
    uid: 'test-pending-001',
    email: 'test-pending@vapourtoolbox.com',
    displayName: 'Test Pending User',
    emailVerified: true,
    customClaims: {
      role: 'pending',
      tenantId: 'test-tenant-001',
      status: 'pending',
    },
  },
];

// Test entities
const TEST_ENTITIES = [
  {
    id: 'entity-test-001',
    name: 'Test Entity 1',
    abbreviation: 'TE1',
    description: 'Test entity for E2E testing',
    status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'test-admin-001',
  },
  {
    id: 'entity-test-002',
    name: 'Test Entity 2',
    abbreviation: 'TE2',
    description: 'Another test entity',
    status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'test-admin-001',
  },
];

async function seedTestData() {
  console.log('🌱 Seeding test data in Firebase Emulator...\n');

  try {
    // Create test users
    console.log('👤 Creating test users...');
    for (const user of TEST_USERS) {
      try {
        const userRecord = await auth.createUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified,
        });

        // Set custom claims
        if (user.customClaims) {
          await auth.setCustomUserClaims(userRecord.uid, user.customClaims);
        }

        console.log(`  ✅ Created user: ${user.email}`);
      } catch (error) {
        if (error.code === 'auth/uid-already-exists') {
          console.log(`  ⏭️  User already exists: ${user.email}`);
          // Update custom claims for existing user
          if (user.customClaims) {
            await auth.setCustomUserClaims(user.uid, user.customClaims);
          }
        } else {
          console.error(`  ❌ Error creating user ${user.email}:`, error.message);
        }
      }
    }

    // Create test entities
    console.log('\n🏢 Creating test entities...');
    for (const entity of TEST_ENTITIES) {
      try {
        await db.collection('entities').doc(entity.id).set(entity);
        console.log(`  ✅ Created entity: ${entity.name}`);
      } catch (error) {
        console.error(`  ❌ Error creating entity ${entity.name}:`, error.message);
      }
    }

    console.log('\n✅ Test data seeded successfully!');
    console.log('\nTest Users:');
    TEST_USERS.forEach((user) => {
      console.log(`  - ${user.email} (${user.customClaims?.role})`);
    });

    console.log('\n📝 You can now run E2E tests with:');
    console.log('   pnpm test:e2e');
  } catch (error) {
    console.error('\n❌ Error seeding test data:', error);
    process.exit(1);
  } finally {
    // Don't exit - keep process alive for emulator
    console.log('\n💡 Emulator is ready for testing!');
  }
}

// Run the seed script
seedTestData();
