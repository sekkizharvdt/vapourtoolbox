/**
 * RFQ Workflow Operations
 *
 * Status transitions and workflow actions for RFQs
 */

import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { getRFQById } from './crud';
import { logAuditEvent, createAuditContext } from '@/lib/audit';

const logger = createLogger({ context: 'rfqService' });

/**
 * Issue RFQ to vendors
 */
export async function issueRFQ(rfqId: string, userId: string, userName: string): Promise<void> {
  const { db } = getFirebase();

  // Get RFQ for audit log
  const rfq = await getRFQById(rfqId);
  if (!rfq) {
    throw new Error('RFQ not found');
  }

  const now = Timestamp.now();

  await updateDoc(doc(db, COLLECTIONS.RFQS, rfqId), {
    status: 'ISSUED',
    issueDate: now,
    sentToVendorsAt: now,
    sentBy: userId,
    updatedAt: now,
    updatedBy: userId,
  });

  // Audit log: RFQ issued
  const auditContext = createAuditContext(userId, '', userName);
  await logAuditEvent(
    db,
    auditContext,
    'RFQ_ISSUED',
    'RFQ',
    rfqId,
    `Issued RFQ ${rfq.number} to ${rfq.vendorNames.length} vendor(s)`,
    {
      entityName: rfq.number,
      metadata: {
        title: rfq.title,
        vendorCount: rfq.vendorIds.length,
        vendorNames: rfq.vendorNames,
        projectIds: rfq.projectIds,
      },
    }
  );

  // TODO: Generate PDF and store URL
  // TODO: Send notifications to procurement manager

  logger.info('RFQ issued', { rfqId });
}

/**
 * Update RFQ status when offer is received
 */
export async function incrementOffersReceived(rfqId: string): Promise<void> {
  const { db } = getFirebase();

  const rfq = await getRFQById(rfqId);
  if (!rfq) {
    throw new Error('RFQ not found');
  }

  const newCount = rfq.offersReceived + 1;

  await updateDoc(doc(db, COLLECTIONS.RFQS, rfqId), {
    offersReceived: newCount,
    status: 'OFFERS_RECEIVED',
    updatedAt: Timestamp.now(),
  });

  logger.info('Offer received count updated', { rfqId, newCount });
}

/**
 * Update RFQ status when offer is evaluated
 */
export async function incrementOffersEvaluated(rfqId: string): Promise<void> {
  const { db } = getFirebase();

  const rfq = await getRFQById(rfqId);
  if (!rfq) {
    throw new Error('RFQ not found');
  }

  const newCount = rfq.offersEvaluated + 1;
  const status = newCount === rfq.offersReceived ? 'UNDER_EVALUATION' : 'OFFERS_RECEIVED';

  await updateDoc(doc(db, COLLECTIONS.RFQS, rfqId), {
    offersEvaluated: newCount,
    status,
    updatedAt: Timestamp.now(),
  });

  logger.info('Offer evaluated count updated', { rfqId, newCount });
}

/**
 * Complete RFQ with selected offer
 */
export async function completeRFQ(
  rfqId: string,
  selectedOfferId: string,
  completionNotes: string,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  const now = Timestamp.now();

  await updateDoc(doc(db, COLLECTIONS.RFQS, rfqId), {
    status: 'COMPLETED',
    selectedOfferId,
    completionNotes,
    completedAt: now,
    updatedAt: now,
    updatedBy: userId,
  });

  logger.info('RFQ completed', { rfqId, selectedOfferId });
}

/**
 * Cancel RFQ
 */
export async function cancelRFQ(
  rfqId: string,
  reason: string,
  userId: string,
  userName: string
): Promise<void> {
  const { db } = getFirebase();

  // Get RFQ for audit log
  const rfq = await getRFQById(rfqId);
  if (!rfq) {
    throw new Error('RFQ not found');
  }

  await updateDoc(doc(db, COLLECTIONS.RFQS, rfqId), {
    status: 'CANCELLED',
    completionNotes: reason,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  // Audit log: RFQ cancelled
  const auditContext = createAuditContext(userId, '', userName);
  await logAuditEvent(
    db,
    auditContext,
    'RFQ_CANCELLED',
    'RFQ',
    rfqId,
    `Cancelled RFQ ${rfq.number}: ${reason}`,
    {
      entityName: rfq.number,
      severity: 'WARNING',
      metadata: {
        title: rfq.title,
        cancellationReason: reason,
        projectIds: rfq.projectIds,
      },
    }
  );

  logger.info('RFQ cancelled', { rfqId });
}
