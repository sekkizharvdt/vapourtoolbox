/**
 * Three-Way Match Discrepancy Management
 *
 * Functions for querying and resolving discrepancies
 */

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { PermissionFlag, type MatchDiscrepancy } from '@vapour/types';
import { requireAnyPermission, type AuthorizationContext } from '@/lib/auth/authorizationService';

const logger = createLogger({ context: 'threeWayMatchService' });

/**
 * Get match discrepancies
 */
export async function getMatchDiscrepancies(
  db: Firestore,
  threeWayMatchId: string
): Promise<MatchDiscrepancy[]> {
  try {
    const discrepanciesRef = collection(db, COLLECTIONS.MATCH_DISCREPANCIES);
    const q = query(discrepanciesRef, where('threeWayMatchId', '==', threeWayMatchId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MatchDiscrepancy[];
  } catch (error) {
    logger.error('Failed to get match discrepancies', { error, threeWayMatchId });
    throw error;
  }
}

/**
 * Resolve a discrepancy
 *
 * @param db - Firestore instance
 * @param discrepancyId - Discrepancy ID to resolve
 * @param resolution - Resolution type
 * @param userId - User resolving the discrepancy
 * @param userName - User's display name
 * @param notes - Optional resolution notes
 * @param auth - Authorization context (optional for backward compatibility)
 * @throws AuthorizationError if user lacks CREATE_PO or APPROVE_PO permission
 */
export async function resolveDiscrepancy(
  db: Firestore,
  discrepancyId: string,
  resolution: MatchDiscrepancy['resolution'],
  userId: string,
  userName: string,
  notes?: string,
  auth?: AuthorizationContext
): Promise<void> {
  // Check permission if auth context provided
  // Allow users with either CREATE_PO or APPROVE_PO to resolve discrepancies
  if (auth) {
    requireAnyPermission(
      auth.userPermissions,
      [PermissionFlag.CREATE_PO, PermissionFlag.APPROVE_PO],
      auth.userId,
      'resolve match discrepancy'
    );
  }

  try {
    const discrepancyRef = doc(db, COLLECTIONS.MATCH_DISCREPANCIES, discrepancyId);

    await writeBatch(db)
      .update(discrepancyRef, {
        resolved: true,
        resolution,
        resolvedBy: userId,
        resolvedByName: userName,
        resolvedAt: serverTimestamp(),
        resolutionNotes: notes || '',
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
      .commit();

    logger.info('Discrepancy resolved', { discrepancyId, resolution });
  } catch (error) {
    logger.error('Failed to resolve discrepancy', { error, discrepancyId });
    throw error;
  }
}
