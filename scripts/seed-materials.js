#!/usr/bin/env node
/**
 * Script to call the seedMaterials Firebase Function
 * Requires authentication to Firebase
 */

const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

// Firebase configuration (from environment or hardcoded)
const firebaseConfig = {
  apiKey: 'AIzaSyCxzqzAUTT3Ouiv-szpfO1Au4LwEMnP-4w',
  authDomain: 'vapour-toolbox.firebaseapp.com',
  projectId: 'vapour-toolbox',
  storageBucket: 'vapour-toolbox.firebasestorage.app',
  messagingSenderId: '697891123609',
  appId: '1:697891123609:web:334e56be149a056f252308',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, 'asia-south1');
const auth = getAuth(app);

async function seedMaterials() {
  try {
    // You need to provide credentials - either via environment variables or prompts
    const email = process.env.FIREBASE_USER_EMAIL;
    const password = process.env.FIREBASE_USER_PASSWORD;

    if (!email || !password) {
      console.error(
        '❌ Error: Please set FIREBASE_USER_EMAIL and FIREBASE_USER_PASSWORD environment variables'
      );
      console.log('\nExample:');
      console.log(
        '  FIREBASE_USER_EMAIL=your@email.com FIREBASE_USER_PASSWORD=yourpassword node scripts/seed-materials.js'
      );
      process.exit(1);
    }

    console.log('🔐 Authenticating...');
    await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Authenticated successfully\n');

    console.log('📦 Calling seedMaterials function...');
    console.log('   Data type: all (pipes, fittings, flanges)');
    console.log('   Delete existing: false\n');

    const seedMaterialsFunction = httpsCallable(functions, 'seedmaterials');
    const result = await seedMaterialsFunction({
      dataType: 'all',
      deleteExisting: false,
    });

    console.log('\n✅ Seeding completed successfully!\n');
    console.log('📊 Results:');
    console.log('   Materials created:', result.data.materialsCreated);
    console.log('   Variants created:', result.data.variantsCreated);
    console.log('\n📋 Details:');

    if (result.data.details.pipes) {
      console.log('   Pipes:');
      console.log('     Material ID:', result.data.details.pipes.materialId);
      console.log('     Variants:', result.data.details.pipes.variants);
    }

    if (result.data.details.fittings) {
      console.log('   Fittings:');
      console.log('     Material ID:', result.data.details.fittings.materialId);
      console.log('     Variants:', result.data.details.fittings.variants);
    }

    if (result.data.details.flanges) {
      console.log('   Flanges:');
      console.log('     Material ID:', result.data.details.flanges.materialId);
      console.log('     Variants:', result.data.details.flanges.variants);
    }

    console.log('\n🎉 All materials data has been seeded to Firestore!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding materials:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.details) {
      console.error('   Details:', error.details);
    }
    process.exit(1);
  }
}

seedMaterials();
