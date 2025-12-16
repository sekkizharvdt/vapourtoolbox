/**
 * System Status Service
 *
 * Reads system status data from Firestore.
 * The data is generated and uploaded by a script (scripts/update-system-status.js)
 * which runs `pnpm audit` and `pnpm outdated` and stores results.
 */

import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { SystemStatusResponse } from '@vapour/types';

const logger = createLogger({ context: 'systemStatusService' });

const SYSTEM_STATUS_DOC_ID = 'current';

/**
 * Get the current system status from Firestore
 */
export async function getSystemStatus(): Promise<SystemStatusResponse | null> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.SYSTEM_STATUS, SYSTEM_STATUS_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return docSnap.data() as SystemStatusResponse;
  } catch (error) {
    logger.error('getSystemStatus failed', { error });
    throw new Error('Failed to get system status');
  }
}
