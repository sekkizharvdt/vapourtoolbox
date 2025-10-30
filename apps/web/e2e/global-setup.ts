/**
 * Global setup for Playwright tests
 * Creates test users in Firebase Emulator before running tests
 */

import { createTestUser } from './helpers/firebase-admin';
import { TEST_USERS } from './helpers/auth';

async function globalSetup() {
  console.log('\n🔧 Setting up test environment...\n');

  // Ensure Firebase emulator is running
  console.log('📝 Creating test users in Firebase Emulator...');

  try {
    // Create all test users
    await createTestUser(TEST_USERS.admin);
    await createTestUser(TEST_USERS.user);
    await createTestUser(TEST_USERS.pending);

    console.log('\n✅ Test environment ready!\n');
  } catch (error) {
    console.error('\n❌ Failed to set up test environment:', error);
    console.error('\n💡 Make sure Firebase Emulator is running:');
    console.error('   firebase emulators:start --only auth,firestore\n');
    throw error;
  }
}

export default globalSetup;
