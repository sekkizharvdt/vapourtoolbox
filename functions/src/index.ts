import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();
admin.firestore().settings({ ignoreUndefinedProperties: true });

// Import user management functions
export { onUserUpdate } from './userManagement';

// Import account balance functions
export { onTransactionWrite, recalculateAccountBalances } from './accountBalances';

// Import entity management functions
export { createEntity } from './entities/createEntity';

// Import currency exchange rate functions
export { fetchDailyExchangeRates, manualFetchExchangeRates } from './currency';

// Import project management functions
export { onProjectCreated, onProjectUpdated } from './projects';

// Import charter approval functions
export { onCharterApproved } from './charterApproval';

// Import document requirements functions
export { onDocumentUploaded } from './documentRequirements';

// Import module integration functions
export { seedAccountingIntegrations } from './moduleIntegrations';

// PDF generation functions — all migrated to client-side @react-pdf/renderer
// generateRFQPDF: see rfqPdfService.ts
// generateBOMQuotePDF: see bomQuotePdfService.ts

// Import seed functions for materials
export { seedMaterials } from './seed/seedMaterials';
export { migratePipingMaterials } from './seed/migrateMaterials';

// Import BOM functions
export { onBOMItemWrite } from './bom';

// Import task auto-completion functions
export {
  onPurchaseRequestStatusChange,
  onPurchaseOrderStatusChange,
  onInvoiceStatusChange,
  onPaymentLedgerStatusChange,
  onVendorBillStatusChange,
  onDocumentStatusChange,
  onDocumentSubmissionCreated,
} from './taskAutoCompletion';

// Import project financials functions (Accounting → Projects integration)
export {
  onTransactionWriteUpdateProjectFinancials,
  onProjectBudgetChange,
} from './projectFinancials';

// Import procurement → projects sync functions
export {
  onPOStatusSyncToProject,
  onRFQStatusSyncToProject,
  onGoodsReceiptSyncToProject,
} from './procurementProjectSync';

// Import procurement payment status sync (keeps GR paymentStatus in sync with vendor payments)
export { syncPOPaymentStatusOnVendorPayment } from './procurementPaymentStatus';

// Import feedback functions
export { onFeedbackResolved } from './feedback';

// Import transmittal functions
// generateTransmittal removed — migrated to client-side @react-pdf/renderer (transmittalPdfService.ts)
export { getTransmittalDownloadUrl } from './transmittals';

// Import document parsing functions
export { parseDocumentForPR } from './documentParsing';

// Import offer parsing functions
export { parseOfferDocument } from './offerParsing/parseOfferDocument';
export { compareOfferParsers } from './offerParsing/compareOfferParsers';
export { compareOfferWithSpecs } from './offerParsing/compareOfferWithSpecs';

// Import enquiry parsing function (RFP/SOW → structured fields + conditions)
export { parseEnquiryDocument } from './enquiryParsing/parseEnquiryDocument';

// Import denormalization sync functions (keeps denormalized data fresh)
export {
  onUserNameChange,
  onEntityNameChange,
  onProjectNameChange,
  onEquipmentNameChange,
} from './denormalizationSync';

// Import receipt parsing functions (for travel expenses)
export { parseReceiptForExpense } from './receiptParsing/parseReceipt';
export { compareReceiptParsers } from './receiptParsing/compareReceiptParsers';

// Import HR functions (leave balance reset)
export {
  resetLeaveBalances,
  manualResetLeaveBalances,
  seedLeaveTypes,
} from './hr/leaveBalanceReset';

// Import AI Help function (beta feature)
export { aiHelp } from './aiHelp';

// Import backup functions
export { scheduledBackup, manualBackup } from './backup/scheduledBackup';

// Import email notification functions
export {
  onPRSubmittedNotify,
  onPOStatusNotify,
  onAccountingNotify,
  onLeaveNotify,
  onNewUserNotify,
  onPaymentBatchNotify,
  onOnDutyNotify,
  onTravelExpenseNotify,
  onProposalNotify,
  onGoodsReceiptNotify,
  onEnquiryNotify,
  onFeedbackNotify,
} from './email/triggers';
export { checkOverdueItemsAndNotify } from './email/scheduled';
export { sendTestEmail } from './email/testEmail';

// Import migration functions
export { migratePaymentStatus } from './migrations/migratePaymentStatus';
export { backfillJournalEntryTotalAmount } from './migrations/backfillJournalEntryTotalAmount';
