/**
 * Clear Materials Data Script
 *
 * This script clears all existing materials data from Firestore.
 * Run with: pnpm dotenv -e apps/web/.env.local -- tsx scripts/clear-materials-data.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';

// Load environment variables from web app
config({ path: resolve(__dirname, '../apps/web/.env.local') });

// Firebase configuration from environment
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log('🔧 Firebase Config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
});

async function clearMaterialsData() {
  try {
    console.log('🚀 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log('📦 Fetching all materials...');
    const materialsRef = collection(db, COLLECTIONS.MATERIALS);
    const snapshot = await getDocs(materialsRef);

    if (snapshot.empty) {
      console.log('✅ No materials found in database. Nothing to delete.');
      return;
    }

    console.log(`📊 Found ${snapshot.size} materials. Deleting...`);

    let deletedCount = 0;
    const deletePromises = snapshot.docs.map(async (materialDoc) => {
      await deleteDoc(doc(db, COLLECTIONS.MATERIALS, materialDoc.id));
      deletedCount++;
      console.log(`  ✓ Deleted material ${deletedCount}/${snapshot.size}: ${materialDoc.data().materialCode}`);
    });

    await Promise.all(deletePromises);

    console.log('\n✅ Successfully deleted all materials!');
    console.log(`   Total deleted: ${deletedCount} materials`);
  } catch (error) {
    console.error('❌ Error clearing materials data:', error);
    throw error;
  }
}

// Run the script
clearMaterialsData()
  .then(() => {
    console.log('\n🎉 Materials data cleared successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to clear materials data:', error);
    process.exit(1);
  });
