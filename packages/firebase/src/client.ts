// Firebase client-side configuration

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFirebaseClientConfig } from './envConfig';

/**
 * Initialize Firebase app (singleton)
 */
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let emulatorConnected = false;

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

    // Connect to emulators if running in test/emulator mode
    if (!emulatorConnected && typeof window !== 'undefined') {
      const useEmulator =
        process.env.NEXT_PUBLIC_USE_EMULATOR === 'true' ||
        process.env.NODE_ENV === 'test' ||
        window.location.hostname === 'localhost';

      if (useEmulator && process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_AUTH_URL) {
        try {
          connectAuthEmulator(auth, process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_AUTH_URL, {
            disableWarnings: true,
          });
          console.log('✅ Connected to Auth Emulator');
        } catch (error) {
          console.warn('Auth emulator already connected');
        }
      }

      if (useEmulator && process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE_URL) {
        try {
          const [host, port] = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE_URL.split(':');
          connectFirestoreEmulator(db, host, parseInt(port));
          console.log('✅ Connected to Firestore Emulator');
        } catch (error) {
          console.warn('Firestore emulator already connected');
        }
      }

      // Expose Firebase instances to window for E2E testing
      if (useEmulator) {
        (window as any).__firebaseAuth = auth;
        (window as any).__firebaseDb = db;
        console.log('🧪 Firebase instances exposed to window for testing');
      }

      emulatorConnected = true;
    }
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
