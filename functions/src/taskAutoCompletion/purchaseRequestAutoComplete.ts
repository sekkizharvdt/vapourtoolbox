/**
 * Purchase Request Auto-Completion Cloud Function
 *
 * Automatically completes PR_SUBMITTED tasks when the Purchase Request
 * is approved or rejected.
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { findTaskNotificationByEntity, autoCompleteTask, logAutoCompletionEvent } from './helpers';

/**
 * Triggered when a Purchase Request document is updated
 * Auto-completes the review task when PR status changes to APPROVED or REJECTED
 */
export const onPurchaseRequestStatusChange = onDocumentUpdated(
  {
    document: 'purchaseRequests/{prId}',
    region: 'us-central1',
  },
  async (event) => {
    const prId = event.params.prId;

    // Get before and after data
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.warn('[onPurchaseRequestStatusChange] Missing before/after data', { prId });
      return;
    }

    // Check if status actually changed
    if (before.status === after.status) {
      return;
    }

    const newStatus = after.status;
    const oldStatus = before.status;
    const prNumber = after.number || prId;

    logger.info('[onPurchaseRequestStatusChange] PR status changed', {
      prId,
      prNumber,
      oldStatus,
      newStatus,
    });

    // Auto-complete task when PR is approved or rejected from SUBMITTED status
    if (oldStatus === 'SUBMITTED' && (newStatus === 'APPROVED' || newStatus === 'REJECTED')) {
      try {
        // Find the review task (PR_SUBMITTED category, pending or in_progress)
        const reviewTask = await findTaskNotificationByEntity(
          'PURCHASE_REQUEST',
          prId,
          'PR_SUBMITTED',
          ['pending', 'in_progress']
        );

        if (reviewTask) {
          const reason = `PR ${prNumber} was ${newStatus.toLowerCase()} by approver`;

          await autoCompleteTask(reviewTask.id, reason);

          // Log for audit trail
          await logAutoCompletionEvent({
            taskId: reviewTask.id,
            entityType: 'PURCHASE_REQUEST',
            entityId: prId,
            triggerEvent: `PR_${newStatus}`,
            completedBy: 'system',
          });

          logger.info('[onPurchaseRequestStatusChange] Auto-completed PR review task', {
            prId,
            prNumber,
            taskId: reviewTask.id,
            newStatus,
          });
        } else {
          logger.info('[onPurchaseRequestStatusChange] No pending review task found', {
            prId,
            prNumber,
          });
        }
      } catch (error) {
        logger.error('[onPurchaseRequestStatusChange] Error auto-completing task', {
          prId,
          error,
        });
        // Don't throw - we don't want to fail the main operation
      }
    }
  }
);
