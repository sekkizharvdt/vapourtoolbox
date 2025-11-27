/**
 * Task Auto-Completion Cloud Functions
 *
 * These functions automatically complete task notifications when
 * the underlying workflow state changes (e.g., PR approved, PO approved, etc.)
 *
 * Auto-completed tasks are marked with autoCompletedAt timestamp and
 * require user confirmation (completionConfirmed = false initially).
 */

// Purchase Request auto-completion
export { onPurchaseRequestStatusChange } from './purchaseRequestAutoComplete';

// Purchase Order auto-completion
export { onPurchaseOrderStatusChange } from './purchaseOrderAutoComplete';

// Invoice and Payment auto-completion
export { onInvoiceStatusChange, onPaymentLedgerStatusChange } from './invoiceAutoComplete';

// Document workflow auto-completion
export { onDocumentStatusChange, onDocumentSubmissionCreated } from './documentAutoComplete';
