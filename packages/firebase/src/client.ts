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

    // Connect to emulators ONLY in development/test environments
    // CRITICAL: Do NOT use window.location.hostname check to prevent
    // emulator connections in production builds accessed via localhost
    if (!emulatorConnected && typeof window !== 'undefined') {
      // Only enable emulators if explicitly set at BUILD time
      // Never use runtime hostname checks to avoid production contamination
      const useEmulator =
        process.env.NEXT_PUBLIC_USE_EMULATOR === 'true' || process.env.NODE_ENV === 'test';

      if (useEmulator && process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_AUTH_URL) {
        try {
          connectAuthEmulator(auth, process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_AUTH_URL, {
            disableWarnings: true,
          });
          if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
            console.log('✅ Connected to Auth Emulator');
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
            console.warn('Auth emulator already connected');
          }
        }
      }

      if (useEmulator && process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE_URL) {
        try {
          const [host, port] = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE_URL.split(':');
          if (host && port) {
            connectFirestoreEmulator(db, host, parseInt(port));
            if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
              console.log('✅ Connected to Firestore Emulator');
            }
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
            console.warn('Firestore emulator already connected');
          }
        }
      }

      if (useEmulator && process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_FUNCTIONS_URL) {
        try {
          const [host, port] = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_FUNCTIONS_URL.split(':');
          if (host && port) {
            connectFunctionsEmulator(functions, host, parseInt(port));
            if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
              console.log('✅ Connected to Functions Emulator');
            }
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
            console.warn('Functions emulator already connected');
          }
        }
      }

      // Expose Firebase instances to window ONLY for E2E testing
      if (useEmulator && process.env.NODE_ENV === 'test') {
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
