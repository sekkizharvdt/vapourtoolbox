import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';

/**
 * Resolves the GCP project ID reliably across Firebase Functions v1 and v2.
 *
 * Firebase Functions v2 runs on Cloud Run where GCLOUD_PROJECT and GCP_PROJECT
 * may not be set. This helper checks multiple sources in order of reliability:
 * 1. Firebase Admin SDK app options (most reliable)
 * 2. GOOGLE_CLOUD_PROJECT (set by Cloud Run)
 * 3. GCLOUD_PROJECT (legacy, set in v1)
 * 4. GCP_PROJECT (legacy fallback)
 * 5. FIREBASE_CONFIG JSON (set by Firebase)
 */
export function getProjectId(): string {
  // 1. Firebase Admin SDK — always available after admin.initializeApp()
  const adminProjectId = admin.app().options.projectId;
  if (adminProjectId) return adminProjectId;

  // 2. Cloud Run / v2 env var
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;

  // 3. Legacy v1 env vars
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.GCP_PROJECT) return process.env.GCP_PROJECT;

  // 4. Firebase config JSON
  try {
    const config = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
    if (config.projectId) return config.projectId;
  } catch {
    // ignore parse errors
  }

  logger.error('Could not resolve GCP project ID from any source');
  throw new Error('Could not resolve GCP project ID. Ensure Firebase Admin is initialized.');
}
