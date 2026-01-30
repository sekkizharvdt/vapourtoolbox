/**
 * Email Notification Triggers
 *
 * Firestore document triggers that detect status changes and send
 * email notifications to configured recipients via SendGrid.
 */

import { onDocumentUpdated, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { sendNotificationEmail, sendgridApiKey } from './sendEmail';

const FUNCTION_CONFIG = {
  region: 'us-central1' as const,
  memory: '256MiB' as const,
  secrets: [sendgridApiKey],
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
      logger.info(`PR ${after.number} submitted — sending notification`);
      await sendNotificationEmail({
        eventId: 'pr_submitted',
        subject: `PR Submitted: ${after.number}`,
        templateData: {
          title: 'Purchase Request Submitted',
          message: `A purchase request has been submitted for approval.`,
          details: [
            { label: 'PR Number', value: after.number || event.params.prId },
            { label: 'Requested By', value: after.createdByName || 'Unknown' },
            { label: 'Project', value: after.projectName || '-' },
            { label: 'Description', value: after.description || '-' },
          ],
          linkUrl: `https://toolbox.vapourdesal.com/procurement/purchase-requests/${event.params.prId}`,
        },
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
          linkUrl: `https://toolbox.vapourdesal.com/procurement/pos/${event.params.poId}`,
        },
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
          linkUrl: `https://toolbox.vapourdesal.com/procurement/pos/${event.params.poId}`,
        },
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
            { label: 'Amount', value: `₹${(after.totalAmount || 0).toLocaleString('en-IN')}` },
          ],
          linkUrl: 'https://toolbox.vapourdesal.com/accounting/invoices',
        },
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
            { label: 'Amount', value: `₹${(after.totalAmount || 0).toLocaleString('en-IN')}` },
          ],
          linkUrl: 'https://toolbox.vapourdesal.com/accounting/payments',
        },
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
      logger.info(`Leave request submitted by ${after.employeeName} — sending notification`);
      await sendNotificationEmail({
        eventId: 'leave_submitted',
        subject: `Leave Request: ${after.employeeName || 'Employee'}`,
        templateData: {
          title: 'Leave Request Submitted',
          message: `A leave request has been submitted for approval.`,
          details: [
            { label: 'Employee', value: after.employeeName || '-' },
            { label: 'Type', value: after.leaveTypeName || after.leaveType || '-' },
            { label: 'From', value: after.startDate || '-' },
            { label: 'To', value: after.endDate || '-' },
            { label: 'Days', value: String(after.numberOfDays || '-') },
            { label: 'Reason', value: after.reason || '-' },
          ],
          linkUrl: 'https://toolbox.vapourdesal.com/hr/leaves',
        },
      });
    }

    if (after.status === 'APPROVED' || after.status === 'REJECTED') {
      const action = after.status === 'APPROVED' ? 'Approved' : 'Rejected';
      logger.info(`Leave request ${action} for ${after.employeeName} — sending notification`);
      await sendNotificationEmail({
        eventId: 'leave_approved',
        subject: `Leave ${action}: ${after.employeeName || 'Employee'}`,
        templateData: {
          title: `Leave Request ${action}`,
          message: `A leave request has been ${action.toLowerCase()}.`,
          details: [
            { label: 'Employee', value: after.employeeName || '-' },
            { label: 'Type', value: after.leaveTypeName || after.leaveType || '-' },
            { label: 'Status', value: action },
            { label: 'From', value: after.startDate || '-' },
            { label: 'To', value: after.endDate || '-' },
          ],
          linkUrl: 'https://toolbox.vapourdesal.com/hr/leaves',
        },
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
        linkUrl: 'https://toolbox.vapourdesal.com/admin/users',
      },
    });
  }
);
