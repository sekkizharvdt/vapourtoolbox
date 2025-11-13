/**
 * GL Entry Generator
 *
 * Automatically generates General Ledger (GL) entries for financial transactions.
 * This is the core double-entry bookkeeping engine that ensures all transactions
 * are properly posted to the Chart of Accounts.
 *
 * Refactored from glEntryGenerator.ts (621 lines) into modular structure:
 * - types.ts: Type definitions
 * - generators.ts: Main GL entry generation functions
 * - helpers.ts: Calculation and validation helpers
 */

// Export types
export type { InvoiceGLInput, BillGLInput, PaymentGLInput, GLGenerationResult } from './types';

// Export generators
export {
  generateInvoiceGLEntries,
  generateBillGLEntries,
  generateCustomerPaymentGLEntries,
  generateVendorPaymentGLEntries,
} from './generators';

// Export helpers
export { validateGLEntries } from './helpers';
