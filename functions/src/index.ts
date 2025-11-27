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

// Import PDF generation functions
export { generateBOMQuotePDF } from './pdf/generateBOMQuote';

// Import seed functions for materials
// Import seed functions for materials
export { seedMaterials } from './seed/seedMaterials';

// Import BOM functions
export { onBOMItemWrite } from './bom';

// Import task auto-completion functions
export {
  onPurchaseRequestStatusChange,
  onPurchaseOrderStatusChange,
  onInvoiceStatusChange,
  onPaymentLedgerStatusChange,
  onDocumentStatusChange,
  onDocumentSubmissionCreated,
} from './taskAutoCompletion';
