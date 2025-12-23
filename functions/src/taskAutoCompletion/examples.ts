/**
 * Examples of Auto-Completion Functions Using the Factory
 *
 * This file demonstrates how to use createAutoCompleteFunction
 * to create new auto-completion functions with minimal code.
 *
 * These examples show how the existing functions could be refactored
 * to use the factory pattern, reducing ~95 lines to ~20 lines per function.
 */

import { createAutoCompleteFunction } from './factory';

/**
 * Example: Purchase Request auto-completion using factory
 *
 * Original: ~95 lines in purchaseRequestAutoComplete.ts
 * With factory: ~15 lines
 */
export const onPurchaseRequestStatusChangeV2 = createAutoCompleteFunction({
  documentPath: 'purchaseRequests/{prId}',
  entityType: 'PURCHASE_REQUEST',
  numberField: 'number',
  logPrefix: 'onPurchaseRequestStatusChange',
  transitions: [
    {
      fromStatus: 'SUBMITTED',
      toStatus: ['APPROVED', 'REJECTED'],
      taskCategory: 'PR_SUBMITTED',
      actionDescription: 'reviewed',
    },
  ],
});

/**
 * Example: Purchase Order auto-completion using factory
 */
export const onPurchaseOrderStatusChangeV2 = createAutoCompleteFunction({
  documentPath: 'purchaseOrders/{poId}',
  entityType: 'PURCHASE_ORDER',
  numberField: 'number',
  logPrefix: 'onPurchaseOrderStatusChange',
  transitions: [
    {
      fromStatus: 'PENDING_APPROVAL',
      toStatus: ['APPROVED', 'REJECTED'],
      taskCategory: 'PO_PENDING_APPROVAL',
      actionDescription: 'processed',
    },
  ],
});

/**
 * Example: Invoice auto-completion with multiple transitions
 *
 * Demonstrates handling multiple task categories on the same document
 */
export const onInvoiceStatusChangeV2 = createAutoCompleteFunction({
  documentPath: 'invoices/{invoiceId}',
  entityType: 'INVOICE',
  numberField: 'invoiceNumber',
  logPrefix: 'onInvoiceStatusChange',
  transitions: [
    // Approval transition
    {
      fromStatus: ['PENDING', 'PENDING_APPROVAL'],
      toStatus: ['APPROVED', 'REJECTED'],
      taskCategory: 'INVOICE_APPROVAL_REQUIRED',
    },
    // Payment transition
    {
      fromStatus: ['APPROVED', 'PENDING_PAYMENT'],
      toStatus: ['PAID', 'COMPLETED'],
      taskCategory: 'PAYMENT_REQUESTED',
      actionDescription: 'paid',
    },
  ],
});

/**
 * Example: RFQ auto-completion
 * Shows how easy it is to add new auto-completion functions
 */
export const onRFQStatusChange = createAutoCompleteFunction({
  documentPath: 'rfqs/{rfqId}',
  entityType: 'RFQ',
  numberField: 'number',
  logPrefix: 'onRFQStatusChange',
  transitions: [
    {
      fromStatus: 'SENT',
      toStatus: 'QUOTED',
      taskCategory: 'RFQ_SENT',
      actionDescription: 'quoted',
    },
    {
      fromStatus: 'QUOTED',
      toStatus: 'AWARDED',
      taskCategory: 'RFQ_QUOTED',
      actionDescription: 'awarded',
    },
  ],
});

/**
 * Example: Goods Receipt auto-completion
 */
export const onGoodsReceiptStatusChange = createAutoCompleteFunction({
  documentPath: 'goodsReceipts/{grId}',
  entityType: 'GOODS_RECEIPT',
  numberField: 'number',
  logPrefix: 'onGoodsReceiptStatusChange',
  transitions: [
    {
      fromStatus: 'PENDING_INSPECTION',
      toStatus: ['INSPECTED', 'ACCEPTED', 'REJECTED'],
      taskCategory: 'GR_PENDING_INSPECTION',
      actionDescription: 'inspected',
    },
  ],
});

/**
 * Example: Leave Request auto-completion
 */
export const onLeaveRequestStatusChange = createAutoCompleteFunction({
  documentPath: 'leaveRequests/{leaveId}',
  entityType: 'LEAVE_REQUEST',
  numberField: 'requestNumber',
  logPrefix: 'onLeaveRequestStatusChange',
  transitions: [
    {
      fromStatus: 'PENDING',
      toStatus: ['APPROVED', 'REJECTED'],
      taskCategory: 'LEAVE_APPROVAL_REQUIRED',
      actionDescription: 'reviewed',
    },
  ],
});
