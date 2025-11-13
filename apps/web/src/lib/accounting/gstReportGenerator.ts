/**
 * GST Report Generator (Compatibility Shim)
 *
 * This file maintains backward compatibility with existing imports.
 * All functionality has been refactored into the gstReports/ module.
 *
 * @deprecated Import from '@/lib/accounting/gstReports' instead
 */

// Re-export everything from the modular structure
export type {
  GSTSummary,
  B2BInvoice,
  B2CInvoice,
  HSNSummary,
  GSTR1Data,
  PurchaseDetail,
  GSTR2Data,
  GSTR3BData,
} from './gstReports';

export {
  generateGSTR1,
  generateGSTR2,
  generateGSTR3B,
  exportGSTR1ToJSON,
  exportGSTR3BToJSON,
} from './gstReports';
