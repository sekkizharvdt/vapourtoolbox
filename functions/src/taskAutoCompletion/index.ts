/**
 * Task Auto-Completion Cloud Functions
 *
 * These functions automatically complete task notifications when
 * the underlying workflow state changes (e.g., PR approved, PO approved, etc.)
 *
 * Auto-completed tasks are marked with autoCompletedAt timestamp and
 * require user confirmation (completionConfirmed = false initially).
 *
 * ## Factory Pattern
 *
 * New auto-completion functions should use the `createAutoCompleteFunction`
 * factory from './factory' to reduce code duplication:
 *
 * ```typescript
 * import { createAutoCompleteFunction } from './factory';
 *
 * export const onRFQStatusChange = createAutoCompleteFunction({
 *   documentPath: 'rfqs/{rfqId}',
 *   entityType: 'RFQ',
 *   numberField: 'number',
 *   logPrefix: 'onRFQStatusChange',
 *   transitions: [
 *     { fromStatus: 'PENDING_QUOTES', toStatus: 'QUOTED', taskCategory: 'RFQ_PENDING_QUOTES' },
 *   ],
 * });
 * ```
 */

// Factory for creating auto-completion functions
export {
  createAutoCompleteFunction,
  type AutoCompleteConfig,
  type StatusTransitionConfig,
} from './factory';

// Purchase Request auto-completion
export { onPurchaseRequestStatusChange } from './purchaseRequestAutoComplete';

// Purchase Order auto-completion
export { onPurchaseOrderStatusChange } from './purchaseOrderAutoComplete';

// Invoice and Payment auto-completion
export { onInvoiceStatusChange, onPaymentLedgerStatusChange } from './invoiceAutoComplete';

// Vendor Bill auto-completion
export { onVendorBillStatusChange } from './vendorBillAutoComplete';

// Document workflow auto-completion
export { onDocumentStatusChange, onDocumentSubmissionCreated } from './documentAutoComplete';
