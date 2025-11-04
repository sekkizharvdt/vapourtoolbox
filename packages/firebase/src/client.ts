// Firebase client-side configuration

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFirebaseClientConfig } from './envConfig';

/**
 * Initialize Firebase app (singleton)
 */
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;
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
    functions = getFunctions(app);
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
          if (host && port) {
            connectFirestoreEmulator(db, host, parseInt(port));
            console.log('✅ Connected to Firestore Emulator');
          }
        } catch (error) {
          console.warn('Firestore emulator already connected');
        }
      }

      if (useEmulator) {
        try {
          // Functions emulator runs on localhost:5001
          connectFunctionsEmulator(functions, 'localhost', 5001);
          console.log('✅ Connected to Functions Emulator');
        } catch (error) {
          console.warn('Functions emulator already connected');
        }
      }

      // Expose Firebase instances to window for E2E testing
      if (useEmulator) {
        interface WindowWithFirebase extends Window {
          __firebaseAuth?: Auth;
          __firebaseDb?: Firestore;
        }
        (window as WindowWithFirebase).__firebaseAuth = auth;
        (window as WindowWithFirebase).__firebaseDb = db;
        console.log('🧪 Firebase instances exposed to window for testing');
      }

      emulatorConnected = true;
    }
  }
  return { app, auth, db, functions, storage };
}

/**
 * Get Firebase instances
 * Initializes if not already initialized
 */
export function getFirebaseClient() {
  if (!app) {
    return initializeFirebase();
  }
  return { app, auth, db, functions, storage };
}
