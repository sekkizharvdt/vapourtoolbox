// Firebase client initialization for web app
'use client';

import { initializeFirebase, getFirebaseClient } from '@vapour/firebase';

// Initialize Firebase on client side
let firebaseInitialized = false;

export function getFirebase() {
  if (!firebaseInitialized) {
    try {
      initializeFirebase();
      firebaseInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      throw error;
    }
  }

  return getFirebaseClient();
}

// Re-export for convenience
export { getFirebaseClient } from '@vapour/firebase';

// Export db directly for convenience
export const db = getFirebase().db;
export const auth = getFirebase().auth;
export const storage = getFirebase().storage;
