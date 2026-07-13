// Firebase client-side configuration

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getFirebaseClientConfig } from './envConfig';
import { createLogger } from '@vapour/utils';

const logger = createLogger('Firebase');

/**
 * Initialize Firebase app (singleton)
 */
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;
let storage: FirebaseStorage;
let emulatorConnected = false;
let appCheckInitialized = false;

/**
 * Initialize Firebase with validated configuration
 * Throws clear error if environment variables are missing
 */
export function initializeFirebase() {
  const apps = getApps();

  if (!apps.length) {
    // Validate and get configuration (will throw if invalid)
    const config = getFirebaseClientConfig();
    app = initializeApp(config);
  } else {
    // apps[0] is guaranteed to exist since we're in the else branch of !apps.length
    app = apps[0]!;
  }

  // App Check (security finding #4): activates only when a reCAPTCHA v3 site
  // key is configured at build time, so environments without console setup are
  // unaffected. Rollout: (1) register the web app in Firebase console App
  // Check with a reCAPTCHA v3 key, (2) set NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY
  // in the hosting build env, (3) monitor the console metrics, then (4) flip
  // enforcement on Functions/Firestore/Storage in the console (or set
  // enforceAppCheck: true on callables).
  const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  if (!appCheckInitialized && typeof window !== 'undefined' && appCheckSiteKey) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
      appCheckInitialized = true;
      logger.info('✅ App Check initialized (reCAPTCHA v3)');
    } catch (error) {
      // Never block app startup on App Check — enforcement is opt-in server-side
      logger.warn('App Check initialization failed', { error });
    }
  }

  // Always initialize/update service instances
  // These getters are idempotent and return the existing instance if available
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
        logger.info('✅ Connected to Auth Emulator');
      } catch (error) {
        logger.warn('Auth emulator already connected');
      }
    }

    if (useEmulator && process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE_URL) {
      try {
        const [host, port] = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE_URL.split(':');
        if (host && port) {
          connectFirestoreEmulator(db, host, parseInt(port));
          logger.info('✅ Connected to Firestore Emulator');
        }
      } catch (error) {
        logger.warn('Firestore emulator already connected');
      }
    }

    if (useEmulator && process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_FUNCTIONS_URL) {
      try {
        const [host, port] = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_FUNCTIONS_URL.split(':');
        if (host && port) {
          connectFunctionsEmulator(functions, host, parseInt(port));
          logger.info('✅ Connected to Functions Emulator');
        }
      } catch (error) {
        logger.warn('Functions emulator already connected');
      }
    }

    // Expose Firebase instances to window ONLY for E2E testing.
    // Double-guarded: requires BOTH useEmulator flag AND test environment.
    // Safe in production — neither condition is true outside test setups.
    if (useEmulator && process.env.NODE_ENV === 'test') {
      interface WindowWithFirebase extends Window {
        __firebaseAuth?: Auth;
        __firebaseDb?: Firestore;
      }
      (window as WindowWithFirebase).__firebaseAuth = auth;
      (window as WindowWithFirebase).__firebaseDb = db;
      logger.info('🧪 Firebase instances exposed to window for testing');
    }

    emulatorConnected = true;
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
