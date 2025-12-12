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
import { createTaskNotification } from '@/lib/tasks/taskNotificationService';

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

  // Future: Generate PDF and store URL
  // Future: Send notifications to procurement manager

  logger.info('RFQ issued', { rfqId });
}

/**
 * Update RFQ status when offer is received
 * Sends task notification to RFQ creator when first offer arrives
 * and when all expected offers are received
 */
export async function incrementOffersReceived(rfqId: string, vendorName?: string): Promise<void> {
  const { db } = getFirebase();

  const rfq = await getRFQById(rfqId);
  if (!rfq) {
    throw new Error('RFQ not found');
  }

  const newCount = rfq.offersReceived + 1;
  const totalVendors = rfq.vendorIds.length;
  const isFirstOffer = rfq.offersReceived === 0;
  const allOffersReceived = newCount === totalVendors;

  await updateDoc(doc(db, COLLECTIONS.RFQS, rfqId), {
    offersReceived: newCount,
    status: 'OFFERS_RECEIVED',
    updatedAt: Timestamp.now(),
  });

  // Create task notification for RFQ creator
  try {
    if (isFirstOffer) {
      // First offer received - informational notification
      await createTaskNotification({
        type: 'informational',
        category: 'RFQ_OFFER_RECEIVED',
        userId: rfq.createdBy,
        assignedBy: 'system',
        assignedByName: vendorName || 'Vendor',
        title: `Offer Received for RFQ ${rfq.number}`,
        message: `${vendorName || 'A vendor'} submitted an offer for "${rfq.title}". ${newCount}/${totalVendors} offers received.`,
        entityType: 'RFQ',
        entityId: rfqId,
        linkUrl: `/procurement/rfqs/${rfqId}/offers`,
        priority: 'MEDIUM',
        projectId: rfq.projectIds[0],
      });
    }

    if (allOffersReceived) {
      // All offers received - actionable task to evaluate
      await createTaskNotification({
        type: 'actionable',
        category: 'RFQ_READY_FOR_EVALUATION',
        userId: rfq.createdBy,
        assignedBy: 'system',
        assignedByName: 'System',
        title: `Evaluate Offers for RFQ ${rfq.number}`,
        message: `All ${totalVendors} offers received for "${rfq.title}". Ready for evaluation and vendor selection.`,
        entityType: 'RFQ',
        entityId: rfqId,
        linkUrl: `/procurement/rfqs/${rfqId}/offers`,
        priority: 'HIGH',
        autoCompletable: true,
        projectId: rfq.projectIds[0],
      });
    }
  } catch (error) {
    logger.error('Failed to create offer received task notification', { error, rfqId });
    // Don't fail the main operation
  }

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
