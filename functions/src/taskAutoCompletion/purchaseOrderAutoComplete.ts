/**
 * Purchase Order Auto-Completion Cloud Function
 *
 * Automatically completes PO_PENDING_APPROVAL tasks when the Purchase Order
 * is approved or rejected.
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { findTaskNotificationByEntity, autoCompleteTask, logAutoCompletionEvent } from './helpers';

/**
 * Triggered when a Purchase Order document is updated
 * Auto-completes the approval task when PO status changes to APPROVED or REJECTED
 */
export const onPurchaseOrderStatusChange = onDocumentUpdated(
  {
    document: 'purchaseOrders/{poId}',
    region: 'us-central1',
  },
  async (event) => {
    const poId = event.params.poId;

    // Get before and after data
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.warn('[onPurchaseOrderStatusChange] Missing before/after data', { poId });
      return;
    }

    // Check if status actually changed
    if (before.status === after.status) {
      return;
    }

    const newStatus = after.status;
    const oldStatus = before.status;
    const poNumber = after.number || poId;

    logger.info('[onPurchaseOrderStatusChange] PO status changed', {
      poId,
      poNumber,
      oldStatus,
      newStatus,
    });

    // Auto-complete task when PO is approved or rejected from PENDING_APPROVAL status
    if (
      oldStatus === 'PENDING_APPROVAL' &&
      (newStatus === 'APPROVED' || newStatus === 'REJECTED')
    ) {
      try {
        // Find the approval task (PO_PENDING_APPROVAL category, pending or in_progress)
        const approvalTask = await findTaskNotificationByEntity(
          'PURCHASE_ORDER',
          poId,
          'PO_PENDING_APPROVAL',
          ['pending', 'in_progress']
        );

        if (approvalTask) {
          const reason = `PO ${poNumber} was ${newStatus.toLowerCase()} by approver`;

          await autoCompleteTask(approvalTask.id, reason);

          // Log for audit trail
          await logAutoCompletionEvent({
            taskId: approvalTask.id,
            entityType: 'PURCHASE_ORDER',
            entityId: poId,
            triggerEvent: `PO_${newStatus}`,
            completedBy: 'system',
          });

          logger.info('[onPurchaseOrderStatusChange] Auto-completed PO approval task', {
            poId,
            poNumber,
            taskId: approvalTask.id,
            newStatus,
          });
        } else {
          logger.info('[onPurchaseOrderStatusChange] No pending approval task found', {
            poId,
            poNumber,
          });
        }
      } catch (error) {
        logger.error('[onPurchaseOrderStatusChange] Error auto-completing task', {
          poId,
          error,
        });
        // Don't throw - we don't want to fail the main operation
      }
    }
  }
);
