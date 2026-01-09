/**
 * Vendor Bill Auto-Completion Cloud Function
 *
 * Automatically completes BILL_SUBMITTED tasks when vendor bills
 * are approved or rejected.
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { findTaskNotificationByEntity, autoCompleteTask, logAutoCompletionEvent } from './helpers';

/**
 * Triggered when a Transaction document is updated
 * Auto-completes the approval task when vendor bill status changes to APPROVED or REJECTED
 */
export const onVendorBillStatusChange = onDocumentUpdated(
  {
    document: 'transactions/{transactionId}',
    region: 'us-central1',
  },
  async (event) => {
    const transactionId = event.params.transactionId;

    // Get before and after data
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.warn('[onVendorBillStatusChange] Missing before/after data', { transactionId });
      return;
    }

    // Only process VENDOR_BILL transactions
    if (after.type !== 'VENDOR_BILL') {
      return;
    }

    // Check if status actually changed
    if (before.status === after.status) {
      return;
    }

    const newStatus = after.status;
    const oldStatus = before.status;
    const billNumber = after.vendorInvoiceNumber || after.transactionNumber || transactionId;

    logger.info('[onVendorBillStatusChange] Vendor bill status changed', {
      transactionId,
      billNumber,
      oldStatus,
      newStatus,
    });

    // Auto-complete approval task when bill is approved or rejected
    if (
      oldStatus === 'PENDING_APPROVAL' &&
      (newStatus === 'APPROVED' || newStatus === 'REJECTED')
    ) {
      try {
        // Find the approval task for this bill
        const approvalTask = await findTaskNotificationByEntity(
          'BILL',
          transactionId,
          'BILL_SUBMITTED',
          ['pending', 'in_progress']
        );

        if (approvalTask) {
          const reason = `Bill ${billNumber} was ${newStatus.toLowerCase()}`;

          await autoCompleteTask(approvalTask.id, reason);

          await logAutoCompletionEvent({
            taskId: approvalTask.id,
            entityType: 'BILL',
            entityId: transactionId,
            triggerEvent: `BILL_${newStatus}`,
            completedBy: 'system',
          });

          logger.info('[onVendorBillStatusChange] Auto-completed bill approval task', {
            transactionId,
            billNumber,
            taskId: approvalTask.id,
            newStatus,
          });
        } else {
          logger.info('[onVendorBillStatusChange] No pending approval task found', {
            transactionId,
            billNumber,
          });
        }
      } catch (error) {
        logger.error('[onVendorBillStatusChange] Error auto-completing approval task', {
          transactionId,
          error,
        });
      }
    }
  }
);
