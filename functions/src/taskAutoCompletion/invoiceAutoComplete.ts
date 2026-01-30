/**
 * Invoice Auto-Completion Cloud Function
 *
 * Automatically completes INVOICE_APPROVAL_REQUIRED tasks when invoices
 * are approved, and PAYMENT_REQUESTED tasks when payments are completed.
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { findTaskNotificationByEntity, autoCompleteTask, logAutoCompletionEvent } from './helpers';

/**
 * Triggered when an Invoice document is updated
 * Auto-completes the approval task when invoice status changes to APPROVED or REJECTED
 */
export const onInvoiceStatusChange = onDocumentUpdated(
  {
    document: 'invoices/{invoiceId}',
    region: 'us-central1',
  },
  async (event) => {
    const invoiceId = event.params.invoiceId;

    // Get before and after data
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.warn('[onInvoiceStatusChange] Missing before/after data', { invoiceId });
      return;
    }

    // Check if status actually changed
    if (before.status === after.status) {
      return;
    }

    const newStatus = after.status;
    const oldStatus = before.status;
    const invoiceNumber = after.invoiceNumber || invoiceId;

    logger.info('[onInvoiceStatusChange] Invoice status changed', {
      invoiceId,
      invoiceNumber,
      oldStatus,
      newStatus,
    });

    // Auto-complete approval task when invoice is approved or rejected
    if (
      (oldStatus === 'PENDING' || oldStatus === 'PENDING_APPROVAL') &&
      (newStatus === 'APPROVED' || newStatus === 'REJECTED')
    ) {
      try {
        // Find the approval task
        const approvalTask = await findTaskNotificationByEntity(
          'INVOICE',
          invoiceId,
          'INVOICE_APPROVAL_REQUIRED',
          ['pending', 'in_progress']
        );

        if (approvalTask) {
          const reason = `Invoice ${invoiceNumber} was ${newStatus.toLowerCase()}`;

          await autoCompleteTask(approvalTask.id, reason);

          await logAutoCompletionEvent({
            taskId: approvalTask.id,
            entityType: 'INVOICE',
            entityId: invoiceId,
            triggerEvent: `INVOICE_${newStatus}`,
            completedBy: 'system',
          });

          logger.info('[onInvoiceStatusChange] Auto-completed invoice approval task', {
            invoiceId,
            invoiceNumber,
            taskId: approvalTask.id,
            newStatus,
          });
        }
      } catch (error) {
        logger.error('[onInvoiceStatusChange] Error auto-completing approval task', {
          invoiceId,
          error,
        });
      }
    }

    // Auto-complete payment task when invoice is paid
    if (after.paymentStatus === 'PAID') {
      try {
        // Find the payment task
        const paymentTask = await findTaskNotificationByEntity(
          'INVOICE',
          invoiceId,
          'PAYMENT_REQUESTED',
          ['pending', 'in_progress']
        );

        if (paymentTask) {
          const reason = `Payment for invoice ${invoiceNumber} was completed`;

          await autoCompleteTask(paymentTask.id, reason);

          await logAutoCompletionEvent({
            taskId: paymentTask.id,
            entityType: 'INVOICE',
            entityId: invoiceId,
            triggerEvent: 'PAYMENT_COMPLETED',
            completedBy: 'system',
          });

          logger.info('[onInvoiceStatusChange] Auto-completed payment task', {
            invoiceId,
            invoiceNumber,
            taskId: paymentTask.id,
          });
        }
      } catch (error) {
        logger.error('[onInvoiceStatusChange] Error auto-completing payment task', {
          invoiceId,
          error,
        });
      }
    }
  }
);

/**
 * Triggered when a Payment Ledger document is updated
 * Auto-completes payment tasks when payment status becomes COMPLETED
 */
export const onPaymentLedgerStatusChange = onDocumentUpdated(
  {
    document: 'paymentLedger/{paymentId}',
    region: 'us-central1',
  },
  async (event) => {
    const paymentId = event.params.paymentId;

    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.warn('[onPaymentLedgerStatusChange] Missing before/after data', { paymentId });
      return;
    }

    if (before.status === after.status) {
      return;
    }

    const newStatus = after.status;
    const oldStatus = before.status;

    logger.info('[onPaymentLedgerStatusChange] Payment status changed', {
      paymentId,
      oldStatus,
      newStatus,
    });

    // Auto-complete when payment is completed
    if (newStatus === 'COMPLETED') {
      try {
        const paymentTask = await findTaskNotificationByEntity(
          'PAYMENT',
          paymentId,
          'PAYMENT_REQUESTED',
          ['pending', 'in_progress']
        );

        if (paymentTask) {
          const reason = `Payment ${after.paymentNumber || paymentId} was completed`;

          await autoCompleteTask(paymentTask.id, reason);

          await logAutoCompletionEvent({
            taskId: paymentTask.id,
            entityType: 'PAYMENT',
            entityId: paymentId,
            triggerEvent: 'PAYMENT_COMPLETED',
            completedBy: 'system',
          });

          logger.info('[onPaymentLedgerStatusChange] Auto-completed payment task', {
            paymentId,
            taskId: paymentTask.id,
          });
        }
      } catch (error) {
        logger.error('[onPaymentLedgerStatusChange] Error auto-completing task', {
          paymentId,
          error,
        });
      }
    }
  }
);
