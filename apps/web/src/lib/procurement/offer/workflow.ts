/**
 * Offer Workflow Functions
 *
 * Functions for managing offer lifecycle (select, reject, withdraw)
 */

import { doc, updateDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { PERMISSION_FLAGS } from '@vapour/constants';
import { getOfferById } from './crud';
import { getOffersByRFQ } from './queries';
import { logAuditEvent, createAuditContext } from '@/lib/audit';
import { requirePermission } from '@/lib/auth';
import { offerStateMachine } from '@/lib/workflow/stateMachines';

const logger = createLogger({ context: 'offerService' });

/**
 * Select winning offer (changes status to SELECTED)
 */
export async function selectOffer(
  offerId: string,
  userId: string,
  userPermissions: number,
  userName?: string,
  userEmail?: string,
  completionNotes?: string
): Promise<void> {
  const { db } = getFirebase();

  // Authorization: Require APPROVE_PO permission (offers lead to PO creation)
  requirePermission(userPermissions, PERMISSION_FLAGS.MANAGE_PROCUREMENT, userId, 'select offer');

  const offer = await getOfferById(offerId);
  if (!offer) {
    throw new Error('Offer not found');
  }

  // Validate state machine transition
  const transitionResult = offerStateMachine.validateTransition(offer.status, 'SELECTED');
  if (!transitionResult.allowed) {
    throw new Error(transitionResult.reason || `Cannot select offer with status: ${offer.status}`);
  }

  // Mark other offers as rejected
  const allOffers = await getOffersByRFQ(offer.rfqId);
  const batch = writeBatch(db);

  const rejectedOfferIds: string[] = [];

  allOffers.forEach((other) => {
    if (other.id === offerId) {
      batch.update(doc(db, COLLECTIONS.OFFERS, other.id), {
        status: 'SELECTED',
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    } else if (other.status !== 'WITHDRAWN' && other.status !== 'REJECTED') {
      batch.update(doc(db, COLLECTIONS.OFFERS, other.id), {
        status: 'REJECTED',
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
      rejectedOfferIds.push(other.id);
    }
  });

  // Complete the RFQ with the selected offer
  batch.update(doc(db, COLLECTIONS.RFQS, offer.rfqId), {
    status: 'COMPLETED',
    selectedOfferId: offerId,
    completionNotes: completionNotes || `Offer ${offer.number} selected from ${offer.vendorName}`,
    completedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  await batch.commit();

  logger.info('Offer selected and RFQ completed', { offerId, rfqId: offer.rfqId });

  // Log audit event (fire-and-forget)
  const auditContext = createAuditContext(userId, userEmail || '', userName || '');
  logAuditEvent(
    db,
    auditContext,
    'OFFER_SELECTED',
    'OFFER',
    offerId,
    `Selected offer ${offer.number} from ${offer.vendorName} for RFQ ${offer.rfqNumber}`,
    {
      entityName: offer.number,
      parentEntityType: 'RFQ',
      parentEntityId: offer.rfqId,
      metadata: {
        vendorId: offer.vendorId,
        vendorName: offer.vendorName,
        totalAmount: offer.totalAmount,
        rfqNumber: offer.rfqNumber,
        rejectedOfferCount: rejectedOfferIds.length,
        completionNotes,
      },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));
}

/**
 * Reject an offer
 */
export async function rejectOffer(
  offerId: string,
  reason: string,
  userId: string,
  userPermissions: number,
  userName?: string,
  userEmail?: string
): Promise<void> {
  const { db } = getFirebase();

  // Authorization: Require APPROVE_PO permission (offers lead to PO creation)
  requirePermission(userPermissions, PERMISSION_FLAGS.MANAGE_PROCUREMENT, userId, 'reject offer');

  // Get offer for audit trail and validation
  const offer = await getOfferById(offerId);
  if (!offer) {
    throw new Error('Offer not found');
  }

  // Validate state machine transition
  const transitionResult = offerStateMachine.validateTransition(offer.status, 'REJECTED');
  if (!transitionResult.allowed) {
    throw new Error(transitionResult.reason || `Cannot reject offer with status: ${offer.status}`);
  }

  await updateDoc(doc(db, COLLECTIONS.OFFERS, offerId), {
    status: 'REJECTED',
    evaluationNotes: reason,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('Offer rejected', { offerId });

  // Log audit event (fire-and-forget)
  const auditContext = createAuditContext(userId, userEmail || '', userName || '');
  logAuditEvent(
    db,
    auditContext,
    'OFFER_REJECTED',
    'OFFER',
    offerId,
    `Rejected offer ${offer.number} from ${offer.vendorName}`,
    {
      entityName: offer.number,
      parentEntityType: 'RFQ',
      parentEntityId: offer.rfqId,
      metadata: {
        vendorId: offer.vendorId,
        vendorName: offer.vendorName,
        rejectionReason: reason,
      },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));
}

/**
 * Withdraw an offer
 */
export async function withdrawOffer(
  offerId: string,
  reason: string,
  userId: string,
  userPermissions: number,
  userName?: string,
  userEmail?: string
): Promise<void> {
  const { db } = getFirebase();

  // Authorization: Require APPROVE_PO permission (offers lead to PO creation)
  requirePermission(userPermissions, PERMISSION_FLAGS.MANAGE_PROCUREMENT, userId, 'withdraw offer');

  // Get offer for audit trail and validation
  const offer = await getOfferById(offerId);
  if (!offer) {
    throw new Error('Offer not found');
  }

  // Validate state machine transition
  const transitionResult = offerStateMachine.validateTransition(offer.status, 'WITHDRAWN');
  if (!transitionResult.allowed) {
    throw new Error(
      transitionResult.reason || `Cannot withdraw offer with status: ${offer.status}`
    );
  }

  await updateDoc(doc(db, COLLECTIONS.OFFERS, offerId), {
    status: 'WITHDRAWN',
    evaluationNotes: reason,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('Offer withdrawn', { offerId });

  // Log audit event (fire-and-forget)
  const auditContext = createAuditContext(userId, userEmail || '', userName || '');
  logAuditEvent(
    db,
    auditContext,
    'OFFER_WITHDRAWN',
    'OFFER',
    offerId,
    `Withdrew offer ${offer.number} from ${offer.vendorName}`,
    {
      entityName: offer.number,
      parentEntityType: 'RFQ',
      parentEntityId: offer.rfqId,
      metadata: {
        vendorId: offer.vendorId,
        vendorName: offer.vendorName,
        withdrawalReason: reason,
      },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));
}
