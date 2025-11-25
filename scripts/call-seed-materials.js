#!/usr/bin/env node

/**
 * Script to call the seedMaterials Cloud Function
 * Usage: node scripts/call-seed-materials.js [dataType]
 * dataType can be: pipes, fittings, flanges, plates, or all
 */

const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');

// Firebase config (from your project)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

// Get dataType from command line args or default to 'plates'
const dataType = process.argv[2] || 'plates';
const deleteExisting = process.argv[3] === '--delete-existing';

console.log(`\n🌱 Calling seedMaterials function...`);
console.log(`   Data Type: ${dataType}`);
console.log(`   Delete Existing: ${deleteExisting}\n`);

// Call the function
const seedMaterials = httpsCallable(functions, 'seedMaterials');

seedMaterials({ dataType, deleteExisting })
  .then((result) => {
    console.log('✅ Success!');
    console.log('\nResult:', JSON.stringify(result.data, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error calling function:');
    console.error('Code:', error.code);
    console.error('Message:', error.message);
    console.error('Details:', error.details);
    process.exit(1);
  });
