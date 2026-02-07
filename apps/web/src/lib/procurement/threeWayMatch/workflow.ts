/**
 * Three-Way Match Approval Workflow
 *
 * Functions for approving and rejecting matches
 */

import {
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  getDoc,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { logAuditEvent, createAuditContext } from '@/lib/audit';
import { PERMISSION_FLAGS } from '@vapour/constants';
import type { ThreeWayMatch } from '@vapour/types';
import { requirePermission, type AuthorizationContext } from '@/lib/auth/authorizationService';

const logger = createLogger({ context: 'threeWayMatchService' });

/**
 * Approve a match
 *
 * @param db - Firestore instance
 * @param matchId - Match ID to approve
 * @param userId - User performing the approval
 * @param userName - User's display name
 * @param comments - Optional approval comments
 * @param auth - Authorization context (optional for backward compatibility)
 * @throws AuthorizationError if user lacks APPROVE_PO permission
 */
export async function approveMatch(
  db: Firestore,
  matchId: string,
  userId: string,
  userName: string,
  comments?: string,
  auth?: AuthorizationContext
): Promise<void> {
  // Check permission if auth context provided
  if (auth) {
    requirePermission(
      auth.userPermissions,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      auth.userId,
      'approve three-way match'
    );
  }

  try {
    const matchRef = doc(db, COLLECTIONS.THREE_WAY_MATCHES, matchId);

    // Get match for audit log
    const matchDoc = await getDoc(matchRef);
    const match = matchDoc.exists()
      ? ({ id: matchDoc.id, ...matchDoc.data() } as ThreeWayMatch)
      : null;

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
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
      .commit();

    // Create vendor bill in accounting system
    const { createVendorBillFromMatch } =
      await import('@/lib/accounting/vendorBillIntegrationService');

    const vendorBillId = await createVendorBillFromMatch(db, matchId, userId, userName);

    // Update match with vendor bill ID
    await updateDoc(matchRef, {
      vendorBillId,
      updatedAt: serverTimestamp(),
    });

    // Audit log: Match approved
    const auditContext = createAuditContext(userId, '', userName);
    await logAuditEvent(
      db,
      auditContext,
      'MATCH_APPROVED',
      'THREE_WAY_MATCH',
      matchId,
      `Approved 3-way match ${match?.matchNumber || matchId}`,
      {
        entityName: match?.matchNumber || matchId,
        metadata: {
          poNumber: match?.poNumber,
          grNumber: match?.grNumber,
          vendorName: match?.vendorName,
          invoiceAmount: match?.invoiceAmount,
          variance: match?.variance,
          vendorBillId,
          comments,
        },
      }
    );

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
 *
 * @param db - Firestore instance
 * @param matchId - Match ID to reject
 * @param userId - User performing the rejection
 * @param userName - User's display name
 * @param reason - Rejection reason
 * @param auth - Authorization context (optional for backward compatibility)
 * @throws AuthorizationError if user lacks APPROVE_PO permission
 */
export async function rejectMatch(
  db: Firestore,
  matchId: string,
  userId: string,
  userName: string,
  reason: string,
  auth?: AuthorizationContext
): Promise<void> {
  // Check permission if auth context provided
  if (auth) {
    requirePermission(
      auth.userPermissions,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      auth.userId,
      'reject three-way match'
    );
  }

  try {
    const matchRef = doc(db, COLLECTIONS.THREE_WAY_MATCHES, matchId);

    // Get match for audit log
    const matchDoc = await getDoc(matchRef);
    const match = matchDoc.exists()
      ? ({ id: matchDoc.id, ...matchDoc.data() } as ThreeWayMatch)
      : null;

    await writeBatch(db)
      .update(matchRef, {
        approvalStatus: 'REJECTED',
        approvedBy: userId,
        approvedByName: userName,
        approvedAt: serverTimestamp(),
        approvalComments: reason,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
      .commit();

    // Audit log: Match rejected
    const auditContext = createAuditContext(userId, '', userName);
    await logAuditEvent(
      db,
      auditContext,
      'MATCH_REJECTED',
      'THREE_WAY_MATCH',
      matchId,
      `Rejected 3-way match ${match?.matchNumber || matchId}: ${reason}`,
      {
        entityName: match?.matchNumber || matchId,
        severity: 'WARNING',
        metadata: {
          poNumber: match?.poNumber,
          grNumber: match?.grNumber,
          vendorName: match?.vendorName,
          rejectionReason: reason,
        },
      }
    );

    logger.info('Match rejected', { matchId, rejectedBy: userName });
  } catch (error) {
    logger.error('Failed to reject match', { error, matchId });
    throw error;
  }
}
