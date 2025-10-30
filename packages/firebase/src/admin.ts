// Firebase Admin SDK configuration (for Cloud Functions)

import * as admin from 'firebase-admin';
import { getFirebaseAdminConfig, parseServiceAccountKey } from './envConfig';

let firebaseAdmin: admin.app.App;
let authInstance: admin.auth.Auth;
let dbInstance: admin.firestore.Firestore;
let storageInstance: admin.storage.Storage;

/**
 * Get Admin credential based on environment
 * Supports both service account (production) and application default (development)
 */
function getAdminCredential(): admin.credential.Credential {
  const config = getFirebaseAdminConfig();

  // Option 1: Service account key (recommended for production)
  if (config.serviceAccountKey) {
    try {
      const serviceAccount = parseServiceAccountKey(config.serviceAccountKey);
      return admin.credential.cert(serviceAccount as admin.ServiceAccount);
    } catch (error) {
      throw new Error(
        `Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  // Option 2: Application default credentials (for development)
  // This works when running locally with `gcloud auth application-default login`
  if (process.env.NODE_ENV === 'development') {
    return admin.credential.applicationDefault();
  }

  throw new Error(
    'Firebase Admin credentials not found.\n' +
      'For production: Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable.\n' +
      'For development: Use `gcloud auth application-default login` or set FIREBASE_SERVICE_ACCOUNT_KEY.'
  );
}

/**
 * Initialize Firebase Admin SDK
 * This should only be called in Cloud Functions or server-side code
 */
export function initializeFirebaseAdmin(): {
  app: admin.app.App;
  auth: admin.auth.Auth;
  db: admin.firestore.Firestore;
  storage: admin.storage.Storage;
} {
  if (!firebaseAdmin) {
    const config = getFirebaseAdminConfig();

    if (admin.apps.length === 0) {
      firebaseAdmin = admin.initializeApp({
        credential: getAdminCredential(),
        projectId: config.projectId,
      });
    } else {
      firebaseAdmin = admin.apps[0]!;
    }
  }

  // Cache instances for performance
  if (!authInstance) authInstance = firebaseAdmin.auth();
  if (!dbInstance) dbInstance = firebaseAdmin.firestore();
  if (!storageInstance) storageInstance = firebaseAdmin.storage();

  return {
    app: firebaseAdmin,
    auth: authInstance,
    db: dbInstance,
    storage: storageInstance,
  };
}

/**
 * Get Firebase Admin instances (cached for performance)
 */
export function getFirebaseAdmin(): {
  app: admin.app.App;
  auth: admin.auth.Auth;
  db: admin.firestore.Firestore;
  storage: admin.storage.Storage;
} {
  if (!firebaseAdmin) {
    return initializeFirebaseAdmin();
  }

  return {
    app: firebaseAdmin,
    auth: authInstance,
    db: dbInstance,
    storage: storageInstance,
  };
}
