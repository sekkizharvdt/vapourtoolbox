/**
 * GST Reports Service
 *
 * Generates GST returns data for GSTR-1, GSTR-2, and GSTR-3B
 *
 * Refactored from gstReportGenerator.ts (759 lines) into modular structure:
 * - types.ts: Type definitions for GST reports
 * - utils.ts: Helper functions for GST calculations
 * - generators.ts: Main report generation logic
 * - exporters.ts: Export functions for GST portal JSON format
 */

// Export types
export type {
  GSTSummary,
  B2BInvoice,
  B2CInvoice,
  HSNSummary,
  GSTR1Data,
  PurchaseDetail,
  GSTR2Data,
  GSTR3BData,
} from './types';

// Export generator functions
export { generateGSTR1, generateGSTR2, generateGSTR3B } from './generators';

// Export exporter functions
export { exportGSTR1ToJSON, exportGSTR3BToJSON } from './exporters';
