/**
 * Email Notification Triggers
 *
 * Firestore document triggers that detect status changes and send
 * email notifications to configured recipients via Gmail SMTP.
 */

import { onDocumentUpdated, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { sendNotificationEmail, gmailAppPassword } from './sendEmail';

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
            { label: 'Amount', value: `₹${(after.totalAmount || 0).toLocaleString('en-IN')}` },
          ],
          linkUrl: 'https://toolbox.vapourdesal.com/accounting/bills',
        },
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
            { label: 'Amount', value: `₹${(after.totalAmount || 0).toLocaleString('en-IN')}` },
          ],
          linkUrl: 'https://toolbox.vapourdesal.com/accounting/journal-entries',
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
          linkUrl: `https://toolbox.vapourdesal.com/accounting/payment-batches/${event.params.batchId}`,
        },
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
          linkUrl: `https://toolbox.vapourdesal.com/accounting/payment-batches/${event.params.batchId}`,
        },
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
          linkUrl: `https://toolbox.vapourdesal.com/accounting/payment-batches/${event.params.batchId}`,
        },
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
          linkUrl: 'https://toolbox.vapourdesal.com/hr/on-duty',
        },
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
          message: `An on-duty request has been ${action.toLowerCase()}.`,
          details: [
            { label: 'Request #', value: after.requestNumber || event.params.recordId },
            { label: 'Employee', value: after.userName || '-' },
            { label: 'Holiday', value: after.holidayName || '-' },
            { label: 'Status', value: action },
          ],
          linkUrl: 'https://toolbox.vapourdesal.com/hr/on-duty',
        },
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
            { label: 'Amount', value: `₹${(after.totalAmount || 0).toLocaleString('en-IN')}` },
          ],
          linkUrl: 'https://toolbox.vapourdesal.com/hr/travel-expenses',
        },
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
          message: `A travel expense report has been ${action.toLowerCase()}.`,
          details: [
            { label: 'Report #', value: after.reportNumber || event.params.expenseId },
            { label: 'Employee', value: after.employeeName || '-' },
            { label: 'Amount', value: `₹${(after.totalAmount || 0).toLocaleString('en-IN')}` },
            { label: 'Status', value: action },
          ],
          linkUrl: 'https://toolbox.vapourdesal.com/hr/travel-expenses',
        },
      });
    }

    if (after.status === 'REIMBURSED') {
      logger.info(`Travel expense ${after.reportNumber} reimbursed — sending notification`);
      await sendNotificationEmail({
        eventId: 'travel_expense_reimbursed',
        subject: `Travel Expense Reimbursed: ${after.reportNumber}`,
        templateData: {
          title: 'Travel Expense Reimbursed',
          message: `A travel expense has been reimbursed.`,
          details: [
            { label: 'Report #', value: after.reportNumber || event.params.expenseId },
            { label: 'Employee', value: after.employeeName || '-' },
            { label: 'Amount', value: `₹${(after.totalAmount || 0).toLocaleString('en-IN')}` },
          ],
          linkUrl: 'https://toolbox.vapourdesal.com/hr/travel-expenses',
        },
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
          linkUrl: `https://toolbox.vapourdesal.com/estimation/proposals/${event.params.proposalId}`,
        },
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
          linkUrl: `https://toolbox.vapourdesal.com/estimation/proposals/${event.params.proposalId}`,
        },
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
          linkUrl: `https://toolbox.vapourdesal.com/estimation/proposals/${event.params.proposalId}`,
        },
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
          linkUrl: `https://toolbox.vapourdesal.com/estimation/proposals/${event.params.proposalId}`,
        },
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
          linkUrl: `https://toolbox.vapourdesal.com/procurement/goods-receipts/${event.params.grId}`,
        },
      });
    }
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
          linkUrl: `https://toolbox.vapourdesal.com/estimation/enquiries/${event.params.enquiryId}`,
        },
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
          linkUrl: `https://toolbox.vapourdesal.com/estimation/enquiries/${event.params.enquiryId}`,
        },
      });
    }
  }
);
