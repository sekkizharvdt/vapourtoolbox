/**
 * Email Notification Triggers
 *
 * Firestore document triggers that detect status changes and send
 * email notifications to configured recipients via Gmail SMTP.
 */

import { onDocumentUpdated, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { sendNotificationEmail, gmailAppPassword } from './sendEmail';
import { APP_URL } from './config';

/**
 * Format a Firestore Timestamp (or raw value) to a readable date string.
 * Cloud Functions receive Timestamps as admin SDK Timestamp objects.
 */
function formatDate(value: unknown): string {
  if (!value) return '-';
  if (value instanceof Timestamp) {
    return value.toDate().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  }
  if (value instanceof Date) {
    return value.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  }
  // Fallback: try to parse as string/number
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
    }
  }
  return String(value);
}

const FUNCTION_CONFIG = {
  region: 'us-central1' as const,
  memory: '256MiB' as const,
  secrets: [gmailAppPassword],
};

/**
 * Purchase Request submitted for approval
 */
export const onPRSubmittedNotify = onDocumentUpdated(
  { document: 'purchaseRequests/{prId}', ...FUNCTION_CONFIG },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    if (after.status === 'SUBMITTED' || after.status === 'PENDING_APPROVAL') {
      // Resolve approver email so the email goes to the designated approver
      let approverEmail: string | undefined;
      if (after.approverId) {
        try {
          const approverDoc = await admin.firestore().doc(`users/${after.approverId}`).get();
          if (approverDoc.exists) {
            approverEmail = approverDoc.data()?.email;
          }
        } catch (err) {
          logger.warn('Failed to resolve approver email — falling back to default recipients', {
            approverId: after.approverId,
            error: err,
          });
        }
      }

      logger.info(`PR ${after.number} submitted — sending notification`, {
        approverEmail: approverEmail || 'default recipients',
      });
      await sendNotificationEmail({
        eventId: 'pr_submitted',
        subject: `PR Submitted: ${after.number}`,
        templateData: {
          title: 'Purchase Request Submitted',
          message: `A purchase request has been submitted for approval.`,
          details: [
            { label: 'PR Number', value: after.number || event.params.prId },
            {
              label: 'Requested By',
              value: after.submittedByName || after.createdByName || 'Unknown',
            },
            { label: 'Approver', value: after.approverName || '-' },
            { label: 'Project', value: after.projectName || '-' },
            { label: 'Description', value: after.description || '-' },
          ],
          linkUrl: `${APP_URL}/procurement/purchase-requests/${event.params.prId}`,
        },
        idempotencyKey: event.id,
        // Send directly to the approver — same person who gets the Flow task
        directRecipientEmails: approverEmail ? [approverEmail] : undefined,
      });
    }

    if (after.status === 'APPROVED' && before.status !== 'APPROVED') {
      logger.info(`PR ${after.number} approved — sending notification`);
      await sendNotificationEmail({
        eventId: 'pr_approved',
        subject: `PR Approved: ${after.number}`,
        templateData: {
          title: 'Purchase Request Approved',
          message: `A purchase request has been approved and is ready for procurement action.`,
          details: [
            { label: 'PR Number', value: after.number || event.params.prId },
            { label: 'Title', value: after.title || '-' },
            {
              label: 'Requested By',
              value: after.submittedByName || after.createdByName || 'Unknown',
            },
            { label: 'Approved By', value: after.approvedByName || '-' },
            { label: 'Project', value: after.projectName || '-' },
          ],
          linkUrl: `${APP_URL}/procurement/purchase-requests/${event.params.prId}`,
        },
        idempotencyKey: event.id,
      });
    }
  }
);

/**
 * Purchase Order approved or issued
 */
export const onPOStatusNotify = onDocumentUpdated(
  { document: 'purchaseOrders/{poId}', ...FUNCTION_CONFIG },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    if (after.status === 'APPROVED') {
      logger.info(`PO ${after.number} approved — sending notification`);
      await sendNotificationEmail({
        eventId: 'po_approved',
        subject: `PO Approved: ${after.number}`,
        templateData: {
          title: 'Purchase Order Approved',
          message: `A purchase order has been approved.`,
          details: [
            { label: 'PO Number', value: after.number || event.params.poId },
            { label: 'Vendor', value: after.entityName || '-' },
            { label: 'Project', value: after.projectName || '-' },
          ],
          linkUrl: `${APP_URL}/procurement/pos/${event.params.poId}`,
        },
        idempotencyKey: event.id,
      });
    }

    if (after.status === 'ISSUED') {
      logger.info(`PO ${after.number} issued — sending notification`);
      await sendNotificationEmail({
        eventId: 'po_issued',
        subject: `PO Issued: ${after.number}`,
        templateData: {
          title: 'Purchase Order Issued to Vendor',
          message: `A purchase order has been issued to the vendor.`,
          details: [
            { label: 'PO Number', value: after.number || event.params.poId },
            { label: 'Vendor', value: after.entityName || '-' },
            { label: 'Project', value: after.projectName || '-' },
          ],
          linkUrl: `${APP_URL}/procurement/pos/${event.params.poId}`,
        },
        idempotencyKey: event.id,
      });
    }

    if (after.status === 'REJECTED' && before.status !== 'REJECTED') {
      logger.info(`PO ${after.number} rejected — sending notification`);
      await sendNotificationEmail({
        eventId: 'po_rejected',
        subject: `PO Rejected: ${after.number}`,
        templateData: {
          title: 'Purchase Order Rejected',
          message: `A purchase order has been rejected and requires revision.`,
          details: [
            { label: 'PO Number', value: after.number || event.params.poId },
            { label: 'Vendor', value: after.entityName || '-' },
            { label: 'Rejected By', value: after.rejectedByName || '-' },
            { label: 'Reason', value: after.rejectionReason || '-' },
          ],
          linkUrl: `${APP_URL}/procurement/pos/${event.params.poId}`,
        },
        idempotencyKey: event.id,
      });
    }
  }
);

/**
 * RFQ completed (offer selected, ready for PO creation)
 */
export const onRFQCompletedNotify = onDocumentUpdated(
  { document: 'rfqs/{rfqId}', ...FUNCTION_CONFIG },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    if (after.status === 'COMPLETED' && before.status !== 'COMPLETED') {
      logger.info(`RFQ ${after.number} completed — sending notification`);
      await sendNotificationEmail({
        eventId: 'rfq_completed',
        subject: `RFQ Completed: ${after.number}`,
        templateData: {
          title: 'RFQ Evaluation Complete — Ready for PO',
          message: `An RFQ has been evaluated and an offer has been selected. A purchase order can now be created.`,
          details: [
            { label: 'RFQ Number', value: after.number || event.params.rfqId },
            { label: 'Title', value: after.title || '-' },
            { label: 'Project', value: (after.projectNames || []).join(', ') || '-' },
            { label: 'Vendors Invited', value: String((after.vendorIds || []).length) },
          ],
          linkUrl: `${APP_URL}/procurement/rfqs/${event.params.rfqId}`,
        },
        idempotencyKey: event.id,
      });
    }
  }
);

/**
 * Service Order status changes (milestones)
 */
export const onServiceOrderNotify = onDocumentUpdated(
  { document: 'serviceOrders/{soId}', ...FUNCTION_CONFIG },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    if (after.status === 'RESULTS_RECEIVED') {
      logger.info(`Service order ${after.number} results received — sending notification`);
      await sendNotificationEmail({
        eventId: 'service_order_results',
        subject: `Service Results Received: ${after.number}`,
        templateData: {
          title: 'Service Order — Results Received',
          message: `Results have been received for a service order and are ready for review.`,
          details: [
            { label: 'SO Number', value: after.number || event.params.soId },
            { label: 'Service', value: after.serviceName || '-' },
            { label: 'Vendor', value: after.vendorName || '-' },
            { label: 'Project', value: after.projectName || '-' },
          ],
          linkUrl: `${APP_URL}/procurement/service-orders/${event.params.soId}`,
        },
        idempotencyKey: event.id,
      });
    }

    if (after.status === 'COMPLETED' && before.status !== 'COMPLETED') {
      logger.info(`Service order ${after.number} completed — sending notification`);
      await sendNotificationEmail({
        eventId: 'service_order_completed',
        subject: `Service Completed: ${after.number}`,
        templateData: {
          title: 'Service Order Completed',
          message: `A service order has been completed.`,
          details: [
            { label: 'SO Number', value: after.number || event.params.soId },
            { label: 'Service', value: after.serviceName || '-' },
            { label: 'Vendor', value: after.vendorName || '-' },
            { label: 'Result', value: after.resultSummary || '-' },
          ],
          linkUrl: `${APP_URL}/procurement/service-orders/${event.params.soId}`,
        },
        idempotencyKey: event.id,
      });
    }
  }
);

/**
 * Accounting transaction events: invoice created, payment approved
 */
export const onAccountingNotify = onDocumentUpdated(
  { document: 'transactions/{txId}', ...FUNCTION_CONFIG },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Invoice created (status changes from DRAFT to POSTED/PENDING_APPROVAL)
    if (
      after.type === 'CUSTOMER_INVOICE' &&
      before.status === 'DRAFT' &&
      (after.status === 'POSTED' || after.status === 'PENDING_APPROVAL')
    ) {
      logger.info(`Invoice ${after.transactionNumber} created — sending notification`);
      await sendNotificationEmail({
        eventId: 'invoice_created',
        subject: `Invoice Created: ${after.transactionNumber}`,
        templateData: {
          title: 'New Customer Invoice',
          message: `A new customer invoice has been created.`,
          details: [
            { label: 'Invoice #', value: after.transactionNumber || event.params.txId },
            { label: 'Customer', value: after.entityName || '-' },
            { label: 'Amount', value: `₹${(after.totalAmount ?? 0).toLocaleString('en-IN')}` },
          ],
          linkUrl: `${APP_URL}/accounting/invoices`,
        },
        idempotencyKey: event.id,
      });
    }

    // Payment approved
    if (
      (after.type === 'CUSTOMER_PAYMENT' || after.type === 'VENDOR_PAYMENT') &&
      before.status !== 'APPROVED' &&
      after.status === 'APPROVED'
    ) {
      logger.info(`Payment ${after.transactionNumber} approved — sending notification`);
      await sendNotificationEmail({
        eventId: 'payment_approved',
        subject: `Payment Approved: ${after.transactionNumber}`,
        templateData: {
          title: 'Payment Approved',
          message: `A payment has been approved for processing.`,
          details: [
            { label: 'Payment #', value: after.transactionNumber || event.params.txId },
            { label: 'Entity', value: after.entityName || '-' },
            { label: 'Amount', value: `₹${(after.totalAmount ?? 0).toLocaleString('en-IN')}` },
          ],
          linkUrl: `${APP_URL}/accounting/payments`,
        },
        idempotencyKey: event.id,
      });
    }

    // Vendor bill created (DRAFT → POSTED/PENDING_APPROVAL)
    if (
      after.type === 'VENDOR_BILL' &&
      before.status === 'DRAFT' &&
      (after.status === 'POSTED' || after.status === 'PENDING_APPROVAL')
    ) {
      logger.info(`Bill ${after.transactionNumber} created — sending notification`);
      await sendNotificationEmail({
        eventId: 'bill_created',
        subject: `Bill Created: ${after.transactionNumber}`,
        templateData: {
          title: 'New Vendor Bill',
          message: `A new vendor bill has been created.`,
          details: [
            { label: 'Bill #', value: after.transactionNumber || event.params.txId },
            { label: 'Vendor', value: after.entityName || '-' },
            { label: 'Amount', value: `₹${(after.totalAmount ?? 0).toLocaleString('en-IN')}` },
          ],
          linkUrl: `${APP_URL}/accounting/bills`,
        },
        idempotencyKey: event.id,
      });
    }

    // Journal entry submitted for approval
    if (
      after.type === 'JOURNAL_ENTRY' &&
      before.status === 'DRAFT' &&
      after.status === 'PENDING_APPROVAL'
    ) {
      logger.info(`JE ${after.transactionNumber} submitted — sending notification`);
      await sendNotificationEmail({
        eventId: 'journal_entry_submitted',
        subject: `Journal Entry Submitted: ${after.transactionNumber}`,
        templateData: {
          title: 'Journal Entry Submitted for Approval',
          message: `A journal entry has been submitted for approval.`,
          details: [
            { label: 'JE #', value: after.transactionNumber || event.params.txId },
            { label: 'Description', value: after.description || '-' },
            { label: 'Amount', value: `₹${(after.totalAmount ?? 0).toLocaleString('en-IN')}` },
          ],
          linkUrl: `${APP_URL}/accounting/journal-entries`,
        },
        idempotencyKey: event.id,
      });
    }
  }
);

/**
 * Leave request submitted or approved/rejected
 */
export const onLeaveNotify = onDocumentUpdated(
  { document: 'hrLeaveRequests/{leaveId}', ...FUNCTION_CONFIG },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    if (after.status === 'PENDING_APPROVAL') {
      logger.info(`Leave request submitted by ${after.userName} — sending notification`);
      await sendNotificationEmail({
        eventId: 'leave_submitted',
        subject: `Leave Request: ${after.userName || 'Employee'}`,
        templateData: {
          title: 'Leave Request Submitted',
          message: `A leave request has been submitted for approval.`,
          details: [
            { label: 'Employee', value: after.userName || '-' },
            { label: 'Type', value: after.leaveTypeName || after.leaveType || '-' },
            { label: 'From', value: formatDate(after.startDate) },
            { label: 'To', value: formatDate(after.endDate) },
            { label: 'Days', value: String(after.numberOfDays || '-') },
            { label: 'Reason', value: after.reason || '-' },
          ],
          linkUrl: `${APP_URL}/hr/leaves`,
        },
        idempotencyKey: event.id,
      });
    }

    if (after.status === 'PARTIALLY_APPROVED' && before.status === 'PENDING_APPROVAL') {
      // First approval done — notify the remaining approver(s)
      const approvalFlow = after.approvalFlow;
      const approvedEmails = (approvalFlow?.approvals || []).map(
        (a: { approverEmail?: string }) => a.approverEmail
      );
      const remainingApproverEmails = (approvalFlow?.requiredApprovers || []).filter(
        (email: string) => !approvedEmails.includes(email)
      );

      if (remainingApproverEmails.length > 0) {
        logger.info(
          `Leave request partially approved for ${after.userName} — notifying next approver(s)`
        );
        await sendNotificationEmail({
          eventId: 'leave_submitted',
          subject: `Leave Pending Your Approval: ${after.userName || 'Employee'}`,
          templateData: {
            title: 'Leave Request Awaiting Your Approval',
            message: `A leave request has been partially approved and needs your approval.`,
            details: [
              { label: 'Employee', value: after.userName || '-' },
              { label: 'Type', value: after.leaveTypeName || after.leaveType || '-' },
              { label: 'From', value: formatDate(after.startDate) },
              { label: 'To', value: formatDate(after.endDate) },
              { label: 'Days', value: String(after.numberOfDays || '-') },
              {
                label: 'Progress',
                value: `${approvalFlow?.approvals?.length || 1} of ${approvalFlow?.requiredApprovalCount || 2} approvals`,
              },
            ],
            linkUrl: `${APP_URL}/hr/leaves`,
          },
          directRecipientEmails: remainingApproverEmails,
          // Use a distinct suffix because this branch shares the `leave_submitted` eventId
          // with the main pending-approval branch (mutually exclusive on after.status, but
          // adding a suffix keeps the lock unambiguous).
          idempotencyKey: `${event.id}_partial`,
        });
      }
    }

    if (after.status === 'APPROVED' || after.status === 'REJECTED') {
      const action = after.status === 'APPROVED' ? 'Approved' : 'Rejected';
      logger.info(`Leave request ${action} for ${after.userName} — sending notification`);
      await sendNotificationEmail({
        eventId: 'leave_approved',
        subject: `Leave ${action}: ${after.userName || 'Employee'}`,
        templateData: {
          title: `Leave Request ${action}`,
          message: `Your leave request has been ${action.toLowerCase()}.`,
          details: [
            { label: 'Employee', value: after.userName || '-' },
            { label: 'Type', value: after.leaveTypeName || after.leaveType || '-' },
            { label: 'Status', value: action },
            { label: 'From', value: formatDate(after.startDate) },
            { label: 'To', value: formatDate(after.endDate) },
          ],
          linkUrl: `${APP_URL}/hr/leaves`,
        },
        idempotencyKey: event.id,
        // Configured recipients (per-event override or default) plus the employee themselves.
        // If no custom recipients are configured for `leave_approved`, the global Default
        // Recipients list will receive this — pick a custom list on /admin/email to scope it.
        additionalRecipientEmails: after.userEmail ? [after.userEmail] : undefined,
      });
    }
  }
);

/**
 * New user registered (created with pending status)
 */
export const onNewUserNotify = onDocumentCreated(
  { document: 'users/{userId}', ...FUNCTION_CONFIG },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    // Only notify for new pending users
    if (data.status !== 'pending') return;

    logger.info(`New user registered: ${data.email} — sending notification`);
    await sendNotificationEmail({
      eventId: 'new_user',
      subject: `New User: ${data.displayName || data.email}`,
      templateData: {
        title: 'New User Registered',
        message: `A new user has signed up and needs approval.`,
        details: [
          { label: 'Name', value: data.displayName || '-' },
          { label: 'Email', value: data.email || '-' },
        ],
        linkUrl: `${APP_URL}/admin/users`,
      },
      idempotencyKey: event.id,
    });
  }
);

/**
 * Payment batch submitted, approved, or completed
 */
export const onPaymentBatchNotify = onDocumentUpdated(
  { document: 'paymentBatches/{batchId}', ...FUNCTION_CONFIG },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    if (after.status === 'PENDING_APPROVAL') {
      logger.info(`Payment batch ${after.batchNumber} submitted — sending notification`);
      await sendNotificationEmail({
        eventId: 'payment_batch_submitted',
        subject: `Payment Batch Submitted: ${after.batchNumber}`,
        templateData: {
          title: 'Payment Batch Submitted for Approval',
          message: `A payment batch has been submitted for approval.`,
          details: [
            { label: 'Batch #', value: after.batchNumber || event.params.batchId },
            {
              label: 'Payments',
              value: `₹${(after.totalPaymentAmount || 0).toLocaleString('en-IN')}`,
            },
            {
              label: 'Receipts',
              value: `₹${(after.totalReceiptAmount || 0).toLocaleString('en-IN')}`,
            },
            { label: 'Bank Account', value: after.bankAccountName || '-' },
          ],
          linkUrl: `${APP_URL}/accounting/payment-batches/${event.params.batchId}`,
        },
        idempotencyKey: event.id,
      });
    }

    if (after.status === 'APPROVED') {
      logger.info(`Payment batch ${after.batchNumber} approved — sending notification`);
      await sendNotificationEmail({
        eventId: 'payment_batch_approved',
        subject: `Payment Batch Approved: ${after.batchNumber}`,
        templateData: {
          title: 'Payment Batch Approved',
          message: `A payment batch has been approved and is ready for execution.`,
          details: [
            { label: 'Batch #', value: after.batchNumber || event.params.batchId },
            {
              label: 'Payments',
              value: `₹${(after.totalPaymentAmount || 0).toLocaleString('en-IN')}`,
            },
            { label: 'Bank Account', value: after.bankAccountName || '-' },
          ],
          linkUrl: `${APP_URL}/accounting/payment-batches/${event.params.batchId}`,
        },
        idempotencyKey: event.id,
      });
    }

    if (after.status === 'COMPLETED') {
      logger.info(`Payment batch ${after.batchNumber} completed — sending notification`);
      await sendNotificationEmail({
        eventId: 'payment_batch_completed',
        subject: `Payment Batch Completed: ${after.batchNumber}`,
        templateData: {
          title: 'Payment Batch Completed',
          message: `All payments in the batch have been processed.`,
          details: [
            { label: 'Batch #', value: after.batchNumber || event.params.batchId },
            {
              label: 'Total Paid',
              value: `₹${(after.totalPaymentAmount || 0).toLocaleString('en-IN')}`,
            },
            { label: 'Bank Account', value: after.bankAccountName || '-' },
          ],
          linkUrl: `${APP_URL}/accounting/payment-batches/${event.params.batchId}`,
        },
        idempotencyKey: event.id,
      });
    }
  }
);

/**
 * On-duty request submitted or approved/rejected
 */
export const onOnDutyNotify = onDocumentUpdated(
  { document: 'onDutyRecords/{recordId}', ...FUNCTION_CONFIG },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    if (after.status === 'PENDING_APPROVAL') {
      logger.info(`On-duty ${after.requestNumber} submitted — sending notification`);
      await sendNotificationEmail({
        eventId: 'on_duty_submitted',
        subject: `On-Duty Request: ${after.userName || 'Employee'}`,
        templateData: {
          title: 'On-Duty Request Submitted',
          message: `An on-duty request has been submitted for approval.`,
          details: [
            { label: 'Request #', value: after.requestNumber || event.params.recordId },
            { label: 'Employee', value: after.userName || '-' },
            { label: 'Holiday', value: after.holidayName || '-' },
            { label: 'Reason', value: after.reason || '-' },
          ],
          linkUrl: `${APP_URL}/hr/on-duty`,
        },
        idempotencyKey: event.id,
      });
    }

    if (after.status === 'APPROVED' || after.status === 'REJECTED') {
      const action = after.status === 'APPROVED' ? 'Approved' : 'Rejected';
      logger.info(`On-duty ${after.requestNumber} ${action} — sending notification`);
      await sendNotificationEmail({
        eventId: 'on_duty_decided',
        subject: `On-Duty ${action}: ${after.userName || 'Employee'}`,
        templateData: {
          title: `On-Duty Request ${action}`,
          message: `Your on-duty request has been ${action.toLowerCase()}.`,
          details: [
            { label: 'Request #', value: after.requestNumber || event.params.recordId },
            { label: 'Employee', value: after.userName || '-' },
            { label: 'Holiday', value: after.holidayName || '-' },
            { label: 'Status', value: action },
          ],
          linkUrl: `${APP_URL}/hr/on-duty`,
        },
        idempotencyKey: event.id,
        // Notify the employee, not the admin who approved it
        directRecipientEmails: after.userEmail ? [after.userEmail] : undefined,
      });
    }
  }
);

/**
 * Travel expense submitted, approved/rejected, or reimbursed
 */
export const onTravelExpenseNotify = onDocumentUpdated(
  { document: 'hrTravelExpenses/{expenseId}', ...FUNCTION_CONFIG },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    if (after.status === 'SUBMITTED') {
      logger.info(`Travel expense ${after.reportNumber} submitted — sending notification`);
      await sendNotificationEmail({
        eventId: 'travel_expense_submitted',
        subject: `Travel Expense Submitted: ${after.reportNumber}`,
        templateData: {
          title: 'Travel Expense Report Submitted',
          message: `A travel expense report has been submitted for review.`,
          details: [
            { label: 'Report #', value: after.reportNumber || event.params.expenseId },
            { label: 'Employee', value: after.employeeName || '-' },
            { label: 'Purpose', value: after.tripPurpose || '-' },
            { label: 'Amount', value: `₹${(after.totalAmount ?? 0).toLocaleString('en-IN')}` },
          ],
          linkUrl: `${APP_URL}/hr/travel-expenses`,
        },
        idempotencyKey: event.id,
      });
    }

    if (after.status === 'APPROVED' || after.status === 'REJECTED') {
      const action = after.status === 'APPROVED' ? 'Approved' : 'Rejected';
      logger.info(`Travel expense ${after.reportNumber} ${action} — sending notification`);
      await sendNotificationEmail({
        eventId: 'travel_expense_decided',
        subject: `Travel Expense ${action}: ${after.reportNumber}`,
        templateData: {
          title: `Travel Expense ${action}`,
          message: `Your travel expense report has been ${action.toLowerCase()}.`,
          details: [
            { label: 'Report #', value: after.reportNumber || event.params.expenseId },
            { label: 'Employee', value: after.employeeName || '-' },
            { label: 'Amount', value: `₹${(after.totalAmount ?? 0).toLocaleString('en-IN')}` },
            { label: 'Status', value: action },
          ],
          linkUrl: `${APP_URL}/hr/travel-expenses`,
        },
        idempotencyKey: event.id,
        // Notify the employee, not the admin who approved it
        directRecipientEmails: after.employeeEmail ? [after.employeeEmail] : undefined,
      });
    }

    if (after.status === 'REIMBURSED') {
      logger.info(`Travel expense ${after.reportNumber} reimbursed — sending notification`);
      await sendNotificationEmail({
        eventId: 'travel_expense_reimbursed',
        subject: `Travel Expense Reimbursed: ${after.reportNumber}`,
        templateData: {
          title: 'Travel Expense Reimbursed',
          message: `Your travel expense has been reimbursed.`,
          details: [
            { label: 'Report #', value: after.reportNumber || event.params.expenseId },
            { label: 'Employee', value: after.employeeName || '-' },
            { label: 'Amount', value: `₹${(after.totalAmount ?? 0).toLocaleString('en-IN')}` },
          ],
          linkUrl: `${APP_URL}/hr/travel-expenses`,
        },
        idempotencyKey: event.id,
        // Notify the employee
        directRecipientEmails: after.employeeEmail ? [after.employeeEmail] : undefined,
      });
    }
  }
);

/**
 * Proposal submitted for approval, approved, sent to client, or won/lost
 */
export const onProposalNotify = onDocumentUpdated(
  { document: 'proposals/{proposalId}', ...FUNCTION_CONFIG },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    if (after.status === 'PENDING_APPROVAL') {
      logger.info(`Proposal ${after.proposalNumber} submitted for approval — sending notification`);
      await sendNotificationEmail({
        eventId: 'proposal_submitted_for_approval',
        subject: `Proposal Submitted: ${after.proposalNumber}`,
        templateData: {
          title: 'Proposal Submitted for Approval',
          message: `A proposal has been submitted for internal approval.`,
          details: [
            { label: 'Proposal #', value: after.proposalNumber || event.params.proposalId },
            { label: 'Client', value: after.clientName || '-' },
            { label: 'Title', value: after.title || '-' },
          ],
          linkUrl: `${APP_URL}/estimation/proposals/${event.params.proposalId}`,
        },
        idempotencyKey: event.id,
      });
    }

    if (after.status === 'APPROVED' && before.status === 'PENDING_APPROVAL') {
      logger.info(`Proposal ${after.proposalNumber} approved — sending notification`);
      await sendNotificationEmail({
        eventId: 'proposal_approved',
        subject: `Proposal Approved: ${after.proposalNumber}`,
        templateData: {
          title: 'Proposal Approved',
          message: `A proposal has been internally approved and can now be sent to the client.`,
          details: [
            { label: 'Proposal #', value: after.proposalNumber || event.params.proposalId },
            { label: 'Client', value: after.clientName || '-' },
            { label: 'Title', value: after.title || '-' },
          ],
          linkUrl: `${APP_URL}/estimation/proposals/${event.params.proposalId}`,
        },
        idempotencyKey: event.id,
      });
    }

    if (after.status === 'SUBMITTED') {
      logger.info(`Proposal ${after.proposalNumber} sent to client — sending notification`);
      await sendNotificationEmail({
        eventId: 'proposal_sent_to_client',
        subject: `Proposal Sent: ${after.proposalNumber}`,
        templateData: {
          title: 'Proposal Sent to Client',
          message: `A proposal has been submitted to the client.`,
          details: [
            { label: 'Proposal #', value: after.proposalNumber || event.params.proposalId },
            { label: 'Client', value: after.clientName || '-' },
            { label: 'Title', value: after.title || '-' },
          ],
          linkUrl: `${APP_URL}/estimation/proposals/${event.params.proposalId}`,
        },
        idempotencyKey: event.id,
      });
    }

    if (after.status === 'ACCEPTED' || after.status === 'REJECTED') {
      const outcome = after.status === 'ACCEPTED' ? 'Accepted' : 'Rejected';
      logger.info(`Proposal ${after.proposalNumber} ${outcome} — sending notification`);
      await sendNotificationEmail({
        eventId: 'proposal_outcome',
        subject: `Proposal ${outcome}: ${after.proposalNumber}`,
        templateData: {
          title: `Proposal ${outcome} by Client`,
          message: `A proposal has been ${outcome.toLowerCase()} by the client.`,
          details: [
            { label: 'Proposal #', value: after.proposalNumber || event.params.proposalId },
            { label: 'Client', value: after.clientName || '-' },
            { label: 'Outcome', value: outcome },
          ],
          linkUrl: `${APP_URL}/estimation/proposals/${event.params.proposalId}`,
        },
        idempotencyKey: event.id,
      });
    }
  }
);

/**
 * Goods receipt completed
 */
export const onGoodsReceiptNotify = onDocumentUpdated(
  { document: 'goodsReceipts/{grId}', ...FUNCTION_CONFIG },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    if (after.status === 'COMPLETED') {
      logger.info(`GR ${after.number} completed — sending notification`);
      await sendNotificationEmail({
        eventId: 'gr_completed',
        subject: `Goods Receipt Completed: ${after.number}`,
        templateData: {
          title: 'Goods Receipt Completed',
          message: `A goods receipt inspection has been completed.`,
          details: [
            { label: 'GR #', value: after.number || event.params.grId },
            { label: 'PO #', value: after.poNumber || '-' },
            { label: 'Project', value: after.projectName || '-' },
            { label: 'Condition', value: after.overallCondition || '-' },
          ],
          linkUrl: `${APP_URL}/procurement/goods-receipts/${event.params.grId}`,
        },
        idempotencyKey: event.id,
      });
    }
  }
);

/**
 * New feedback submitted (bug report, feature request, general)
 */
export const onFeedbackNotify = onDocumentCreated(
  { document: 'feedback/{feedbackId}', ...FUNCTION_CONFIG },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const typeLabels: Record<string, string> = {
      bug: 'Bug Report',
      feature: 'Feature Request',
      general: 'General Feedback',
    };

    const typeLabel = typeLabels[data.type] || 'Feedback';
    logger.info(`New ${typeLabel}: ${data.title} — sending notification`);
    await sendNotificationEmail({
      eventId: 'feedback_submitted',
      subject: `New ${typeLabel}: ${data.title}`,
      templateData: {
        title: `New ${typeLabel}`,
        message: `A new ${typeLabel.toLowerCase()} has been submitted.`,
        details: [
          { label: 'Type', value: typeLabel },
          { label: 'Title', value: data.title || '-' },
          { label: 'Submitted By', value: data.userName || data.userEmail || '-' },
          { label: 'Description', value: (data.description || '-').substring(0, 200) },
        ],
        linkUrl: `${APP_URL}/feedback/${event.params.feedbackId}`,
      },
      idempotencyKey: event.id,
    });
  }
);

/**
 * Enquiry assigned or outcome decided (won/lost)
 */
export const onEnquiryNotify = onDocumentUpdated(
  { document: 'enquiries/{enquiryId}', ...FUNCTION_CONFIG },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Enquiry assigned (moved to UNDER_REVIEW with assignedToUserName change)
    if (
      after.status === 'UNDER_REVIEW' &&
      before.status !== after.status &&
      after.assignedToUserName
    ) {
      logger.info(`Enquiry ${after.enquiryNumber} assigned — sending notification`);
      await sendNotificationEmail({
        eventId: 'enquiry_assigned',
        subject: `Enquiry Assigned: ${after.enquiryNumber}`,
        templateData: {
          title: 'Enquiry Assigned',
          message: `An enquiry has been assigned for review.`,
          details: [
            { label: 'Enquiry #', value: after.enquiryNumber || event.params.enquiryId },
            { label: 'Client', value: after.clientName || '-' },
            { label: 'Title', value: after.title || '-' },
            { label: 'Assigned To', value: after.assignedToUserName || '-' },
          ],
          linkUrl: `${APP_URL}/estimation/enquiries/${event.params.enquiryId}`,
        },
        idempotencyKey: event.id,
      });
    }

    // Enquiry won or lost
    if ((after.status === 'WON' || after.status === 'LOST') && before.status !== after.status) {
      const outcome = after.status === 'WON' ? 'Won' : 'Lost';
      logger.info(`Enquiry ${after.enquiryNumber} ${outcome} — sending notification`);
      await sendNotificationEmail({
        eventId: 'enquiry_won_lost',
        subject: `Enquiry ${outcome}: ${after.enquiryNumber}`,
        templateData: {
          title: `Enquiry ${outcome}`,
          message: `An enquiry has been marked as ${outcome.toLowerCase()}.`,
          details: [
            { label: 'Enquiry #', value: after.enquiryNumber || event.params.enquiryId },
            { label: 'Client', value: after.clientName || '-' },
            { label: 'Title', value: after.title || '-' },
            { label: 'Outcome', value: outcome },
          ],
          linkUrl: `${APP_URL}/estimation/enquiries/${event.params.enquiryId}`,
        },
        idempotencyKey: event.id,
      });
    }
  }
);
