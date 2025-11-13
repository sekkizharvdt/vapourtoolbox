/**
 * Three-Way Match Service
 *
 * Handles automated matching of Purchase Orders, Goods Receipts, and Vendor Invoices
 *
 * Refactored from threeWayMatchService.ts (772 lines) into modular structure:
 * - types.ts: Type definitions and re-exports
 * - utils.ts: Helper functions for document fetching and tolerance checks
 * - matching.ts: Core three-way matching algorithm
 * - discrepancies.ts: Discrepancy queries and resolution
 * - workflow.ts: Approval and rejection workflow
 * - queries.ts: Status queries and match history
 */

// Export types
export type {
  PurchaseOrder,
  PurchaseOrderItem,
  GoodsReceipt,
  GoodsReceiptItem,
  ThreeWayMatch,
  MatchLineItem,
  MatchDiscrepancy,
  MatchToleranceConfig,
  DiscrepancyType,
  VendorBill,
} from './types';

// Export matching operations
export { performThreeWayMatch } from './matching';

// Export query functions
export {
  getMatchStatus,
  getMatchLineItems,
  getMatchHistory,
  getDefaultToleranceConfig,
} from './queries';

// Export discrepancy management
export { getMatchDiscrepancies, resolveDiscrepancy } from './discrepancies';

// Export workflow operations
export { approveMatch, rejectMatch } from './workflow';
