/**
 * GL Entry Generator (Compatibility Shim)
 *
 * This file maintains backward compatibility with existing imports.
 * All functionality has been refactored into the glEntry/ module.
 *
 * @deprecated Import from '@/lib/accounting/glEntry' instead
 */

// Re-export everything from the modular structure
export type { InvoiceGLInput, BillGLInput, PaymentGLInput, GLGenerationResult } from './glEntry';

export {
  generateInvoiceGLEntries,
  generateBillGLEntries,
  generateCustomerPaymentGLEntries,
  generateVendorPaymentGLEntries,
  validateGLEntries,
} from './glEntry';
