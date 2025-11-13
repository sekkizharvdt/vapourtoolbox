/**
 * Three-Way Match Approval Workflow
 *
 * Functions for approving and rejecting matches
 */

import { doc, serverTimestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'threeWayMatchService' });

/**
 * Approve a match
 */
export async function approveMatch(
  db: Firestore,
  matchId: string,
  userId: string,
  userName: string,
  comments?: string
): Promise<void> {
  try {
    const matchRef = doc(db, COLLECTIONS.THREE_WAY_MATCHES, matchId);

    // Update match status
    await writeBatch(db)
      .update(matchRef, {
        approvalStatus: 'APPROVED',
        approvedBy: userId,
        approvedByName: userName,
        approvedAt: serverTimestamp(),
        approvalComments: comments || '',
        resolved: true,
        resolvedBy: userId,
        resolvedAt: serverTimestamp(),
        status: 'APPROVED_WITH_VARIANCE',
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
      .commit();

    // Create vendor bill in accounting system
    const { createVendorBillFromMatch } = await import(
      '@/lib/accounting/vendorBillIntegrationService'
    );

    const vendorBillId = await createVendorBillFromMatch(db, matchId, userId, userName);

    // Update match with vendor bill ID
    await updateDoc(matchRef, {
      vendorBillId,
      updatedAt: serverTimestamp(),
    });

    logger.info('Match approved and vendor bill created', {
      matchId,
      vendorBillId,
      approvedBy: userName,
    });
  } catch (error) {
    logger.error('Failed to approve match', { error, matchId });
    throw error;
  }
}

/**
 * Reject a match
 */
export async function rejectMatch(
  db: Firestore,
  matchId: string,
  userId: string,
  userName: string,
  reason: string
): Promise<void> {
  try {
    const matchRef = doc(db, COLLECTIONS.THREE_WAY_MATCHES, matchId);

    await writeBatch(db)
      .update(matchRef, {
        approvalStatus: 'REJECTED',
        approvedBy: userId,
        approvedByName: userName,
        approvedAt: serverTimestamp(),
        approvalComments: reason,
        status: 'REJECTED',
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
      .commit();

    logger.info('Match rejected', { matchId, rejectedBy: userName });
  } catch (error) {
    logger.error('Failed to reject match', { error, matchId });
    throw error;
  }
}
