// Firebase client-side configuration

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFirebaseClientConfig } from './envConfig';

/**
 * Initialize Firebase app (singleton)
 */
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

/**
 * Initialize Firebase with validated configuration
 * Throws clear error if environment variables are missing
 */
export function initializeFirebase() {
  if (!getApps().length) {
    // Validate and get configuration (will throw if invalid)
    const config = getFirebaseClientConfig();

    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  }
  return { app, auth, db, storage };
}

/**
 * Get Firebase instances
 * Initializes if not already initialized
 */
export function getFirebaseClient() {
  if (!app) {
    return initializeFirebase();
  }
  return { app, auth, db, storage };
}
