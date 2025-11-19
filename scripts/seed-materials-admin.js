#!/usr/bin/env node
/**
 * Script to call the seedMaterials Firebase Function using Firebase CLI authentication
 * Run this after: firebase login
 */

const { execSync } = require('child_process');

async function seedMaterials() {
  try {
    console.log('🔐 Using Firebase CLI authentication...\n');

    console.log('📦 Calling seedMaterials function...');
    console.log('   Project: vapour-toolbox');
    console.log('   Region: asia-south1');
    console.log('   Data type: all (pipes, fittings, flanges)');
    console.log('   Delete existing: false\n');

    // Use Firebase CLI to call the function
    // The firebase CLI will use your logged-in credentials
    const result = execSync(
      `firebase functions:shell <<EOF
seedmaterials({dataType: 'all', deleteExisting: false})
EOF`,
      {
        encoding: 'utf8',
        cwd: process.cwd(),
        env: { ...process.env, FIREBASE_PROJECT: 'vapour-toolbox' },
      }
    );

    console.log(result);
    console.log('\n✅ Seeding completed!');
    console.log(
      '🌐 Check your data at: https://console.firebase.google.com/project/vapour-toolbox/firestore'
    );
    console.log('🌐 Or visit: https://toolbox.vapourdesal.com/materials/catalog');
  } catch (error) {
    console.error('❌ Error seeding materials:', error.message);
    console.log('\n💡 Alternative: Use the Firebase Console to call the function manually');
    console.log(
      '   1. Go to: https://console.firebase.google.com/project/vapour-toolbox/functions'
    );
    console.log('   2. Find the "seedmaterials" function');
    console.log('   3. Use the "Test function" feature');
    console.log('   4. Input: {"dataType": "all", "deleteExisting": false}');
    process.exit(1);
  }
}

// Check if Firebase CLI is installed and user is logged in
try {
  execSync('firebase projects:list', { encoding: 'utf8', stdio: 'pipe' });
} catch (error) {
  console.error('❌ Error: Firebase CLI not authenticated');
  console.log('\n💡 Please run: firebase login');
  console.log('   Then try again: node scripts/seed-materials-admin.js');
  process.exit(1);
}

seedMaterials();
