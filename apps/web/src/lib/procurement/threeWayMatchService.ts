/**
 * Three-Way Match Service (Compatibility Shim)
 *
 * This file maintains backward compatibility with existing imports.
 * All functionality has been refactored into the threeWayMatch/ module.
 *
 * @deprecated Import from '@/lib/procurement/threeWayMatch' instead
 */

// Re-export everything from the modular structure
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
} from './threeWayMatch';

export {
  performThreeWayMatch,
  getMatchStatus,
  getMatchLineItems,
  getMatchDiscrepancies,
  resolveDiscrepancy,
  approveMatch,
  rejectMatch,
  getMatchHistory,
  getDefaultToleranceConfig,
} from './threeWayMatch';
