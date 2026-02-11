// Firebase Environment Configuration with Validation

import { z } from 'zod';
import { createLogger } from '@vapour/utils';

const logger = createLogger('FirebaseConfig');

/**
 * Firebase Client Configuration Schema
 * These are public and safe to expose to the client
 */
const firebaseClientConfigSchema = z.object({
  apiKey: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_API_KEY is required'),
  authDomain: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is required'),
  projectId: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID is required'),
  storageBucket: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is required'),
  messagingSenderId: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID is required'),
  appId: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_APP_ID is required'),
});

/**
 * Firebase Admin Configuration Schema
 * These are secrets and should never be exposed to the client
 */
const firebaseAdminConfigSchema = z.object({
  projectId: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  serviceAccountKey: z.string().optional(), // JSON string of service account
});

export type FirebaseClientConfig = z.infer<typeof firebaseClientConfigSchema>;
export type FirebaseAdminConfig = z.infer<typeof firebaseAdminConfigSchema>;

/**
 * Get and validate Firebase client configuration
 * Throws clear error if any required env variable is missing
 */
export function getFirebaseClientConfig(): FirebaseClientConfig {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  try {
    return firebaseClientConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => err.message).join('\n');
      throw new Error(
        `Firebase Client Configuration Error:\n${missingVars}\n\n` +
          `Please check your environment variables. Required variables:\n` +
          `- NEXT_PUBLIC_FIREBASE_API_KEY\n` +
          `- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN\n` +
          `- NEXT_PUBLIC_FIREBASE_PROJECT_ID\n` +
          `- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET\n` +
          `- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID\n` +
          `- NEXT_PUBLIC_FIREBASE_APP_ID`
      );
    }
    throw error;
  }
}

/**
 * Get and validate Firebase admin configuration
 * Throws clear error if any required env variable is missing
 */
export function getFirebaseAdminConfig(): FirebaseAdminConfig {
  const config = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
  };

  try {
    return firebaseAdminConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => err.message).join('\n');
      throw new Error(
        `Firebase Admin Configuration Error:\n${missingVars}\n\n` +
          `Please check your environment variables. Required variables:\n` +
          `- FIREBASE_PROJECT_ID\n` +
          `- FIREBASE_SERVICE_ACCOUNT_KEY (for production)\n\n` +
          `For development, you can use Application Default Credentials (gcloud auth).`
      );
    }
    throw error;
  }
}

/**
 * Parse service account JSON
 * Throws clear error if JSON is invalid
 */
export function parseServiceAccountKey(jsonString: string): Record<string, unknown> {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(
      'Invalid FIREBASE_SERVICE_ACCOUNT_KEY: Must be valid JSON.\n' +
        'Expected format: {"type": "service_account", "project_id": "...", ...}'
    );
  }
}

/**
 * Validate that Firebase configuration is properly set up
 * This should be called during application startup
 */
export function validateFirebaseEnvironment(): {
  client: FirebaseClientConfig;
  admin?: FirebaseAdminConfig;
} {
  // Always validate client config (used in web app)
  const client = getFirebaseClientConfig();

  // Only validate admin config if running server-side.
  // For static export apps (output: 'export'), admin config is never needed by the
  // web app — it's only used by Cloud Functions. During next build, this code runs
  // server-side for prerendering but admin env vars may not be available in CI.
  let admin: FirebaseAdminConfig | undefined;
  if (typeof window === 'undefined') {
    try {
      admin = getFirebaseAdminConfig();
    } catch (error) {
      logger.warn('Firebase Admin config not available', error);
    }
  }

  return { client, admin };
}
