/**
 * Vendor Quotes — Unified vendor-quote module
 *
 * Absorbs procurement `offers` (RFQ responses) and materials `vendorOffers`
 * (standing quotes). See PROCUREMENT-MATERIALS-AUDIT-2026-04-24.md.
 */

export {
  // CRUD
  createVendorQuote,
  getVendorQuoteById,
  listVendorQuotes,
  getQuotesByRFQ,
  getVendorQuoteItems,
  updateVendorQuoteStatus,
  updateVendorQuote,
  // Item CRUD
  addVendorQuoteItem,
  updateVendorQuoteItem,
  removeVendorQuoteItem,
  // Price acceptance
  acceptQuoteItemPrice,
} from './vendorQuoteService';

export type {
  CreateVendorQuoteInput,
  CreateVendorQuoteItemInput,
  ListVendorQuotesFilters,
} from './vendorQuoteService';

export {
  // Workflow
  selectVendorQuote,
  rejectVendorQuote,
  withdrawVendorQuote,
  // Evaluation
  evaluateVendorQuote,
  markVendorQuoteAsRecommended,
  // Comparison
  getVendorQuoteComparison,
} from './vendorQuoteWorkflow';

export type {
  EvaluateVendorQuoteInput,
  VendorQuoteComparisonData,
  VendorQuoteComparisonStat,
  VendorQuoteItemComparison,
} from './vendorQuoteWorkflow';
